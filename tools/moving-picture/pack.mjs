// Packs extract.mjs's output (scene.json + PNGs) for the web:
// - base.webp: the picture where nothing moves, and under the moving areas
//   only what lies below every moving part;
// - atlas*.webp: every other piece (moving parts, and the still parts drawn
//   over moving ones, cut to the moving areas), packed on one or two sheets;
// - still.webp: the picture at rest, shown first and when motion is off;
// - scene.json: the draw order, with each piece's place on its sheet.
// Usage: node pack.mjs <extractOut> <webOut>
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import sharp from "sharp";

const [src, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const scene = JSON.parse(fs.readFileSync(path.join(src, "scene.json"), "utf8"));
const { width: W, height: H } = scene;
const read = (f) => PNG.sync.read(fs.readFileSync(path.join(src, f)));
const margin = (p) => Math.ceil(p.amp * 1.6 + 4);

// The base: at each pixel, everything below the first moving part that can
// reach it (its box grown by how far it moves); where nothing moves, the
// whole picture. A still part is drawn on its own only where it lies over a
// moving part's reach ("covered" by an earlier mover); elsewhere it is
// already in the base.
const rest0 = read("rest.png");
const C = new Float32Array(W * H * 4); // the picture so far, premultiplied
const covered = new Uint8Array(W * H);
const base = Buffer.alloc(W * H * 4);
const freeze = (i) => {
  const a = C[i * 4 + 3];
  const k = a > 0 ? 255 / a : 0;
  base[i * 4] = Math.round(C[i * 4] * k);
  base[i * 4 + 1] = Math.round(C[i * 4 + 1] * k);
  base[i * 4 + 2] = Math.round(C[i * 4 + 2] * k);
  base[i * 4 + 3] = Math.round(a * 255);
};
const drawOver = (p, img) => {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const s = (y * p.w + x) * 4;
    const a = img.data[s + 3] / 255;
    if (!a) continue;
    const d = ((y + p.y) * W + x + p.x) * 4, q = 1 - a;
    for (let c = 0; c < 3; c++) C[d + c] = (img.data[s + c] / 255) * a + C[d + c] * q;
    C[d + 3] = a + C[d + 3] * q;
  }
};

// Pieces to pack, in draw order.
const pieces = [];
for (const p of scene.parts) {
  const img = read(p.file);
  if (p.type === "mover") {
    const m = margin(p);
    for (let y = Math.max(0, p.y - m); y < Math.min(H, p.y + p.h + m); y++) {
      for (let x = Math.max(0, p.x - m); x < Math.min(W, p.x + p.w + m); x++) {
        const i = y * W + x;
        if (!covered[i]) { covered[i] = 1; freeze(i); }
      }
    }
    drawOver(p, img);
    pieces.push({ part: p, img, w: p.w, h: p.h });
    continue;
  }
  drawOver(p, img);
  // A still part: only where an earlier moving part reaches, split into bits.
  const keep = new Uint8Array(p.w * p.h);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (img.data[(y * p.w + x) * 4 + 3] && covered[(y + p.y) * W + x + p.x]) keep[y * p.w + x] = 1;
  }
  // Still bits wider than 1024 px are cut into strips, to fit the sheets.
  const boxes = components(keep, p.w, p.h).flatMap((b) =>
    Array.from({ length: Math.ceil(b.w / 1024) }, (_, k) => ({ x: b.x + k * 1024, y: b.y, w: Math.min(1024, b.w - k * 1024), h: b.h })),
  );
  for (const box of boxes) {
    const bit = new PNG({ width: box.w, height: box.h });
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
      const s = ((y + box.y) * p.w + x + box.x) * 4, d = (y * box.w + x) * 4;
      if (keep[(y + box.y) * p.w + x + box.x]) img.data.copy(bit.data, d, s, s + 4);
    }
    pieces.push({ part: { type: "static", x: p.x + box.x, y: p.y + box.y, w: box.w, h: box.h }, img: bit, w: box.w, h: box.h });
  }
}

for (let i = 0; i < W * H; i++) if (!covered[i]) freeze(i);

