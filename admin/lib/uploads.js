import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import sharp from "sharp";
import { HttpError } from "./jobs.js";

// Detected format → file extension. The client's name and type are not trusted.
const FORMATS = { jpeg: "jpg", png: "png", webp: "webp" };

// "My Piece (final).PNG" → "my-piece-final". ASCII only, one dot-free stem, so
// the name is safe in a URL, an S3 key and the build's "name.extension" split.
export function sanitizeStem(filename) {
  const base = String(filename ?? "").split(/[/\\]/).pop();
  const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  const slug = stem
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "illustration";
}

// Streams a multipart upload into tempDir and checks every file is a real
// jpg/png/webp. Returns [{ path, stem, extension, originalName }]; on any error
// the temp files are deleted and an HttpError is thrown.
export async function receiveUploads(req, { tempDir, maxBytes, maxFiles }) {
  fs.mkdirSync(tempDir, { recursive: true });
  const files = [];
  try {
    await new Promise((resolve, reject) => {
      let parser;
      try {
        // Browsers send UTF-8 file names; busboy assumes latin1 otherwise.
        parser = busboy({ headers: req.headers, defParamCharset: "utf8", limits: { fileSize: maxBytes, files: maxFiles, fields: 0, parts: maxFiles } });
      } catch {
        return reject(new HttpError(400, "Expected a multipart/form-data upload"));
      }
      const writes = [];
      parser.on("file", (_field, stream, info) => {
        const file = { path: path.join(tempDir, randomUUID()), originalName: info.filename || "upload" };
        files.push(file);
        stream.on("limit", () => reject(new HttpError(413, `${file.originalName} is larger than ${Math.round(maxBytes / 1048576)} MB`)));
        writes.push(pipeline(stream, fs.createWriteStream(file.path, { flags: "wx" })));
      });
      parser.on("filesLimit", () => reject(new HttpError(413, `At most ${maxFiles} files per upload`)));
      parser.on("partsLimit", () => reject(new HttpError(413, `At most ${maxFiles} files per upload`)));
      parser.on("fieldsLimit", () => reject(new HttpError(400, "Unexpected form fields")));
      parser.on("error", () => reject(new HttpError(400, "Malformed upload")));
      parser.on("close", () => Promise.all(writes).then(resolve, reject));
      req.on("aborted", () => reject(new HttpError(400, "Upload aborted")));
      req.pipe(parser);
    });
    if (!files.length) throw new HttpError(400, "No files in the upload");
    for (const file of files) {
      const metadata = await sharp(file.path).metadata().catch(() => ({}));
      const extension = FORMATS[metadata.format];
      if (!extension || !metadata.width || !metadata.height) {
        throw new HttpError(415, `${file.originalName} is not a JPEG, PNG or WebP image`);
      }
      Object.assign(file, { extension, stem: sanitizeStem(file.originalName) });
    }
    return files;
  } catch (error) {
    removeTemp(files);
    req.resume();
    throw error;
  }
}

export function removeTemp(files) {
  for (const file of files) fs.rmSync(file.path, { force: true });
}
