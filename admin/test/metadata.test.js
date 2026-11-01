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
  const segment = (marker, text) => {
    const body = Buffer.from(text, "latin1");
    const head = Buffer.from([0xff, marker, 0, 0]);
    head.writeUInt16BE(body.length + 2, 2);
    return Buffer.concat([head, body]);
  };
  const tagged = Buffer.concat([
    image.subarray(0, 2),
    segment(0xfe, "taken at home"),
    segment(0xed, "Photoshop 3.0\0IPTC by-line someone"),
    image.subarray(2),
    Buffer.from("trailing gain map with GPSLatitude"),
  ]);
  const stripped = await strip("tagged.jpg", tagged);
  assert.ok(stripped.equals(image));
});
