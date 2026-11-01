import fs from "node:fs";
import sharp from "sharp";

// Uploads are committed to the public repo and shipped as they are (the
// originals sit next to their webp derivatives), so a photo taken with a
// phone would publish where it was taken. Every upload keeps only what it
// needs to be displayed: the image data, its colour profile and a WebP's
// animation. EXIF (location, camera, dates), XMP, IPTC/Photoshop blocks,
// thumbnails, comments, text chunks, content credentials and anything
// unknown go. (The ICC profile is kept for the colours; a profile's own
// description text is the one free-form field left.) Blocks are cut out of
// the file, nothing is decoded or re-encoded, so the pixels are untouched.
// Only an image that EXIF rotates is re-encoded, with the rotation applied,
// since dropping the tag would turn it on its side.

// metadata: what sharp read from the file (format, orientation, size, pages).
export async function stripMetadata(file, metadata) {
  const source = fs.readFileSync(file);
  let stripped = null;
  if (!metadata.orientation || metadata.orientation === 1) {
    try {
      stripped = STRIP[metadata.format](source);
      const check = await sharp(stripped).metadata(); // one frame's size, and the frame count
      if (["format", "width", "height", "pages"].some((key) => check[key] !== metadata[key]) || check.exif || check.xmp || check.iptc) stripped = null;
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
  // ICC_PROFILE and APP14 Adobe (its 12 bytes: the colour transform).
  // Everything else goes: APP1 (EXIF, XMP), JFXX thumbnails, MPF,
  // IPTC/Photoshop, C2PA, COM, and anything after EOI (MPF's extra images,
  // gain maps).
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
      } else if (marker === 0xee && tag(5) === "Adobe" && body.length >= 12) {
        out.push(segment(marker, body.subarray(0, 12))); // version, flags, colour transform
      } else if (marker === 0xe2 && tag(12) === "ICC_PROFILE\0") {
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

  // Chunks up to IEND, only those that affect how the image looks: no eXIf,
  // text (XMP is iTXt), tIME, caBX (C2PA) or private chunks. An APNG keeps
  // only its still image: sharp decodes nothing else, so the other frames
  // could never be checked (and the site only shows stills).
  png(buf) {
    const keep = new Set(["IHDR", "PLTE", "IDAT", "IEND", "tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "pHYs", "bKGD", "cICP", "mDCV", "cLLI"]);
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

  // RIFF chunks, only where the format reads them: a simple file's one image
  // chunk; in an extended one, the ICC profile if flagged, then either the
  // animation (inside each frame only its image and alpha) or one image with
  // its alpha. The VP8X EXIF and XMP flags are cleared and the sizes fixed.
  webp(buf) {
    const isImage = (type) => type === "VP8 " || type === "VP8L";
    const chunks = (start, end) => {
      const list = [];
      for (let pos = start; pos + 8 <= end; ) {
        const size = buf.readUInt32LE(pos + 4);
        const next = pos + 8 + size + (size % 2);
        if (next > end) throw new Error("truncated");
        list.push({ type: buf.toString("latin1", pos, pos + 4), chunk: buf.subarray(pos, next) });
        pos = next;
      }
      return list;
    };
    const chunk = (type, body) => {
      const header = Buffer.from(`${type}0000`, "latin1");
      header.writeUInt32LE(body.length, 4);
      return Buffer.concat([header, body]);
    };
    if (buf.toString("latin1", 0, 4) !== "RIFF" || buf.toString("latin1", 8, 12) !== "WEBP") throw new Error("not a WebP");
    const riffEnd = 8 + buf.readUInt32LE(4);
    if (riffEnd > buf.length) throw new Error("truncated");
    const all = chunks(12, riffEnd);
    const out = [];
    if (all[0]?.type !== "VP8X") {
      const image = all.find((c) => isImage(c.type));
      if (!image) throw new Error("no image");
      out.push(image.chunk);
    } else {
      const flags = all[0].chunk[8];
      const vp8x = Buffer.from(all[0].chunk);
      vp8x[8] &= ~(0x08 | 0x04); // EXIF, XMP
      out.push(vp8x);
      const icc = all.find((c) => c.type === "ICCP");
      if (flags & 0x20 && icc) out.push(icc.chunk);
      if (flags & 0x02) {
        for (const { type, chunk: data } of all) {
          if (type === "ANIM") out.push(data);
          else if (type === "ANMF") {
            // A 16-byte frame header (position, size, duration, flags), then the frame's chunks.
            const offset = data.byteOffset - buf.byteOffset;
            const frame = chunks(offset + 24, offset + data.length).filter((c) => isImage(c.type) || c.type === "ALPH");
            out.push(chunk("ANMF", Buffer.concat([data.subarray(8, 24), ...frame.map((c) => c.chunk)])));
          }
        }
      } else {
        const at = all.findIndex((c) => isImage(c.type));
        if (at === -1) throw new Error("no image");
        const alpha = all.slice(0, at).find((c) => c.type === "ALPH");
        if (alpha) out.push(alpha.chunk);
        out.push(all[at].chunk);
      }
    }
    return chunk("RIFF", Buffer.concat([Buffer.from("WEBP", "latin1"), ...out]));
  },
};
