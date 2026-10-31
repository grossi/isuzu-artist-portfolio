import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config.js";
import { HttpError, Jobs, summary } from "./lib/jobs.js";
import { contentType, sendFile, serveStatic } from "./lib/static.js";
import { thumbnail } from "./lib/thumbs.js";
import { receiveUploads, removeTemp } from "./lib/uploads.js";
import { CAROUSEL_DIR, GALLERY_DIR, Workspace, commitMessage, git } from "./lib/workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const workspace = new Workspace(config);
const jobs = new Jobs();
const previewDir = path.join(config.stateDir, "preview");
const thumbDir = path.join(config.stateDir, "thumbs");
const uploadDir = path.join(config.stateDir, "uploads");
fs.mkdirSync(config.stateDir, { recursive: true });

// Housekeeping before anything can take the lock.
await workspace.recover();
fs.rmSync(uploadDir, { recursive: true, force: true });
pruneThumbs();

// Bumped by every draft edit: stale browser tabs get a 409 instead of
// overwriting newer changes, and the preview knows when it is out of date.
// Seeded from the clock so a tab from before a restart never matches.
let version = Date.now();
let preview = fs.existsSync(path.join(previewDir, "index.html"))
  ? { version: 0, builtAt: fs.statSync(path.join(previewDir, "index.html")).mtime.toISOString() }
  : null;

function pruneThumbs() {
  const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
  for (const name of fs.existsSync(thumbDir) ? fs.readdirSync(thumbDir) : []) {
    const file = path.join(thumbDir, name);
    if (fs.statSync(file).mtimeMs < monthAgo) fs.rmSync(file, { force: true });
  }
}

// The frontend as it was when this server started: a deploy that brings a
// newer admin/ from main must not serve new pages to the old server.
const ASSETS = new Map(
  fs.readdirSync(path.join(here, "public")).map((name) => [`/${name}`, fs.readFileSync(path.join(here, "public", name))])
);
ASSETS.set("/", ASSETS.get("/index.html"));
ASSETS.set("/vendor/Sortable.min.js", fs.readFileSync(path.join(here, "node_modules/sortablejs/Sortable.min.js")));

// The live markdown preview uses the site's own markdown-to-jsx (the
// workspace's node_modules), its "react" import pointed at a stub.
function markdownModule() {
  const source = fs.readFileSync(workspace.file("node_modules/markdown-to-jsx/dist/index.modern.js"), "utf-8");
  const patched = source.replace(/from\s*"react"/, 'from"/react-shim.js"');
  if (patched === source) throw new HttpError(500, "Unexpected markdown-to-jsx build: no react import");
  return Buffer.from(patched);
}

// When the admin runs from the workspace, a deploy can update its code.
const adminPath = path.relative(config.workspace, here);
const runsFromWorkspace = !adminPath.startsWith("..") && !path.isAbsolute(adminPath);
const adminTree = () => git(config.workspace, ["rev-parse", `HEAD:${adminPath}`]).then((out) => out.trim(), () => null);
const startedAdminTree = runsFromWorkspace ? await adminTree() : null;

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
    await workspace.check({ duringJob: Boolean(jobs.busy()) });
    const now = workspace.current();
    const [draft, history] = await Promise.all([workspace.draft(), workspace.history()]);
    return {
      ...base,
      gallery: now.gallery,
      carouselFiles: now.carouselFiles,
      carousel: now.carousel,
      sidebar: workspace.readSidebar(),
      draft: { ...draft, message: commitMessage(draft) },
      history,
      restartNeeded: Boolean(startedAdminTree) && (await adminTree()) !== startedAdminTree,
    };
  } catch (error) {
    return { ...base, error: error.message };
  }
}

function edited() {
  version++;
}

// ---- Request guards ----------------------------------------------------

function assertAllowed(req) {
  const host = (req.headers.host || "").toLowerCase().replace(/:\d+$/, "");
  if (!config.allowedHosts.has(host)) throw new HttpError(421, "Unknown host");
  const user = (req.headers["tailscale-user-login"] || "").toLowerCase();
  if (config.allowedUsers.size && !config.allowedUsers.has(user)) throw new HttpError(403, "Not allowed");
}

// Cross-site pages can't set a custom header without a CORS preflight, which
// this server never answers, so they can't trigger edits or deploys.
function assertSameOrigin(req) {
  if (req.headers["x-isuzu-admin"] !== "1") throw new HttpError(403, "Missing X-Isuzu-Admin header");
  const origin = req.headers.origin;
  if (origin === undefined) return;
  let host = null;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    // "null" (sandboxed frames, some redirects) or garbage
  }
  if (host !== (req.headers.host || "").toLowerCase()) throw new HttpError(403, "Cross-origin request refused");
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

