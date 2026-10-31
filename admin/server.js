import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config.js";
import { HttpError, Jobs, summary } from "./lib/jobs.js";
import { sendFile, serveStatic } from "./lib/static.js";
import { thumbnail } from "./lib/thumbs.js";
import { receiveUploads, removeTemp } from "./lib/uploads.js";
import { CAROUSEL_DIR, GALLERY_DIR, Workspace, commitMessage } from "./lib/workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const workspace = new Workspace(config);
const jobs = new Jobs();
const previewDir = path.join(config.stateDir, "preview");
const thumbDir = path.join(config.stateDir, "thumbs");
const uploadDir = path.join(config.stateDir, "uploads");
fs.mkdirSync(config.stateDir, { recursive: true });

// Bumped by every draft edit: stale browser tabs get a 409 instead of
// overwriting newer changes, and the preview knows when it is out of date.
let version = 1;
let preview = fs.existsSync(path.join(previewDir, "index.html"))
  ? { version: 0, builtAt: fs.statSync(path.join(previewDir, "index.html")).mtime.toISOString() }
  : null;

async function state() {
  const base = {
    version,
    busy: jobs.busy(),
    job: summary(jobs.job()),
    workspace: config.workspace,
    deployCommand: config.deployCommand.join(" "),
    preview: preview && { ...preview, stale: preview.version !== version },
    previewUrl: config.previewUrl,
    previewPort: config.previewPort,
  };
  try {
    await workspace.check();
    const now = workspace.current();
    const [draft, history] = await Promise.all([workspace.draft(), workspace.history()]);
    return {
      ...base,
      gallery: now.gallery,
      carouselFiles: now.carouselFiles,
      carousel: now.carousel,
      draft: { ...draft, message: commitMessage(draft) },
      history,
    };
  } catch (error) {
    return { ...base, error: error.message };
  }
}

function edited() {
  version++;
}

// ---- Request guards ----------------------------------------------------

function hostAllowed(req) {
  const host = (req.headers.host || "").toLowerCase().replace(/:\d+$/, "");
  return config.allowedHosts.has(host);
}

// Cross-site pages can't set a custom header without a CORS preflight, which
// this server never answers, so they can't trigger edits or deploys.
function assertSameOrigin(req) {
  if (req.headers["x-isuzu-admin"] !== "1") throw new HttpError(403, "Missing X-Isuzu-Admin header");
  const origin = req.headers.origin;
  if (origin && new URL(origin).host.toLowerCase() !== (req.headers.host || "").toLowerCase()) {
    throw new HttpError(403, "Cross-origin request refused");
  }
}

