// Splits the PSD into static "bakes" and moving layers, at half size, and
// fills the background under each moving layer (pull-push inpainting) so that
// small motions never reveal a hole.
// Usage: node extract.mjs <psd> <outDir>
import fs from "node:fs";
import path from "node:path";
import { readPsd, initializeCanvas } from "ag-psd";
import { PNG } from "pngjs";

// Plain image data, no canvas: only pixels are needed.
const imageData = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
initializeCanvas((width, height) => ({ width, height, getContext: () => ({ createImageData: imageData }) }));

const [psdPath, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

// Which "m-" layers move, and how. Names can repeat: every layer with the name moves.
// amp: pixels at the free end (in the half-size image). period: seconds.
// Every period divides 12 s, so the whole scene loops seamlessly every 12 s.
// Each layer is split into its separate pieces (a grape bunch, a clump of
// leaves), and each piece swings from its own top (hang) or bottom (sway).
// pieceKind(box): a piece's own kind, or null for a piece that stays still.
const MOTION = {
  // Grapes: slow and gentle.
  "m-ぶどう": { kind: "hang", amp: 4, period: 6 },
  "m-後ろ　ぶどう": { kind: "hang", amp: 4, period: 6 },
  // (The yellow fruits, m-実, stay still.)
  "m-手前草1": { kind: "hang", amp: 9, period: 6 },
  // Grass: about 1.8x the first sample, so the motion reads.
  "m-手前奥草": { kind: "sway", amp: 8, period: 4 },
  "m-手前草": { kind: "sway", amp: 6, period: 3 },
  "m-手前はっぱ": { kind: "sway", amp: 4.5, period: 4 },
  "m-手前奥はっぱ": { kind: "sway", amp: 4.5, period: 6 },
  "m-長草": { kind: "sway", amp: 9, period: 3 },
  "m-長草奥": { kind: "sway", amp: 7, period: 4 },
  "m-長草手前": { kind: "sway", amp: 7, period: 3 },
  "m-もこ緑": { kind: "sway", amp: 3.5, period: 6 },
  // The big leaves at the top, around the grapes and behind them: larger.
  "m-つた上葉": { kind: "hang", amp: 7, period: 6 },
  "m-つた　中葉": { kind: "hang", amp: 7, period: 4 },
  "m-つた　中葉2": { kind: "hang", amp: 6, period: 6 },
  "m-後ろ　手前　上葉": { kind: "hang", amp: 6, period: 6 },
  // Behind the grapes. The pieces by the left character's face stay still;
  // the big piece reaching down to her head is held at both ends.
  "m-後ろ　手前　中葉": { kind: "hang", amp: 6, period: 4, pieceKind: (b) => (b.y > 450 ? null : b.h > 500 ? "bow" : "hang") },
  // The fluffy fern in the middle: a little.
  "m-後ろ　手前　中葉もしゃ": { kind: "hang", amp: 3, period: 6 },
  // Light: floats like fireflies.
  "m-光": { kind: "float", amp: 18, period: 12 },
};
const NEEDS_FILL = new Set(["hang", "sway", "flap"]);

const t0 = Date.now();
const psd = readPsd(fs.readFileSync(psdPath), { useImageData: true, skipThumbnail: true });
console.log(`read ${psd.width}x${psd.height} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const W = Math.ceil(psd.width / 2);
const H = Math.ceil(psd.height / 2);

// A layer as a premultiplied Float32 RGBA buffer at half size, on the whole canvas.
function layerBuffer(layer) {
  const buf = new Float32Array(W * H * 4);
  const img = layer.imageData;
  if (!img) return null;
  const lw = img.width;
  const lh = img.height;
  const opacity = layer.opacity ?? 1;
  const mask = layer.mask && !layer.mask.disabled ? layer.mask : null;
  const maskAt = (x, y) => {
    if (!mask) return 1;
    const mi = mask.imageData;
    const mx = x - mask.left;
    const my = y - mask.top;
    if (!mi || mx < 0 || my < 0 || mx >= mi.width || my >= mi.height) return (mask.defaultColor ?? 255) / 255;
    return mi.data[(my * mi.width + mx) * 4] / 255;
  };
  for (let y = 0; y < lh; y++) {
    const cy = y + layer.top;
    if (cy < 0 || cy >= psd.height) continue;
    const hy = cy >> 1;
    for (let x = 0; x < lw; x++) {
      const cx = x + layer.left;
      if (cx < 0 || cx >= psd.width) continue;
      const s = (y * lw + x) * 4;
      const a = (img.data[s + 3] / 255) * opacity * maskAt(cx, cy);
      if (a <= 0) continue;
      const d = (hy * W + (cx >> 1)) * 4;
      buf[d] += (img.data[s] / 255) * a * 0.25;
      buf[d + 1] += (img.data[s + 1] / 255) * a * 0.25;
      buf[d + 2] += (img.data[s + 2] / 255) * a * 0.25;
      buf[d + 3] += a * 0.25;
    }
  }
  return buf;
}

// dst = src over dst (premultiplied).
function over(dst, src) {
  for (let i = 0; i < dst.length; i += 4) {
    const a = src[i + 3];
    if (a <= 0) continue;
    const k = 1 - a;
    dst[i] = src[i] + dst[i] * k;
    dst[i + 1] = src[i + 1] + dst[i + 1] * k;
    dst[i + 2] = src[i + 2] + dst[i + 2] * k;
    dst[i + 3] = a + dst[i + 3] * k;
  }
}

function bbox(buf, threshold = 1 / 512) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (buf[(y * W + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Fills the pixels under a moving layer (its footprint, grown by `grow`) from
// the colors around them, in `below` (opaque premultiplied), by pull-push.
// Returns the fill as a buffer that is opaque on the footprint only.
function fillUnder(below, mover, grow = 3) {
  const box = bbox(mover);
  const m = 48;
  const bx = Math.max(0, box.x - m), by = Math.max(0, box.y - m);
  const bw = Math.min(W, box.x + box.w + m) - bx, bh = Math.min(H, box.y + box.h + m) - by;
  // Footprint mask, grown so edge pixels (blended with the mover) count as unknown.
  const foot = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (mover[((y + by) * W + x + bx) * 4 + 3] > 1 / 255) foot[y * bw + x] = 1;
  let grown = foot;
  for (let g = 0; g < grow; g++) {
    const next = grown.slice();
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      if (grown[y * bw + x]) continue;
      if ((x > 0 && grown[y * bw + x - 1]) || (x < bw - 1 && grown[y * bw + x + 1]) || (y > 0 && grown[(y - 1) * bw + x]) || (y < bh - 1 && grown[(y + 1) * bw + x])) next[y * bw + x] = 1;
    }
    grown = next;
  }
  // Level 0: known colors (weight 1) outside the footprint.
  const levels = [];
  let lw = bw, lh = bh;
  let col = new Float32Array(lw * lh * 3);
  let wt = new Float32Array(lw * lh);
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const i = y * lw + x;
    if (grown[i]) continue;
    const s = ((y + by) * W + x + bx) * 4;
    const a = below[s + 3] || 1;
    col[i * 3] = below[s] / a;
    col[i * 3 + 1] = below[s + 1] / a;
    col[i * 3 + 2] = below[s + 2] / a;
    wt[i] = 1;
  }
  levels.push({ col, wt, lw, lh });
  // Pull: average known pixels into coarser levels.
  while (lw > 1 || lh > 1) {
    const nw = Math.max(1, Math.ceil(lw / 2)), nh = Math.max(1, Math.ceil(lh / 2));
    const ncol = new Float32Array(nw * nh * 3), nwt = new Float32Array(nw * nh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const i = y * lw + x, j = (y >> 1) * nw + (x >> 1);
      const w = wt[i];
      if (!w) continue;
      ncol[j * 3] += col[i * 3] * w;
      ncol[j * 3 + 1] += col[i * 3 + 1] * w;
      ncol[j * 3 + 2] += col[i * 3 + 2] * w;
      nwt[j] += w;
    }
    for (let j = 0; j < nw * nh; j++) if (nwt[j]) {
      ncol[j * 3] /= nwt[j];
      ncol[j * 3 + 1] /= nwt[j];
      ncol[j * 3 + 2] /= nwt[j];
      nwt[j] = Math.min(1, nwt[j]);
    }
    col = ncol; wt = nwt; lw = nw; lh = nh;
    levels.push({ col, wt, lw, lh });
  }
  // Push: fill unknown pixels from the coarser level (bilinear).
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], coarse = levels[l + 1];
    for (let y = 0; y < fine.lh; y++) for (let x = 0; x < fine.lw; x++) {
      const i = y * fine.lw + x;
      const w = fine.wt[i];
      if (w >= 1) continue;
      const fx = Math.min(coarse.lw - 1, Math.max(0, (x - 0.5) / 2)), fy = Math.min(coarse.lh - 1, Math.max(0, (y - 0.5) / 2));
      const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(coarse.lw - 1, x0 + 1), y1 = Math.min(coarse.lh - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      for (let c = 0; c < 3; c++) {
        const v = (coarse.col[(y0 * coarse.lw + x0) * 3 + c] * (1 - ax) + coarse.col[(y0 * coarse.lw + x1) * 3 + c] * ax) * (1 - ay) +
          (coarse.col[(y1 * coarse.lw + x0) * 3 + c] * (1 - ax) + coarse.col[(y1 * coarse.lw + x1) * 3 + c] * ax) * ay;
        fine.col[i * 3 + c] = fine.col[i * 3 + c] * w + v * (1 - w);
      }
      fine.wt[i] = 1;
    }
  }
  const fill = new Float32Array(W * H * 4);
  const top = levels[0];
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = y * bw + x;
    const d = ((y + by) * W + x + bx) * 4;
    // Only under the layer's solid parts: they hide what's below at rest, so
    // the still picture is unchanged. Under its see-through parts the painting
    // below shows, as drawn.
    if (mover[d + 3] < 0.85) continue;
    fill[d] = top.col[i * 3];
    fill[d + 1] = top.col[i * 3 + 1];
    fill[d + 2] = top.col[i * 3 + 2];
    fill[d + 3] = 1;
  }
  return fill;
}

// The layer's separate pieces: pixels within `reach` of each other belong to
// one piece. Tiny pieces (stray specks) join one leftover piece. Returns
// whole-canvas buffers.
function pieces(buf, reach = 4, minArea = 300) {
  const box = bbox(buf);
  const { x: bx, y: by, w: bw, h: bh } = box;
  const solid = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (buf[((y + by) * W + x + bx) * 4 + 3] > 0.05) solid[y * bw + x] = 1;
  // Grow by `reach` (a square), so nearby bits connect.
  const grown = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!solid[y * bw + x]) continue;
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && xx >= 0 && yy < bh && xx < bw) grown[yy * bw + xx] = 1;
    }
  }
  const label = new Int32Array(bw * bh);
  let count = 0;
  const stack = [];
  for (let i = 0; i < bw * bh; i++) {
    if (!grown[i] || label[i]) continue;
    label[i] = ++count;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop();
      const x = j % bw, y = (j / bw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
        const k = yy * bw + xx;
        if (grown[k] && !label[k]) {
          label[k] = count;
          stack.push(k);
        }
      }
    }
  }
  const area = new Int32Array(count + 1);
  for (let i = 0; i < bw * bh; i++) if (solid[i]) area[label[i]]++;
  // Each piece: its box and which canvas pixels are its own.
  const owner = (i) => (label[i] && area[label[i]] >= minArea ? label[i] : 0);
  const boxes = new Map(); // label (0: leftovers) -> box
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const i = y * bw + x;
    if (buf[((y + by) * W + x + bx) * 4 + 3] <= 0) continue;
    const l = owner(i);
    const b = boxes.get(l) ?? { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
    b.x0 = Math.min(b.x0, x + bx); b.y0 = Math.min(b.y0, y + by);
    b.x1 = Math.max(b.x1, x + bx); b.y1 = Math.max(b.y1, y + by);
    boxes.set(l, b);
  }
  return [...boxes].map(([l, b]) => ({
    box: { x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 },
    has: (cx, cy) => owner((cy - by) * bw + (cx - bx)) === l,
  }));
}

// has(x, y): which pixels to keep (all when absent).
function writePng(buf, file, box, has) {
  const png = new PNG({ width: box.w, height: box.h });
  for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) {
    const s = ((y + box.y) * W + x + box.x) * 4, d = (y * box.w + x) * 4;
    const a = has && !has(x + box.x, y + box.y) ? 0 : buf[s + 3];
    const k = a > 0 ? 1 / a : 0;
    png.data[d] = Math.round(Math.min(1, buf[s] * k) * 255);
    png.data[d + 1] = Math.round(Math.min(1, buf[s + 1] * k) * 255);
    png.data[d + 2] = Math.round(Math.min(1, buf[s + 2] * k) * 255);
    png.data[d + 3] = Math.round(Math.min(1, a) * 255);
  }
  fs.writeFileSync(path.join(outDir, file), PNG.sync.write(png));
}

const below = new Float32Array(W * H * 4); // everything so far, movers at rest
const under = new Float32Array(W * H * 4); // static layers only: what the artist painted under the movers
let bake = new Float32Array(W * H * 4);
const parts = [];
let n = 0;
function emitBake() {
  const box = bbox(bake);
  if (box) {
    const file = `s${String(n++).padStart(3, "0")}.png`;
    writePng(bake, file, box);
    parts.push({ type: "static", file, ...box });
  }
  bake = new Float32Array(W * H * 4);
}

const flat = [];
(function walk(layers) {
  for (const l of layers ?? []) {
    if (l.children) walk(l.children);
    else if (!l.hidden) flat.push(l);
  }
})(psd.children);

for (const layer of flat) {
  const buf = layerBuffer(layer);
  if (!buf) continue;
  const motion = MOTION[layer.name];
  if (!motion) {
    over(bake, buf);
    over(below, buf);
    over(under, buf);
    continue;
  }
  if (NEEDS_FILL.has(motion.kind)) {
    const fill = fillUnder(below, buf);
    over(bake, fill);
    over(below, fill);
  }
  emitBake();
  // Grass sways in one wind (one phase per layer); hanging things each swing
  // a little out of step.
  const layerPhase = (n * 2.399) % 6.283;
  // Light: every dot on its own, so each moves whole and keeps its size.
  const split = motion.kind === "float" ? pieces(buf, 1, 1) : pieces(buf);
  let still = 0;
  split.forEach(({ box, has }, k) => {
    const kind = motion.pieceKind ? motion.pieceKind(box) : motion.kind;
    if (!kind) {
      // Stays still: drawn with the static parts that follow.
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
        if (!has(x, y)) continue;
        const i = (y * W + x) * 4;
        const a = buf[i + 3], q = 1 - a;
        bake[i] = buf[i] + bake[i] * q; bake[i + 1] = buf[i + 1] + bake[i + 1] * q;
        bake[i + 2] = buf[i + 2] + bake[i + 2] * q; bake[i + 3] = a + bake[i + 3] * q;
      }
      still++;
      return;
    }
    const file = `m${String(n++).padStart(3, "0")}.png`;
    writePng(buf, file, box, has);
    // Each piece a little different: hanging things swing out of step; grass
    // keeps one wind, with clumps swaying a little more or less, a bit apart.
    const f = (k * 1.618) % 1;
    const phase = layerPhase + (kind === "sway" ? (f - 0.5) * 1.2 : kind === "float" ? f * 6.283 : (f - 0.5) * 1.6);
    const amp = motion.amp * (kind === "sway" ? 0.7 + 0.6 * ((k * 2.414) % 1) : 1);
    parts.push({ type: "mover", name: layer.name, file, ...box, ...motion, kind, amp, phase });
  });
  over(below, buf);
  console.log(`${layer.name}: ${split.length} piece(s)${still ? `, ${still} still` : ""} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
emitBake();

// The flattened result at rest, to compare with the PSD's own composite.
writePng(below, "rest.png", { x: 0, y: 0, w: W, h: H });
writePng(under, "under.png", { x: 0, y: 0, w: W, h: H });
if (psd.imageData) {
  const ref = new Float32Array(W * H * 4);
  over(ref, layerBuffer({ imageData: psd.imageData, left: 0, top: 0, opacity: 1 }));
  writePng(ref, "reference.png", { x: 0, y: 0, w: W, h: H });
}
fs.writeFileSync(path.join(outDir, "scene.json"), JSON.stringify({ width: W, height: H, parts }, null, 1));
console.log(`done: ${parts.length} parts in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
