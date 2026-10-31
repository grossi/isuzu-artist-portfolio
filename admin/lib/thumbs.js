import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SIZE = 480;
const inFlight = new Map();

// A small webp of source, cached in cacheDir by path, size and mtime.
export async function thumbnail(source, cacheDir) {
  const stat = fs.statSync(source);
  const key = createHash("sha1").update(`${source}\0${stat.size}\0${stat.mtimeMs}`).digest("hex");
  const file = path.join(cacheDir, `${key}.webp`);
  if (fs.existsSync(file)) return file;
  if (!inFlight.has(key)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    const job = sharp(source)
      .resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(temp)
      .then(() => fs.renameSync(temp, file))
      .finally(() => inFlight.delete(key));
    inFlight.set(key, job);
  }
  await inFlight.get(key);
  return file;
}
