import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import busboy from "busboy";
import sharp from "sharp";
import { HttpError } from "./errors.js";

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
// jpg/png/webp. Text parts are only accepted under the given field names.
// Returns { files: [{ path, stem, extension, originalName }], fields }; on any
// error the temp files are deleted and an HttpError is thrown.
export async function receiveUploads(req, { tempDir, maxBytes, maxFiles, fieldNames = [] }) {
  fs.mkdirSync(tempDir, { recursive: true });
  const files = [];
  const fields = {};
  const writes = [];
  let parser;
  try {
    await new Promise((resolve, reject) => {
      let failed = false;
      const fail = (error) => {
        if (failed) return;
        failed = true;
        // Stop reading: later parts must not create temp files after the cleanup.
        req.unpipe(parser);
        req.resume();
        reject(error);
      };
      try {
        // Browsers send UTF-8 file names; busboy assumes latin1 otherwise.
        parser = busboy({
          headers: req.headers,
          defParamCharset: "utf8",
          // (No "parts" limit: busboy signals it on reaching the limit, not on going over.)
          limits: { fileSize: maxBytes, files: maxFiles, fields: fieldNames.length, fieldSize: 256 * 1024 },
        });
      } catch {
        return reject(new HttpError(400, "not-multipart"));
      }
      parser.on("file", (_field, stream, info) => {
        if (failed) return stream.resume();
        const file = { path: path.join(tempDir, randomUUID()), originalName: info.filename || "upload" };
        files.push(file);
        stream.on("limit", () => fail(new HttpError(413, "file-too-large", { name: file.originalName, mb: Math.round(maxBytes / 1048576) })));
        // Handled at once: a write error (a full disk) must fail this upload,
        // not crash the server as an unhandled rejection.
        const write = pipeline(stream, fs.createWriteStream(file.path, { flags: "wx" }));
        write.catch(() => fail(new HttpError(500, "store-failed", { name: file.originalName })));
        writes.push(write);
      });
      parser.on("field", (name, value, info) => {
        if (!fieldNames.includes(name) || info.valueTruncated) return fail(new HttpError(400, "unexpected-field", { name }));
        fields[name] = value;
      });
      parser.on("filesLimit", () => fail(new HttpError(413, "too-many-files", { max: maxFiles })));
      parser.on("fieldsLimit", () => fail(new HttpError(400, "unexpected-fields")));
      parser.on("error", () => fail(new HttpError(400, "malformed-upload")));
      parser.on("close", () => Promise.all(writes).then(resolve, fail));
      req.on("aborted", () => fail(new HttpError(400, "upload-aborted")));
      req.pipe(parser);
    });
    for (const file of files) {
      const metadata = await sharp(file.path).metadata().catch(() => ({}));
      const extension = FORMATS[metadata.format];
      if (!extension || !metadata.width || !metadata.height) {
        throw new HttpError(415, "not-an-image", { name: file.originalName });
      }
      // The header alone passes for a truncated file: decode the whole image
      // (sharp fails on decoder warnings and on more than 268 Mpx).
      await sharp(file.path).resize(64, 64, { fit: "inside" }).toBuffer().catch(() => {
        throw new HttpError(415, "damaged-image", { name: file.originalName });
      });
      Object.assign(file, { extension, stem: sanitizeStem(file.originalName) });
    }
    return { files, fields };
  } catch (error) {
    // Let open write streams finish (or fail) first, so none re-creates a file after it is removed.
    parser?.destroy?.();
    await Promise.allSettled(writes);
    removeTemp(files);
    throw error;
  }
}

export function removeTemp(files) {
  for (const file of files) fs.rmSync(file.path, { force: true });
}
