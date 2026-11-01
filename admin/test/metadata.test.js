import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { after, test } from "node:test";
import sharp from "sharp";
import { stripMetadata } from "../lib/metadata.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "isuzu-metadata-test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:exif="http://ns.adobe.com/exif/1.0/" exif:GPSLatitude="35,41.0N"/></rdf:RDF></x:xmpmeta>';
const GPS = { IFD0: { Copyright: "someone", Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "35/1 41/1 0/1" } };
// A noisy picture, so a re-encode would change pixels.
const noise = (width, height) => {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 7919) % 251;
  return sharp(pixels, { raw: { width, height, channels: 3 } });
};

async function strip(name, image) {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, image);
  await stripMetadata(file, await sharp(file).metadata());
  return fs.readFileSync(file);
}
const pixels = (image) => sharp(image).raw().toBuffer();
// A JPEG marker segment.
const segment = (marker, body) => {
  const head = Buffer.from([0xff, marker, 0, 0]);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};

for (const format of ["jpeg", "png", "webp"]) {
  test(`${format}: EXIF (with GPS) and XMP are cut out; pixels and colour profile are untouched`, async () => {
    const image = await noise(64, 48).withIccProfile("p3").withExif(GPS).withXmp(XMP).toFormat(format).toBuffer();
    const before = await sharp(image).metadata();
    assert.ok(before.exif && before.xmp && before.icc, "the fixture has metadata");

    const stripped = await strip(`a.${format}`, image);
    const meta = await sharp(stripped).metadata();
    assert.equal(meta.exif, undefined);
    assert.equal(meta.xmp, undefined);
    assert.ok(!stripped.includes("GPSLatitude") && !stripped.includes("someone"));
    assert.deepEqual(meta.icc, before.icc);
    assert.deepEqual([meta.format, meta.width, meta.height], [format, 64, 48]);
    assert.ok((await pixels(stripped)).equals(await pixels(image)));
    // Not re-encoded: the compressed image data is the original's.
    const data = { jpeg: [0xff, 0xda], png: "IDAT", webp: "VP8 " }[format];
    const at = image.indexOf(Buffer.from(data));
    assert.ok(stripped.includes(image.subarray(at, at + 200)), "re-encoded");
  });

  test(`${format}: an image without metadata is left byte for byte`, async () => {
    const image = await noise(30, 20).toFormat(format).toBuffer();
    assert.ok((await strip(`plain.${format}`, image)).equals(image));
  });

  test(`${format}: an EXIF rotation is applied before the tag goes`, async () => {
    const image = await noise(40, 20).withMetadata({ orientation: 6 }).withExif(GPS).toFormat(format).toBuffer();
    const meta = await sharp(await strip(`rotated.${format}`, image)).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height, meta.exif, meta.orientation], [format, 20, 40, undefined, undefined]);
  });
}

test("jpeg: comments, Photoshop/IPTC blocks and data after the end of the image go", async () => {
  const image = await noise(32, 32).jpeg({ progressive: true }).toBuffer();
  const tagged = Buffer.concat([
    image.subarray(0, 2),
    segment(0xfe, Buffer.from("taken at home")),
    segment(0xed, Buffer.from("Photoshop 3.0\0IPTC by-line someone", "latin1")),
    image.subarray(2),
    Buffer.from("trailing gain map with GPSLatitude"),
  ]);
  const stripped = await strip("tagged.jpg", tagged);
  assert.ok(stripped.equals(image));
});

test("jpeg: JFXX and JFIF thumbnails and C2PA go", async () => {
  const image = await noise(32, 32).jpeg().toBuffer();
  const jfif = Buffer.from("JFIF\0\x01\x02\0\0\x01\0\x01\0\0", "latin1"); // 1:1 aspect, no thumbnail
  const jfifWithThumb = Buffer.concat([jfif.subarray(0, 12), Buffer.from([2, 2]), Buffer.alloc(2 * 2 * 3, 0x41)]);
  const tagged = Buffer.concat([
    image.subarray(0, 2),
    segment(0xe0, jfifWithThumb),
    segment(0xe0, Buffer.concat([Buffer.from("JFXX\0\x13", "latin1"), Buffer.alloc(64, 0x42)])),
    segment(0xeb, Buffer.from("JP\0\0c2pa creator someone", "latin1")),
    image.subarray(2),
  ]);
  const stripped = await strip("thumbs.jpg", tagged);
  assert.ok(stripped.equals(Buffer.concat([image.subarray(0, 2), segment(0xe0, jfif), image.subarray(2)])));
});