// Boxes of the separate bits of a mask (bits within 8 px join).
function components(mask, w, h) {
  const reach = 8;
  const cell = (x, y) => Math.floor(y / reach) * Math.ceil(w / reach) + Math.floor(x / reach);
  const cw = Math.ceil(w / reach), ch = Math.ceil(h / reach);
  const used = new Uint8Array(cw * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) used[cell(x, y)] = 1;
  const seen = new Uint8Array(cw * ch);
  const boxes = [];
  for (let c = 0; c < cw * ch; c++) {
    if (!used[c] || seen[c]) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    const stack = [c];
    seen[c] = 1;
    while (stack.length) {
      const k = stack.pop();
      const cx = k % cw, cy = (k / cw) | 0;
      x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
        const n = ny * cw + nx;
        if (used[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    // Tighten to the pixels.
    let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
    for (let y = y0 * reach; y < Math.min(h, (y1 + 1) * reach); y++) for (let x = x0 * reach; x < Math.min(w, (x1 + 1) * reach); x++) {
      if (!mask[y * w + x]) continue;
      bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
    }
    if (bx1 >= 0) boxes.push({ x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 });
  }
  return boxes;
}

// Shelf packing onto sheets 2048 wide, at most 4096 tall, 2 px apart.
const SHEET_W = 2048, SHEET_MAX = 4096, PAD = 2;
const order = pieces.map((p, i) => i).sort((a, b) => pieces[b].h - pieces[a].h);
const sheets = [];
let sheet = null;
for (const i of order) {
  const p = pieces[i];
  if (p.w + PAD > SHEET_W) throw new Error(`piece too wide: ${p.w}`);
  if (!sheet || (sheet.x + p.w + PAD > SHEET_W && sheet.y + sheet.shelf + p.h + PAD > SHEET_MAX)) {
    sheet = { x: 0, y: 0, shelf: 0, h: 0, items: [] };
    sheets.push(sheet);
  }
  if (sheet.x + p.w + PAD > SHEET_W) {
    sheet.y += sheet.shelf + PAD;
    sheet.x = 0;
    sheet.shelf = 0;
  }
  p.sheet = sheets.length - 1;
  p.sx = sheet.x;
  p.sy = sheet.y;
  sheet.x += p.w + PAD;
  sheet.shelf = Math.max(sheet.shelf, p.h);
  sheet.h = Math.max(sheet.h, sheet.y + p.h);
  sheet.items.push(p);
}

const webp = (raw, w, h, quality, file) =>
  sharp(raw, { raw: { width: w, height: h, channels: 4 } }).webp({ quality, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(path.join(out, file));

const atlases = [];
for (const [k, s] of sheets.entries()) {
  const h = s.h + PAD;
  const buf = Buffer.alloc(SHEET_W * h * 4);
  for (const p of s.items) {
    for (let y = 0; y < p.h; y++) p.img.data.copy(buf, ((p.sy + y) * SHEET_W + p.sx) * 4, y * p.w * 4, (y + 1) * p.w * 4);
  }
  const file = `atlas${k}.webp`;
  await webp(buf, SHEET_W, h, 92, file);
  atlases.push({ file, width: SHEET_W, height: h });
}
await webp(base, W, H, 90, "base.webp");
await webp(rest0.data, W, H, 88, "still.webp");

const parts = pieces.map((p) => {
  const { type, x, y, w, h, kind, amp, period, phase } = p.part;
  return type === "mover" ? { type, x, y, w, h, sheet: p.sheet, sx: p.sx, sy: p.sy, kind, amp, period, phase } : { type, x, y, w, h, sheet: p.sheet, sx: p.sx, sy: p.sy };
});
// loop: the motions repeat every `loop` seconds of scene time, played
// `speed` times as fast. version: a hash of the base and the sheets. The site
// loads them with ?v=<version>, so after a new export a browser never mixes
// sheets it cached (images are cached for a week) with the new scene.json
// (never cached).
const hash = crypto.createHash("sha256");
for (const file of ["base.webp", ...atlases.map((a) => a.file)]) hash.update(fs.readFileSync(path.join(out, file)));
const version = hash.digest("hex").slice(0, 12);
fs.writeFileSync(path.join(out, "scene.json"), JSON.stringify({ width: W, height: H, loop: 12, speed: 12 / 7, base: "base.webp", still: "still.webp", version, atlases, parts }));
const size = fs.readdirSync(out).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
console.log(`${parts.length} parts on ${atlases.length} sheet(s) (${atlases.map((a) => `${a.width}x${a.height}`).join(", ")}), ${(size / 1e6).toFixed(2)} MB in all`);
