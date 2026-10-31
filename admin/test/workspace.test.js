import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";
import sharp from "sharp";
import { loadConfig } from "../lib/config.js";
import { Workspace } from "../lib/workspace.js";

// A tiny site repo with a bare "GitHub" origin. install/buildImages are stubbed:
// the real ones need the site's node_modules.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "isuzu-admin-test-"));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const sh = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const png = (file, color) =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: color } }).png().toFile(file);

class TestWorkspace extends Workspace {
  async install() {}
  async buildImages() {}
}

let n = 0;
let ws, origin, other, logs;
const log = (line) => logs.push(line);

beforeEach(async () => {
  const dir = path.join(tmp, String(n++));
  origin = path.join(dir, "origin.git");
  const seed = path.join(dir, "seed");
  fs.mkdirSync(path.join(seed, "public/gallery"), { recursive: true });
  fs.mkdirSync(path.join(seed, "public/carousel"), { recursive: true });
  fs.mkdirSync(path.join(seed, "src"), { recursive: true });
  for (const [name, color] of [["b.png", "red"], ["a.png", "green"], ["c.jpg", "blue"]]) await png(path.join(seed, "public/gallery", name), color);
  await png(path.join(seed, "public/carousel/slide.png"), "black");
  fs.writeFileSync(path.join(seed, ".gitignore"), "/public/gallery/small/\n");
  fs.writeFileSync(path.join(seed, "src/gallery.json"), "[]\n");
  sh(dir, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  sh(seed, "init", "--quiet", "--initial-branch=main");
  sh(seed, "add", ".");
  sh(seed, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--quiet", "-m", "seed");
  sh(seed, "push", "--quiet", origin, "main");
  const root = path.join(dir, "workspace");
  sh(dir, "clone", "--quiet", origin, root);
  other = path.join(dir, "other");
  sh(dir, "clone", "--quiet", origin, other);
  for (const repo of [root, other]) {
    sh(repo, "config", "user.name", "t");
    sh(repo, "config", "user.email", "t@t");
  }
  const config = loadConfig({ ADMIN_WORKSPACE: root, ADMIN_STATE_DIR: path.join(dir, "state"), ADMIN_DEPLOY_CMD: "node -e console.log('stub-deployed')" });
  fs.mkdirSync(config.stateDir);
  ws = new TestWorkspace(config);
  logs = [];
});

async function upload(name, color) {
  const file = path.join(tmp, `upload-${n}-${name}`);
  await png(file, color);
  return { path: file, stem: name, extension: "png" };
}

test("reads the default byte order and the carousel folder", async () => {
  await ws.check();
  const now = ws.current();
  assert.deepEqual(now.gallery, ["a.png", "b.png", "c.jpg"]);
  assert.deepEqual(now.carousel, ["carousel/slide.png"]);
  const draft = await ws.draft();
  assert.equal(draft.dirty, false);
});

test("uploads go first with unique names; order and carousel are validated", async () => {
  const names = ws.addUploads([await upload("a", "white"), await upload("new", "white"), await upload("new", "gray")]);
  assert.deepEqual(names, ["a-2.png", "new.png", "new-2.png"]);
  assert.deepEqual(ws.current().gallery, ["a-2.png", "new.png", "new-2.png", "a.png", "b.png", "c.jpg"]);

  const draft = await ws.draft();
  assert.deepEqual(draft.added, ["a-2.png", "new.png", "new-2.png"]);
  assert.deepEqual(draft.untracked.sort(), ["a-2.png", "new-2.png", "new.png"]);

  const gallery = ["c.jpg", "a.png", "b.png", "new.png", "a-2.png", "new-2.png"];
  ws.setOrder({ gallery, carousel: ["gallery/new.png", "carousel/slide.png"] });
  assert.deepEqual(ws.current().gallery, gallery);
  assert.deepEqual(ws.current().carousel, ["gallery/new.png", "carousel/slide.png"]);

  assert.throws(() => ws.setOrder({ gallery: gallery.slice(1), carousel: [] }), /changed meanwhile/);
  assert.throws(() => ws.setOrder({ gallery: [...gallery.slice(1), "../x.png"], carousel: [] }), /changed meanwhile/);
  assert.throws(() => ws.setOrder({ gallery, carousel: ["gallery/../../etc/passwd"] }), /Unknown/);
  assert.throws(() => ws.setOrder({ gallery, carousel: ["carousel/slide.png", "carousel/slide.png"] }), /repeated/);

  await assert.rejects(ws.removeUpload("a.png"), /unsaved uploads/);
  await assert.rejects(ws.removeUpload("../../order.json"), /unsaved uploads/);
  await ws.removeUpload("new.png");
  assert.deepEqual(ws.current().carousel, ["carousel/slide.png"]);
  assert.ok(!fs.existsSync(ws.file("public/gallery/new.png")));
});

test("discard resets uploads and the order file but keeps ignored files", async () => {
  ws.addUploads([await upload("new", "white")]);
  fs.mkdirSync(ws.file("public/gallery/small"));
  fs.writeFileSync(ws.file("public/gallery/small/a.webp"), "x");
  fs.writeFileSync(ws.file("src/gallery.json"), "changed");
  await ws.discard();
  assert.equal((await ws.draft()).dirty, false);
  assert.ok(!fs.existsSync(ws.file("src/image-order.json")));
  assert.ok(fs.existsSync(ws.file("public/gallery/small/a.webp")));
});

test("save commits the content paths only, then deploy pushes and records it", async () => {
  ws.addUploads([await upload("new", "white")]);
  fs.writeFileSync(ws.file("notes.txt"), "not content");
  const { sha } = await ws.save(log, "content: add new.png");
  assert.equal(sh(ws.root, "show", "--name-only", "--format=", "HEAD").split("\n").sort().join(","), "public/gallery/new.png,src/image-order.json");
  assert.ok(sh(ws.root, "rev-parse", "HEAD").startsWith(sha));
  await assert.rejects(ws.save(log, "again"), /Nothing to save/);

  // notes.txt is still dirty: deploy refuses.
  await assert.rejects(ws.deploy(log), /unsaved changes/);
  fs.rmSync(ws.file("notes.txt"));

  const history = await ws.history();
  assert.equal(history.notDeployed.length, 1);
  assert.equal(history.notPushed, 1);

  const deployed = await ws.deploy(log);
  assert.ok(logs.includes("stub-deployed"));
  assert.equal(sh(origin, "rev-parse", "main"), deployed.sha);
  const after = await ws.history();
  assert.equal(after.notDeployed.length, 0);
  assert.equal(after.deployed.sha, deployed.sha);
});

test("deploy rebases onto a newer origin/main", async () => {
  fs.writeFileSync(path.join(other, "README.md"), "upstream\n");
  sh(other, "add", ".");
  sh(other, "commit", "--quiet", "-m", "upstream change");
  sh(other, "push", "--quiet", "origin", "main");

  ws.addUploads([await upload("new", "white")]);
  await ws.save(log, "content: add new.png");
  const deployed = await ws.deploy(log);
  assert.equal(sh(origin, "rev-parse", "main"), deployed.sha);
  assert.equal(sh(ws.root, "log", "--format=%s", "-2"), "content: add new.png\nupstream change");
});

test("a rebase conflict aborts cleanly and deploys nothing", async () => {
  fs.writeFileSync(path.join(other, "src/gallery.json"), "[\"upstream\"]\n");
  sh(other, "commit", "--quiet", "-am", "upstream manifest");
  sh(other, "push", "--quiet", "origin", "main");

  fs.writeFileSync(ws.file("src/gallery.json"), "[\"local\"]\n");
  await ws.save(log, "content: local manifest");
  const before = sh(ws.root, "rev-parse", "HEAD");
  await assert.rejects(ws.deploy(log), /Rebase onto origin\/main failed \(conflicts in src\/gallery.json\)/);
  assert.equal(sh(ws.root, "rev-parse", "HEAD"), before);
  assert.equal(await ws.rebaseInProgress(), false);
  assert.equal((await ws.draft()).dirty, false);
  assert.ok(!logs.includes("stub-deployed"));
  assert.equal(ws.readDeployed(), null);
});

test("a rejected push deploys nothing", async () => {
  ws.addUploads([await upload("new", "white")]);
  await ws.save(log, "content: add new.png");
  // A pre-receive hook on the "GitHub" side rejects every push.
  fs.writeFileSync(path.join(origin, "hooks/pre-receive"), "#!/bin/sh\necho rejected >&2\nexit 1\n", { mode: 0o755 });
  await assert.rejects(ws.deploy(log), /Push failed/);
  assert.ok(!logs.includes("stub-deployed"));
  assert.equal(ws.readDeployed(), null);
});

test("a failing deploy command is reported and not recorded", async () => {
  ws.config.deployCommand = ["node", "-e", "process.exit(3)"];
  await assert.rejects(ws.deploy(log), /exit code 3/);
  assert.equal(ws.readDeployed(), null);
});

test("a workspace off main is refused", async () => {
  sh(ws.root, "checkout", "--quiet", "-b", "other");
  await assert.rejects(ws.check(), /not main/);
});

test("sidebar: add at the top, edit, reorder, heading, remove", async () => {
  // A committed entry whose image lives directly in public/, like the old covers.
  await png(path.join(ws.root, "public/cover.png"), "red");
  ws.writeSidebar({ heading: { ja: "著書", en: "My Books" }, entries: [{ id: "cover", image: "cover.png", link: "https://example.com/", description: { ja: "本", en: "Book" } }] });
  sh(ws.root, "add", ".");
  sh(ws.root, "commit", "--quiet", "-m", "sidebar");

  assert.throws(() => ws.saveSidebarEntry({ link: "", description: { ja: "x" } }), /needs an image/);
  const bad = await upload("x", "white");
  assert.throws(() => ws.saveSidebarEntry({ link: "javascript:alert(1)", description: {} }, bad), /http/);
  const added = ws.saveSidebarEntry({ link: "  ", description: { ja: "新刊", en: "" } }, await upload("new-book", "white"));
  assert.deepEqual(added, { id: "new-book", image: "sidebar/new-book.png", link: null, description: { ja: "新刊", en: "" } });
  const second = ws.saveSidebarEntry({ link: "https://shop.example/", description: { en: "Other" } }, await upload("new-book", "gray"));
  assert.equal(second.image, "sidebar/new-book-2.png");
  assert.deepEqual(ws.readSidebar().entries.map((e) => e.id), ["new-book-2", "new-book", "cover"]);

  // Editing keeps the id; a new image replaces (and deletes) the unsaved old one.
  ws.saveSidebarEntry({ id: "new-book", link: "https://example.com/b", description: { ja: "新刊", en: "New" } }, await upload("replaced", "blue"));
  assert.ok(!fs.existsSync(ws.file("public/sidebar/new-book.png")));
  assert.equal(ws.readSidebar().entries[1].image, "sidebar/replaced.png");
  assert.throws(() => ws.saveSidebarEntry({ id: "gone", link: "", description: {} }), /no longer exists/);

  assert.throws(() => ws.setSidebar({ heading: { ja: "", en: "" }, order: ["cover"] }), /changed meanwhile/);
  ws.setSidebar({ heading: { ja: " 新しい  本 ", en: "" }, order: ["cover", "new-book", "new-book-2"] });
  assert.deepEqual(ws.readSidebar().heading, { ja: "新しい 本", en: "" });

  // Removing the committed entry keeps its image (outside public/sidebar/).
  ws.removeSidebarEntry("cover");
  assert.ok(fs.existsSync(ws.file("public/cover.png")));
  ws.removeSidebarEntry("new-book-2");
  assert.ok(!fs.existsSync(ws.file("public/sidebar/new-book-2.png")));

  const draft = await ws.draft();
  assert.deepEqual(draft.entriesAdded, ["new-book"]);
  assert.deepEqual(draft.entriesRemoved, ["cover"]);
  assert.equal(draft.headingChanged, true);
  await ws.save(log, "content: sidebar");
  const files = sh(ws.root, "show", "--name-only", "--format=", "HEAD").split("\n").sort();
  assert.deepEqual(files, ["public/sidebar/replaced.png", "src/sidebar-content.json"]);
});