test("png and webp: only the chunks that draw the image stay", async () => {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4, "latin1");
    data.copy(out, 8);
    return out; // the CRC isn't checked for ancillary chunks we drop
  };
  const png = await noise(16, 16).png().toBuffer();
  const taggedPng = Buffer.concat([png.subarray(0, 33), chunk("caBX", Buffer.from("c2pa someone")), chunk("prVW", Buffer.from("preview")), png.subarray(33)]);
  assert.ok((await strip("tagged.png", taggedPng)).equals(png));

  const webp = await noise(16, 16).withExif(GPS).webp().toBuffer();
  const riff = (body) => {
    const header = Buffer.from("RIFF0000WEBP", "latin1");
    header.writeUInt32LE(body.length + 4, 4);
    return Buffer.concat([header, body]);
  };
  const extra = Buffer.from("C2PA\x0c\0\0\0c2pa someoneexif\x04\0\0\0GPS!", "latin1");
  const stripped = await strip("tagged.webp", riff(Buffer.concat([webp.subarray(12), extra])));
  assert.ok(!stripped.includes("someone") && !stripped.includes("GPS"));
  assert.equal((await sharp(stripped).metadata()).exif, undefined);
  assert.ok((await pixels(stripped)).equals(await pixels(webp)));
});

test("animated webp keeps its frames, even when it needs a re-encode", async () => {
  const frames = await noise(20, 40).webp().toBuffer();
  const animated = await sharp([frames, await noise(20, 40).negate().webp().toBuffer()], { join: { animated: true } }).withExif(GPS).webp({ lossless: true }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  for (const [name, image] of [["anim.webp", animated], ["anim-rotated.webp", await sharp(animated, { animated: true }).withMetadata({ orientation: 6 }).webp({ lossless: true }).toBuffer()]]) {
    const meta = await sharp(await strip(name, image)).metadata();
    assert.deepEqual([meta.pages, meta.exif], [2, undefined], name);
  }
});

test("a lossy animation is cut, not re-encoded, and its frames lose unknown chunks", async () => {
  const frame = (v) => noise(20, 40).linear(1, v).webp().toBuffer();
  const animated = await sharp([await frame(0), await frame(60)], { join: { animated: true } }).withExif(GPS).webp().toBuffer();
  // An unknown chunk inside the last frame (the RIFF and ANMF sizes grow with it).
  const extra = Buffer.from("XTRA\x08\0\0\0someone!", "latin1");
  const at = animated.lastIndexOf("ANMF");
  const frameEnd = at + 8 + animated.readUInt32LE(at + 4);
  const tagged = Buffer.concat([animated.subarray(0, frameEnd), extra, animated.subarray(frameEnd)]);
  tagged.writeUInt32LE(tagged.length - 8, 4);
  tagged.writeUInt32LE(tagged.readUInt32LE(at + 4) + extra.length, at + 4);
  assert.equal((await sharp(tagged).metadata()).pages, 2);

  const stripped = await strip("lossy-anim.webp", tagged);
  const meta = await sharp(stripped).metadata();
  assert.deepEqual([meta.pages, meta.exif], [2, undefined]);
  assert.ok(!stripped.includes("someone"));
  const vp8 = animated.indexOf("VP8 ", at);
  assert.ok(stripped.includes(animated.subarray(vp8, vp8 + 200)), "re-encoded");
});

test("jpeg: an Adobe segment keeps only its 12 bytes", async () => {
  const image = await noise(16, 16).jpeg().toBuffer();
  const adobe = Buffer.from("Adobe\0\x64\0\0\0\0\x01", "latin1"); // version 100, YCbCr
  const tagged = Buffer.concat([image.subarray(0, 2), segment(0xee, Buffer.concat([adobe, Buffer.from("someone")])), image.subarray(2)]);
  const stripped = await strip("adobe.jpg", tagged);
  assert.ok(stripped.equals(Buffer.concat([image.subarray(0, 2), segment(0xee, adobe), image.subarray(2)])));
});

test("png: an APNG keeps only its still image, whose frames nothing could check", async () => {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(8 + body.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(zlib.crc32(body), 4 + body.length);
    return out;
  };
  const png = await noise(16, 16).png().toBuffer();
  const ihdrEnd = 8 + 25;
  const acTL = chunk("acTL", Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]));
  const fcTL = (seq) => chunk("fcTL", Buffer.concat([Buffer.from([0, 0, 0, seq, 0, 0, 0, 16, 0, 0, 0, 16]), Buffer.alloc(8), Buffer.from([0, 1, 0, 10, 0, 0])]));
  const fdAT = chunk("fdAT", Buffer.concat([Buffer.from([0, 0, 0, 2]), Buffer.from("not a frame, someone")]));
  const iend = png.length - 12;
  const apng = Buffer.concat([png.subarray(0, ihdrEnd), acTL, fcTL(0), png.subarray(ihdrEnd, iend), fcTL(1), fdAT, png.subarray(iend)]);
  assert.ok((await strip("anim.png", apng)).equals(png));
});

