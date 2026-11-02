import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";

// The site's real `yarn build-images` (src/utils/loadImages.js) on a tiny
// copy of the site, with the admin's own sharp.
const admin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(admin, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "isuzu-build-test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

async function siteCopy(content) {
  const root = fs.mkdtempSync(path.join(tmp, "site-"));
  fs.mkdirSync(path.join(root, "src/utils"), { recursive: true });
  for (const file of fs.readdirSync(path.join(site, "src/utils"))) fs.copyFileSync(path.join(site, "src/utils", file), path.join(root, "src/utils", file));
  for (const dir of ["public/gallery", "public/carousel", "public/work-gallery", "public/sidebar"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const image = (file, width, height) => sharp({ create: { width, height, channels: 3, background: "red" } }).toFile(path.join(root, "public", file));
  await image("book.webp", 600, 847);
  await image("old-2018.jpg", 272, 385);
  await image("sidebar/big-cover.png", 1000, 1400);
  await image("sidebar/wide.png", 900, 300);
  fs.writeFileSync(path.join(root, "src/sidebar-content.json"), JSON.stringify(content));
  return root;
}

const buildImages = (root) =>
  promisify(execFile)(process.execPath, ["src/utils/loadImages.js"], { cwd: root, env: { ...process.env, NODE_PATH: path.join(admin, "node_modules") } });

const edition = (id, image, extra = {}) => ({ id, image, link: "https://example.com/", title: { ja: "本", en: "" }, edition: { ja: "", en: "First edition" }, ...extra });

test("the build ships a cover-sized webp of an uploaded edition cover, and the language fallbacks", async () => {
  const root = await siteCopy({
    heading: { ja: "著書", en: "" },
    entries: [
      { id: "book", image: "book.webp", link: null, description: { ja: "本", en: "" }, previousEditions: [edition("big", "sidebar/big-cover.png"), edition("old", "old-2018.jpg"), edition("wide", "sidebar/wide.png"), edition("again", "sidebar/big-cover.png")] },
      { id: "other", image: "book.webp", link: null, description: { ja: "", en: "" } },
    ],
  });
  await buildImages(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "src/sidebar.json"), "utf-8"));
  const [book, other] = manifest.entries;
  assert.deepEqual(book.previousEditions.map((e) => e.image), ["sidebar/small/big-cover.webp", "old-2018.jpg", "sidebar/small/wide.webp", "sidebar/small/big-cover.webp"]);
  assert.deepEqual(book.previousEditions[0], {
    id: "big", image: "sidebar/small/big-cover.webp", link: "https://example.com/",
    title: { ja: "本", en: "本" }, edition: { ja: "First edition", en: "First edition" },
  });
  assert.deepEqual(other.previousEditions, []);
  // Over twice the 52px-wide cover the site draws, never more, never the source file.
  const size = async (file) => sharp(path.join(root, "public/sidebar/small", file)).metadata().then(({ width, height }) => [width, height]);
  assert.deepEqual(await size("big-cover.webp"), [120, 168]);
  assert.deepEqual(await size("wide.webp"), [120, 40]);
  assert.deepEqual(fs.readdirSync(path.join(root, "public/sidebar/small")).sort(), ["big-cover.webp", "wide.webp"]);
});

test("the build refuses a previous edition whose image is missing or whose link isn't http(s)", async () => {
  const missing = await siteCopy({ entries: [{ id: "book", image: "book.webp", link: null, description: { ja: "", en: "" }, previousEditions: [edition("gone", "sidebar/gone.png")] }] });
  await assert.rejects(buildImages(missing), /book\/gone: public\/sidebar\/gone.png does not exist/);
  const script = await siteCopy({ entries: [{ id: "book", image: "book.webp", link: null, description: { ja: "", en: "" }, previousEditions: [edition("bad", "old-2018.jpg", { link: "javascript:alert(1)" })] }] });
  await assert.rejects(buildImages(script), /book\/bad: the link must be an http\(s\) URL/);
});
