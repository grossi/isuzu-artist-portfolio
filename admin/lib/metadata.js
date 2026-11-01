import fs from "node:fs";
import sharp from "sharp";

// Uploads are committed to the public repo and shipped as they are (the
// originals sit next to their webp derivatives), so a photo taken with a
// phone would publish where it was taken. Every upload keeps only what it
// needs to be displayed: the image data, its colour profile and its
// animation. EXIF (location, camera, dates), XMP, IPTC/Photoshop blocks,
// thumbnails, comments, text chunks, content credentials and anything
// unknown go. (The ICC profile is kept for the colours; a profile's own
// description text is the one free-form field left.) Blocks are cut out of the file, nothing is decoded or
// re-encoded, so the pixels are untouched. Only an image that EXIF rotates
// is re-encoded, with the rotation applied, since dropping the tag would
// turn it on its side.

// metadata: what sharp read from the file (format, orientation, size, pages).
export async function stripMetadata(file, metadata) {
  const source = fs.readFileSync(file);
  let stripped = null;
  if (!metadata.orientation || metadata.orientation === 1) {
    try {
      stripped = STRIP[metadata.format](source);
      const check = await sharp(stripped, { pages: -1 }).metadata();
      if (["format", "width", "height", "pages"].some((key) => check[key] !== metadata[key])) stripped = null;
      else await sharp(stripped, { animated: true }).resize(64, 64, { fit: "inside" }).toBuffer(); // still decodes to the end
    } catch {
      stripped = null;
    }
  }
  // A rotated image, or a file the cutter doesn't understand: sharp writes
  // no metadata but the colour profile. (sharp can't rotate an animation:
  // its frames are kept as they are.)
  if (!stripped) {
    const encode = { ...ENCODE[metadata.format] };
    if (metadata.format === "webp" && source.includes("VP8L")) encode.lossless = true;
    const image = sharp(source, { animated: true });
    if (!(metadata.pages > 1)) image.rotate();
    stripped = await image.keepIccProfile().toFormat(metadata.format, encode).toBuffer();
  }
  if (!stripped.equals(source)) fs.writeFileSync(file, stripped);
}

const ENCODE = { jpeg: { quality: 95, chromaSubsampling: "4:4:4" }, png: {}, webp: { quality: 95 } };

const STRIP = {
  // Markers up to the end of the image. Kept: frame and scan headers,
  // tables, restart markers, APP0 JFIF (without its thumbnail), APP2
  // ICC_PROFILE and APP14 Adobe (colour transform). Everything else goes:
  // APP1 (EXIF, XMP), JFXX thumbnails, MPF, IPTC/Photoshop, C2PA, COM, and
  // anything after EOI (MPF's extra images, gain maps).
  jpeg(buf) {
    const isFrameOrTable = (marker) => (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc8) || marker === 0xdb || marker === 0xdd || marker === 0xda;
    const segment = (marker, body) => {
      const out = Buffer.alloc(body.length + 4);
      out.writeUInt16BE(0xff00 | marker, 0);
      out.writeUInt16BE(body.length + 2, 2);
      body.copy(out, 4);
      return out;
    };
    if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a JPEG");
    const out = [buf.subarray(0, 2)];
    let pos = 2;
    for (;;) {
      if (buf[pos] !== 0xff) throw new Error("bad marker");
      const marker = buf[pos + 1];
      if (marker === 0xff) {
        pos++; // fill byte
        continue;
      }
      if (marker === 0xd9) {
        out.push(buf.subarray(pos, pos + 2));
        return Buffer.concat(out);
      }
      if (marker >= 0xd0 && marker <= 0xd7) {
        out.push(buf.subarray(pos, pos + 2));
        pos += 2;
        continue;
      }
      const end = pos + 2 + buf.readUInt16BE(pos + 2);
      if (end > buf.length) throw new Error("truncated");
      const body = buf.subarray(pos + 4, end);
      const tag = (length) => body.toString("latin1", 0, length);
      if (isFrameOrTable(marker) || (marker === 0xdc && body.length === 2)) out.push(buf.subarray(pos, end));
      else if (marker === 0xe0 && tag(5) === "JFIF\0" && body.length >= 14) {
        // Version, units and density; no thumbnail.
        const jfif = Buffer.from(body.subarray(0, 14));
        jfif[12] = jfif[13] = 0;
        out.push(segment(marker, jfif));
      } else if ((marker === 0xe2 && tag(12) === "ICC_PROFILE\0") || (marker === 0xee && tag(5) === "Adobe")) {
        out.push(buf.subarray(pos, end));
      }
      pos = end;
      if (marker === 0xda) {
        // Entropy-coded data, up to the next marker (not a stuffed 00 or RSTn).
        const start = pos;
        while (pos + 1 < buf.length && !(buf[pos] === 0xff && buf[pos + 1] !== 0 && !(buf[pos + 1] >= 0xd0 && buf[pos + 1] <= 0xd7))) pos++;
        if (pos + 1 >= buf.length) throw new Error("no EOI");
        out.push(buf.subarray(start, pos));
      }
    }
  },

  // Chunks up to IEND, only those that affect how the image looks (APNG
  // included): no eXIf, text (XMP is iTXt), tIME, caBX (C2PA) or private
  // chunks.
  png(buf) {
    const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD", "cICP", "mDCV", "cLLI", "acTL", "fcTL", "fdAT"]);
    const out = [buf.subarray(0, 8)];
    let pos = 8;
    for (;;) {
      const end = pos + 12 + buf.readUInt32BE(pos);
      if (end > buf.length) throw new Error("truncated");
      const type = buf.toString("latin1", pos + 4, pos + 8);
      if (keep.has(type)) out.push(buf.subarray(pos, end));
      if (type === "IEND") return Buffer.concat(out);
      pos = end;
    }
  },

  // RIFF chunks: only the image, alpha, animation and ICC chunks. The VP8X
  // EXIF and XMP flags are cleared and the RIFF size fixed.
  webp(buf) {
    const keep = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);
    if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") throw new Error("not a WebP");
    const out = [];
    const riffEnd = 8 + buf.readUInt32LE(4);
    if (riffEnd > buf.length) throw new Error("truncated");
    let pos = 12;
    while (pos + 8 <= riffEnd) {
      const type = buf.toString("latin1", pos, pos + 4);
      const end = pos + 8 + buf.readUInt32LE(pos + 4) + (buf.readUInt32LE(pos + 4) % 2);
      if (end > riffEnd) throw new Error("truncated");
      if (type === "VP8X") {
        const chunk = Buffer.from(buf.subarray(pos, end));
        chunk[8] &= ~(0x08 | 0x04); // EXIF, XMP
        out.push(chunk);
      } else if (keep.has(type)) {
        out.push(buf.subarray(pos, end));
      }
      pos = end;
    }
    const body = Buffer.concat(out);
    const header = Buffer.from("RIFF0000WEBP", "latin1");
    header.writeUInt32LE(body.length + 4, 4);
    return Buffer.concat([header, body]);
  },
};