test("webp: known chunks where the decoder never reads them go", async () => {
  const riff = (...chunks) => {
    const body = Buffer.concat([Buffer.from("WEBP", "latin1"), ...chunks]);
    const header = Buffer.from("RIFF0000", "latin1");
    header.writeUInt32LE(body.length, 4);
    return Buffer.concat([header, body]);
  };
  const chunk = (type, text) => {
    const data = Buffer.from(text, "latin1");
    const out = Buffer.alloc(8 + data.length + (data.length % 2));
    out.write(type, 0, "latin1");
    out.writeUInt32LE(data.length, 4);
    data.copy(out, 8);
    return out;
  };
  const simple = await noise(16, 16).webp().toBuffer(); // RIFF, WEBP, one VP8 chunk
  const image = simple.subarray(12);
  for (const stray of ["ICCP", "ANIM", "VP8 ", "ALPH"]) {
    const tagged = riff(image, chunk(stray, "someone"));
    const valid = await sharp(tagged).resize(8).toBuffer().then(() => true, () => false); // else refused at upload
    if (valid) assert.ok((await strip("stray.webp", tagged)).equals(simple), stray);
  }
  const still = await noise(16, 16).withExif(GPS).webp().toBuffer(); // VP8X without ICC, VP8, EXIF
  const stripped = await strip("still.webp", riff(still.subarray(12), chunk("ICCP", "someone"))); // ICC not flagged
  assert.ok(!stripped.includes("someone") && !stripped.includes("GPS"));
  assert.ok((await pixels(stripped)).equals(await pixels(still)));
});

test("webp: VP8X and ANIM keep their defined size, nothing behind them", async () => {
  const frame = (v) => noise(20, 20).linear(1, v).webp().toBuffer();
  const animated = await sharp([await frame(0), await frame(60)], { join: { animated: true } }).webp().toBuffer();
  // Grows the chunk at `at` by "someone!" (8 bytes, so no padding changes).
  const grow = (image, at) => {
    const end = at + 8 + image.readUInt32LE(at + 4);
    const out = Buffer.concat([image.subarray(0, end), Buffer.from("someone!"), image.subarray(end)]);
    out.writeUInt32LE(out.readUInt32LE(at + 4) + 8, at + 4);
    out.writeUInt32LE(out.length - 8, 4);
    return out;
  };
  for (const type of ["VP8X", "ANIM"]) {
    const tagged = grow(animated, animated.indexOf(type));
    assert.equal((await sharp(tagged).metadata()).pages, 2, type);
    const stripped = await strip(`grown-${type}.webp`, tagged);
    assert.ok(stripped.equals(animated), type);
  }
});