// Every draft edit: under the lock, against the draft version the browser
// based it on (ANY_VERSION: an edit that can't overwrite anything, such as
// adding uploads at the front).
const ANY_VERSION = Symbol("any version");
async function mutate(kind, seenVersion, apply) {
  return jobs.withLock(kind, async () => {
    await workspace.check();
    if (seenVersion !== ANY_VERSION && seenVersion !== version) {
      throw new HttpError(409, "The draft changed meanwhile (another tab?); reload the page");
    }
    const result = await apply();
    edited();
    return result;
  });
}

// Receives a multipart upload into the spool, then applies it as an edit.
// A busy lock is reported before the upload is read.
async function withUpload(req, kind, limits, apply) {
  if (jobs.busy()) throw new HttpError(409, `Busy: ${jobs.busy()} is running. Try again when it finishes.`);
  const upload = await receiveUploads(req, { tempDir: uploadDir, maxBytes: config.maxUploadBytes, ...limits });
  try {
    const { seenVersion = ANY_VERSION, apply: run } = apply(upload);
    return await mutate(kind, seenVersion, run);
  } finally {
    removeTemp(upload.files);
  }
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
    const added = await withUpload(req, "upload", { maxFiles: config.maxUploadFiles }, ({ files }) => {
      if (!files.length) throw new HttpError(400, "No files in the upload");
      return { apply: () => workspace.addUploads(files) };
    });
    json(res, 200, { added, version });
  },

  "PUT /api/order": async (req, res) => {
    const body = await readJson(req);
    await mutate("reorder", body.version, () => workspace.setOrder(body));
    json(res, 200, { version });
  },

  "POST /api/remove": async (req, res) => {
    const body = await readJson(req);
    await mutate("remove", body.version, () => workspace.removeUpload(body.file));
    json(res, 200, { version });
  },

  // Multipart: an "entry" JSON field ({ id?, link, description, version })
  // and an optional "image" file (required for a new entry). Editing an
  // entry needs the version its dialog was opened at; adding one doesn't.
  "POST /api/sidebar/entry": async (req, res) => {
    const saved = await withUpload(req, "sidebar", { maxFiles: 1, fieldNames: ["entry"] }, ({ files, fields }) => {
      let entry;
      try {
        entry = JSON.parse(fields.entry ?? "");
      } catch {
        throw new HttpError(400, "Invalid entry");
      }
      return {
        seenVersion: entry?.id === undefined ? ANY_VERSION : entry.version,
        apply: () => workspace.saveSidebarEntry(entry, files[0]),
      };
    });
    json(res, 200, { saved, version });
  },

  "PUT /api/sidebar": async (req, res) => {
    const body = await readJson(req);
    await mutate("sidebar", body.version, () => workspace.setSidebar(body));
    json(res, 200, { version });
  },

  "POST /api/sidebar/remove": async (req, res) => {
    const body = await readJson(req);
    await mutate("sidebar", body.version, () => workspace.removeSidebarEntry(body.id));
    json(res, 200, { version });
  },

  "POST /api/discard": async (req, res) => {
    const body = await readJson(req);
    await mutate("discard", body.version, () => workspace.discard());
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
const ENTRY_IMAGE_ROUTE = /^\/(?:thumb|image)\/sidebar\/([a-z0-9-]+)$/;

async function sendImage(res, pathname, source) {
  if (pathname.startsWith("/image/")) return sendFile(res, source);
  return sendFile(res, await thumbnail(source, thumbDir), { cache: "private, max-age=3600" });
}

// The admin's pages run only their own scripts: nothing inline, nothing
// from elsewhere. Images may come from https (markdown in the preview).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: https:; connect-src 'self'; " +
  "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function sendAsset(res, name, body) {
  res.writeHead(200, {
    "Content-Type": contentType(name === "/" ? "/index.html" : name),
    "Content-Length": body.length,
    "Cache-Control": "no-cache",
    "Content-Security-Policy": CSP,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

async function handleAdmin(req, res) {
  assertAllowed(req);
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
    return sendImage(res, pathname, workspace.file(folder, name));
  }

  // A sidebar entry's image, by entry id (the content file was validated).
  const entryImage = req.method === "GET" && ENTRY_IMAGE_ROUTE.exec(pathname);
  if (entryImage) {
    const entry = workspace.readSidebar().entries.find((e) => e.id === entryImage[1]);
    if (!entry || !fs.existsSync(workspace.file("public", entry.image))) throw new HttpError(404, "No such image");
    return sendImage(res, pathname, workspace.file("public", entry.image));
  }

  if (pathname === "/favicon.ico") return res.writeHead(204).end();
  if (req.method === "GET" && pathname === "/vendor/markdown-to-jsx.js") return sendAsset(res, pathname, markdownModule());
  if ((req.method === "GET" || req.method === "HEAD") && ASSETS.has(pathname)) return sendAsset(res, pathname, ASSETS.get(pathname));
  throw new HttpError(404, "Not found");
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
  assertAllowed(req);
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
