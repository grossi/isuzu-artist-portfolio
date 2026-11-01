import fs from "node:fs";
import sharp from "sharp";

// Uploads are committed to the public repo and shipped as they are (the
// originals sit next to their webp derivatives), so a photo taken with a
// phone would publish where it was taken. Every upload loses its EXIF
// (location, camera, dates, thumbnails), XMP, IPTC/Photoshop blocks,
// comments and text chunks. The pixels and the colour profile are untouched:
// metadata blocks are cut out of the file, nothing is decoded or re-encoded.
// Only an image that EXIF rotates is re-encoded, with the rotation applied,
// since dropping the tag would turn it on its side.

// metadata: what sharp read from the file (format, orientation, size).
export async function stripMetadata(file, metadata) {
  const source = fs.readFileSync(file);
  let stripped = null;
  if (!metadata.orientation || metadata.orientation === 1) {
    try {
      stripped = STRIP[metadata.format](source);
      const check = await sharp(stripped).metadata();
      if (check.format !== metadata.format || check.width !== metadata.width || check.height !== metadata.height) stripped = null;
      else await sharp(stripped).resize(64, 64, { fit: "inside" }).toBuffer(); // still decodes to the end
    } catch {
      stripped = null;
    }
  }
  // A rotated image, or a file the cutter doesn't understand: sharp writes
  // no metadata but the colour profile.
  if (!stripped) stripped = await sharp(source).rotate().keepIccProfile().toFormat(metadata.format, ENCODE[metadata.format]).toBuffer();
  if (!stripped.equals(source)) fs.writeFileSync(file, stripped);
}

const ENCODE = { jpeg: { quality: 95, chromaSubsampling: "4:4:4" }, png: {}, webp: { quality: 95 } };

const STRIP = {
  // Markers up to the end of the image: drops APP1 (EXIF, XMP), APP2 other
  // than the ICC profile (MPF), APP3-APP13 (IPTC, Photoshop), APP15, COM,
  // and anything after EOI (MPF's extra images, gain maps).
  jpeg(buf) {
    const keep = (marker, body) =>
      !((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) ||
      (marker === 0xe0 && /^JF(IF|XX)\0/.test(body.toString("latin1", 0, 5))) ||
      (marker === 0xe2 && body.toString("latin1", 0, 12) === "ICC_PROFILE\0") ||
      (marker === 0xee && body.toString("latin1", 0, 5) === "Adobe");
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
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        out.push(buf.subarray(pos, pos + 2));
        pos += 2;
        continue;
      }
      const end = pos + 2 + buf.readUInt16BE(pos + 2);
      if (end > buf.length) throw new Error("truncated");
      if (keep(marker, buf.subarray(pos + 4, end))) out.push(buf.subarray(pos, end));
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

  // Chunks up to IEND: drops eXIf, tEXt, zTXt, iTXt (XMP) and tIME.
  png(buf) {
    const drop = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
    const out = [buf.subarray(0, 8)];
    let pos = 8;
    for (;;) {
      const end = pos + 12 + buf.readUInt32BE(pos);
      if (end > buf.length) throw new Error("truncated");
      const type = buf.toString("latin1", pos + 4, pos + 8);
      if (!drop.has(type)) out.push(buf.subarray(pos, end));
      if (type === "IEND") return Buffer.concat(out);
      pos = end;
    }
  },

  // RIFF chunks: drops EXIF and XMP, clears their VP8X flags and fixes the
  // RIFF size.
  webp(buf) {
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
      } else if (type !== "EXIF" && type !== "XMP ") {
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
