import fs from "node:fs";
import path from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

// The file under root that urlPath names, or null. Rejects anything that would
// leave root (.., encoded slashes, NUL) instead of normalising it away.
export function resolveInside(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) return null;
  if (decoded.split("/").some((segment) => segment === "..")) return null;
  const file = path.resolve(root, `.${path.posix.normalize(`/${decoded}`)}`);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return file;
}

export function sendFile(res, file, { cache = "no-store", status = 200 } = {}) {
  const stat = fs.statSync(file);
  res.writeHead(status, {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

// Serves root like the site's CloudFront: unknown paths get index.html.
export function serveStatic(root, req, res, { spa = false, cache } = {}) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const urlPath = new URL(req.url, "http://localhost").pathname;
  let file = resolveInside(root, urlPath);
  if (file && !isFile(file) && isFile(path.join(file, "index.html"))) file = path.join(file, "index.html");
  if (!file || !isFile(file)) {
    const index = path.join(root, "index.html");
    if (spa && file && isFile(index)) return sendFile(res, index, { cache });
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  sendFile(res, file, { cache });
}
