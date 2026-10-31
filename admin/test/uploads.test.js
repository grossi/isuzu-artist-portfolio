import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import sharp from "sharp";
import { receiveUploads, removeTemp } from "../lib/uploads.js";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "isuzu-uploads-test-"));
const spool = path.join(tmp, "spool");
let server, url;

before(async () => {
  server = http.createServer(async (req, res) => {
    try {
      const { files, fields } = await receiveUploads(req, { tempDir: spool, maxBytes: 200 * 1024, maxFiles: 2, fieldNames: ["entry"] });
      res.end(JSON.stringify({ files: files.map(({ stem, extension }) => `${stem}.${extension}`), fields }));
      removeTemp(files);
    } catch (error) {
      res.writeHead(error.status ?? 500).end(JSON.stringify({ error: error.message, code: error.code, params: error.params }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
});
after(() => {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const png = (size = 16) => sharp({ create: { width: size, height: size, channels: 3, background: "red" } }).png().toBuffer();
async function post(parts) {
  const form = new FormData();
  for (const [name, value, filename] of parts) {
    if (typeof value === "string") form.append(name, value);
    else form.append(name, new Blob([value]), filename);
  }
  const res = await fetch(url, { method: "POST", body: form });
  return { status: res.status, body: await res.json() };
}
const spoolEmpty = () => !fs.existsSync(spool) || fs.readdirSync(spool).length === 0;

test("real images pass; the extension comes from the content", async () => {
  const res = await post([["files", await png(), "Photo.JPG"], ["entry", '{"a":1}']]);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { files: ["photo.png"], fields: { entry: '{"a":1}' } });
  assert.ok(spoolEmpty());
});

test("non-images, truncated images, oversize files and stray fields are refused, leaving no temp files", async () => {
  const image = await png(400);
  const cases = [
    [[["files", Buffer.from("hello"), "x.png"]], 415, "not-an-image", { name: "x.png" }],
    [[["files", image.subarray(0, Math.floor(image.length / 2)), "cut.png"]], 415, "damaged-image", { name: "cut.png" }],
    [[["files", Buffer.alloc(300 * 1024, 1), "big.png"], ["files", await png(), "after.png"]], 413, "file-too-large", { name: "big.png", mb: 0 }],
    [[["files", await png(), "a.png"], ["files", await png(), "b.png"], ["files", await png(), "c.png"]], 413, "too-many-files", { max: 2 }],
    [[["other", "x"]], 400, "unexpected-field", { name: "other" }],
  ];
  for (const [parts, status, code, params] of cases) {
    const res = await post(parts);
    assert.equal(res.status, status, JSON.stringify(res.body));
    assert.deepEqual([res.body.code, res.body.params], [code, params]);
    assert.ok(spoolEmpty(), `temp files left after ${res.body.error}`);
  }
});

test("a write error fails the upload instead of crashing the server", { skip: process.getuid?.() === 0 }, async () => {
  fs.mkdirSync(spool, { recursive: true });
  fs.chmodSync(spool, 0o500); // the temp files can't be created
  try {
    const res = await post([["files", await png(), "a.png"]]);
    assert.equal(res.status, 500);
    assert.equal(res.body.code, "store-failed");
    assert.match(res.body.error, /Couldn't store a.png/);
  } finally {
    fs.chmodSync(spool, 0o700);
  }
});