async function readJson(req) {
  if (!(req.headers["content-type"] || "").startsWith("application/json")) throw new HttpError(415, "Expected JSON");
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new HttpError(413, "Request too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

// ---- Routes ------------------------------------------------------------

const routes = {
  "GET /api/state": async (req, res) => json(res, 200, await state()),

  "GET /api/events": (req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    const job = jobs.job();
    send("snapshot", { job: summary(job), log: job?.log ?? [] });
    const unsubscribe = jobs.subscribe(send);
    const keepAlive = setInterval(() => res.write(": keep-alive\n\n"), 25000);
    req.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  },

  "POST /api/upload": async (req, res) => {
    if (jobs.busy()) throw new HttpError(409, `Busy: ${jobs.busy()} is running. Try again when it finishes.`);
    const files = await receiveUploads(req, { tempDir: uploadDir, maxBytes: config.maxUploadBytes, maxFiles: config.maxUploadFiles });
    try {
      const names = await jobs.withLock("upload", async () => {
        await workspace.check();
        const names = workspace.addUploads(files);
        edited();
        return names;
      });
      json(res, 200, { added: names });
    } finally {
      removeTemp(files);
    }
  },

  "PUT /api/order": async (req, res) => {
    const body = await readJson(req);
    await jobs.withLock("reorder", async () => {
      await workspace.check();
      if (body.version !== version) throw new HttpError(409, "The draft changed meanwhile; reload the page");
      workspace.setOrder(body);
      edited();
    });
    json(res, 200, { version });
  },

  "POST /api/remove": async (req, res) => {
    const { file } = await readJson(req);
    await jobs.withLock("remove", async () => {
      await workspace.check();
      await workspace.removeUpload(file);
      edited();
    });
    json(res, 200, { version });
  },

  "POST /api/discard": async (req, res) => {
    await jobs.withLock("discard", async () => {
      await workspace.check();
      await workspace.discard();
      edited();
    });
    json(res, 200, { version });
  },

  "POST /api/preview": async (req, res) => {
    await workspace.check();
    const built = version;
    json(res, 202, jobs.start("preview", async (log) => {
      // Built aside and swapped in, so a failed build keeps the last preview.
      const next = `${previewDir}.next`;
      const old = `${previewDir}.old`;
      await workspace.preview(log, next);
      fs.rmSync(old, { recursive: true, force: true });
      if (fs.existsSync(previewDir)) fs.renameSync(previewDir, old);
      fs.renameSync(next, previewDir);
      fs.rmSync(old, { recursive: true, force: true });
      preview = { version: built, builtAt: new Date().toISOString() };
      log("✓ Preview ready");
    }));
  },

  "POST /api/save": async (req, res) => {
    const { message } = await readJson(req);
    if (typeof message !== "string" || !message.trim() || message.length > 10000) throw new HttpError(400, "A commit message is required");
    await workspace.check();
    json(res, 202, jobs.start("save", (log) => workspace.save(log, message.trim())));
  },

  "POST /api/deploy": async (req, res) => {
    await workspace.check();
    json(res, 202, jobs.start("deploy", async (log) => {
      // A rebase onto a newer main changes the files the preview was built from.
      const tree = await workspace.tree();
      try {
        return await workspace.deploy(log);
      } finally {
        if ((await workspace.tree()) !== tree) edited();
      }
    }));
  },
};

const IMAGE_ROUTE = /^\/(?:thumb|image)\/(gallery|carousel)\/([^/]+)$/;

async function handleAdmin(req, res) {
  if (!hostAllowed(req)) throw new HttpError(421, "Unknown host");
  const { pathname } = new URL(req.url, "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);

  const route = routes[`${req.method} ${pathname}`];
  if (route) return route(req, res);

  const image = req.method === "GET" && IMAGE_ROUTE.exec(pathname);
  if (image) {
    const folder = image[1] === "gallery" ? GALLERY_DIR : CAROUSEL_DIR;
    let name;
    try {
      name = decodeURIComponent(image[2]);
    } catch {
      throw new HttpError(400, "Bad file name");
    }
    // Only a file that is listed in the folder: no separators, no dot names.
    const list = fs.readdirSync(workspace.file(folder), { withFileTypes: true });
    if (!list.some((entry) => entry.isFile() && entry.name === name)) throw new HttpError(404, "No such image");
    const source = workspace.file(folder, name);
    if (pathname.startsWith("/image/")) return sendFile(res, source);
    return sendFile(res, await thumbnail(source, thumbDir), { cache: "private, max-age=3600" });
  }

  if (pathname === "/favicon.ico") return res.writeHead(204).end();
  if (pathname === "/vendor/Sortable.min.js") {
    return sendFile(res, path.join(here, "node_modules/sortablejs/Sortable.min.js"), { cache: "private, max-age=86400" });
  }
  return serveStatic(path.join(here, "public"), req, res);
}

function handler(handle) {
  return (req, res) => {
    Promise.resolve().then(() => handle(req, res)).catch((error) => {
      if (!(error instanceof HttpError)) console.error(error);
      if (res.headersSent) return res.end();
      json(res, error.status || 500, { error: error.message });
    });
  };
}

const WAIT_PAGE = (message) => `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="2">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Preview</title>
<body style="font:16px system-ui;display:grid;place-items:center;height:90vh;color:#555">${message}</body>`;

function handlePreview(req, res) {
  if (!hostAllowed(req)) throw new HttpError(421, "Unknown host");
  // Page loads (not assets) wait while a build replaces the files.
  const pageLoad = req.method === "GET" && (req.headers.accept || "").includes("text/html");
  const waiting = jobs.busy() === "preview" ? "Building the preview… this page reloads when it is ready."
    : !preview ? "No preview yet: press Preview in the admin." : null;
  if (pageLoad && waiting) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(WAIT_PAGE(waiting));
  }
  return serveStatic(previewDir, req, res, { spa: true });
}

http.createServer(handler(handleAdmin)).listen(config.port, config.host, () => {
  console.log(`isuzu admin on http://${config.host}:${config.port}/ (workspace ${config.workspace})`);
});
http.createServer(handler(handlePreview)).listen(config.previewPort, config.host, () => {
  console.log(`site preview on http://${config.host}:${config.previewPort}/`);
});
