import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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
