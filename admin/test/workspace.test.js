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
  fs.writeFileSync(path.join(seed, ".gitignore"), "/public/gallery/small/\n/public/sidebar/large/\n/public/sidebar/small/\n");
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

  const gallery = ["c.jpg", "a.png", "b.png", "new.png", "a-2.png", "new-2.png"];
  ws.setOrder({ gallery, carousel: ["gallery/new.png", "carousel/slide.png"] });
  assert.deepEqual(ws.current().gallery, gallery);
  assert.deepEqual(ws.current().carousel, ["gallery/new.png", "carousel/slide.png"]);

  assert.throws(() => ws.setOrder({ gallery: gallery.slice(1), carousel: [] }), { code: "gallery-changed", status: 409 });
  assert.throws(() => ws.setOrder({ gallery: [...gallery.slice(1), "../x.png"], carousel: [] }), { code: "gallery-changed" });
  assert.throws(() => ws.setOrder({ gallery, carousel: ["gallery/../../etc/passwd"] }), { code: "unknown-slide" });
  assert.throws(() => ws.setOrder({ gallery, carousel: ["carousel/slide.png", "carousel/slide.png"] }), { code: "unknown-slide" });

  await assert.rejects(ws.removeUpload("a.png"), { code: "unsaved-only" });
  await assert.rejects(ws.removeUpload("../../order.json"), { code: "unsaved-only" });
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
  // build-images leaves public/sidebar/ with only its ignored large/ inside.
  fs.mkdirSync(ws.file("public/sidebar/large"), { recursive: true });
  fs.writeFileSync(ws.file("public/sidebar/large/x.webp"), "x");
  // Even if something else is already staged, Save commits only content.
  fs.writeFileSync(ws.file("staged.txt"), "staged by hand");
  sh(ws.root, "add", "staged.txt");
  const { sha } = await ws.save(log, "content: add new.png");
  assert.equal(sh(ws.root, "diff", "--cached", "--name-only"), "staged.txt");
  sh(ws.root, "rm", "--quiet", "--cached", "staged.txt");
  fs.rmSync(ws.file("staged.txt"));
  assert.equal(sh(ws.root, "show", "--name-only", "--format=", "HEAD").split("\n").sort().join(","), "public/gallery/new.png,src/image-order.json");
  assert.ok(sh(ws.root, "rev-parse", "HEAD").startsWith(sha));
  await assert.rejects(ws.save(log, "again"), { code: "nothing-to-save" });

  // notes.txt is still dirty: deploy refuses.
  await assert.rejects(ws.deploy(log), { code: "unsaved-changes", params: { files: "notes.txt" } });
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

test("a conflict in a source file aborts the rebase and deploys nothing", async () => {
  fs.writeFileSync(path.join(other, "src/image-order.json"), '{ "gallery": ["c.jpg"] }\n');
  sh(other, "add", ".");
  sh(other, "commit", "--quiet", "-m", "upstream order");
  sh(other, "push", "--quiet", "origin", "main");

  ws.writeOrder({ gallery: ["b.png"] });
  await ws.save(log, "content: local order");
  const before = sh(ws.root, "rev-parse", "HEAD");
  await assert.rejects(ws.deploy(log), {
    code: "rebase-conflict",
    params: { files: "src/image-order.json" },
    message: /^Rebase failed \(conflicts in src\/image-order.json\).*Nothing was pushed/,
  });
  assert.ok(!fs.existsSync(ws.rebaseMarker));
  assert.equal(sh(ws.root, "rev-parse", "HEAD"), before);
  assert.equal(await ws.rebaseInProgress(), false);
  assert.equal((await ws.draft()).dirty, false);
  assert.ok(!logs.includes("stub-deployed"));
  assert.equal(ws.readDeployed(), null);
});

test("conflicts only in generated manifests are resolved and regenerated", async () => {
  // Every Save commits the manifests, so main and the admin both touch them.
  fs.writeFileSync(path.join(other, "src/gallery.json"), '["upstream"]\n');
  sh(other, "commit", "--quiet", "-am", "upstream manifest");
  sh(other, "push", "--quiet", "origin", "main");

  ws.addUploads([await upload("new", "white")]);
  fs.writeFileSync(ws.file("src/gallery.json"), '["local"]\n');
  await ws.save(log, "content: add new.png");
  // The stubbed build regenerates the manifest from the (rebased) sources.
  ws.buildImages = async () => fs.writeFileSync(ws.file("src/gallery.json"), '["regenerated"]\n');
  const deployed = await ws.deploy(log);
  assert.ok(logs.includes("stub-deployed"));
  assert.equal(sh(origin, "rev-parse", "main"), deployed.sha);
  assert.equal(sh(ws.root, "log", "--format=%s", "-3"), "content: regenerate image manifests\ncontent: add new.png\nupstream manifest");
  assert.equal(fs.readFileSync(ws.file("src/gallery.json"), "utf-8"), '["regenerated"]\n');
  assert.ok(fs.existsSync(ws.file("public/gallery/new.png")));
});

test("a manifest main deleted and the admin changed is resolved too", async () => {
  sh(other, "rm", "--quiet", "src/gallery.json");
  sh(other, "commit", "--quiet", "-m", "upstream drops the manifest");
  sh(other, "push", "--quiet", "origin", "main");

  ws.addUploads([await upload("new", "white")]);
  fs.writeFileSync(ws.file("src/gallery.json"), '["local"]\n');
  await ws.save(log, "content: add new.png");
  ws.buildImages = async () => fs.writeFileSync(ws.file("src/gallery.json"), '["regenerated"]\n');
  const deployed = await ws.deploy(log);
  assert.equal(sh(origin, "rev-parse", "main"), deployed.sha);
  assert.equal(fs.readFileSync(ws.file("src/gallery.json"), "utf-8"), '["regenerated"]\n');
});

test("an interrupted rebase: the admin's own is aborted at startup, one by hand is kept until Discard", async () => {
  fs.writeFileSync(path.join(other, "src/image-order.json"), '{ "gallery": ["c.jpg"] }\n');
  sh(other, "add", ".");
  sh(other, "commit", "--quiet", "-m", "upstream order");
  sh(other, "push", "--quiet", "origin", "main");
  ws.writeOrder({ gallery: ["b.png"] });
  await ws.save(log, "content: local order");
  const before = sh(ws.root, "rev-parse", "HEAD");
  sh(ws.root, "fetch", "--quiet");

  // By hand: startup leaves it alone, edits are refused, Discard aborts it.
  assert.throws(() => sh(ws.root, "rebase", "origin/main"));
  await ws.recover();
  assert.equal(await ws.rebaseInProgress(), true);
  await assert.rejects(ws.check(), { code: "rebase-in-progress" });
  await ws.check({ duringJob: true });
  await ws.check({ allowRebase: true });
  await ws.discard();
  assert.equal(await ws.rebaseInProgress(), false);
  assert.equal(sh(ws.root, "rev-parse", "HEAD"), before);

  // The admin's own (its marker is there): aborted at startup.
  assert.throws(() => sh(ws.root, "rebase", "origin/main"));
  fs.writeFileSync(ws.rebaseMarker, "origin/main");
  await ws.recover();
  assert.equal(await ws.rebaseInProgress(), false);
  assert.ok(!fs.existsSync(ws.rebaseMarker));
  assert.equal(sh(ws.root, "rev-parse", "HEAD"), before);
  await ws.check();
});

test("a deploy retried after a failure past the rebase still regenerates the manifests", async () => {
  fs.writeFileSync(path.join(other, "README.md"), "upstream\n");
  sh(other, "add", ".");
  sh(other, "commit", "--quiet", "-m", "upstream change");
  sh(other, "push", "--quiet", "origin", "main");
  ws.addUploads([await upload("new", "white")]);
  await ws.save(log, "content: add new.png");

  ws.install = async () => {
    throw new Error("yarn install failed");
  };
  await assert.rejects(ws.deploy(log), /yarn install failed/);
  // Rebased, not pushed: the retry has no rebase to do.
  assert.ok(sh(ws.root, "log", "--format=%s", "-2").endsWith("upstream change"));
  ws.install = async () => {};
  ws.buildImages = async () => fs.writeFileSync(ws.file("src/gallery.json"), '["regenerated"]\n');
  const deployed = await ws.deploy(log);
  assert.equal(sh(origin, "show", `${deployed.sha}:src/gallery.json`), '["regenerated"]');
  assert.equal((await ws.draft()).dirty, false);
});

test("a rejected push deploys nothing", async () => {
  ws.addUploads([await upload("new", "white")]);
  await ws.save(log, "content: add new.png");
  // A pre-receive hook on the "GitHub" side rejects every push.
  fs.writeFileSync(path.join(origin, "hooks/pre-receive"), "#!/bin/sh\necho rejected >&2\nexit 1\n", { mode: 0o755 });
  await assert.rejects(ws.deploy(log), { code: "push-failed" });
  assert.ok(!logs.includes("stub-deployed"));
  assert.equal(ws.readDeployed(), null);
});

test("a failing deploy command is reported and not recorded", async () => {
  ws.config.deployCommand = ["node", "-e", "process.exit(3)"];
  await assert.rejects(ws.deploy(log), { code: "command-exit", params: { command: "node -e", code: 3 } });
  assert.equal(ws.readDeployed(), null);
});

test("a workspace off main is refused", async () => {
  sh(ws.root, "checkout", "--quiet", "-b", "other");
  await assert.rejects(ws.check(), { code: "wrong-branch", params: { branch: "other", expected: "main" } });
  sh(ws.root, "checkout", "--quiet", "--detach");
  await assert.rejects(ws.check(), { code: "detached-head" });
});

test("sidebar: add at the top, edit, reorder, heading, remove", async () => {
  // A committed entry whose image lives directly in public/, like the old covers.
  await png(path.join(ws.root, "public/cover.png"), "red");
  ws.writeSidebar({ heading: { ja: "著書", en: "My Books" }, entries: [{ id: "cover", image: "cover.png", link: "https://example.com/", description: { ja: "本", en: "Book" } }] });
  sh(ws.root, "add", ".");
  sh(ws.root, "commit", "--quiet", "-m", "sidebar");

  assert.throws(() => ws.saveSidebarEntry({ link: "", description: { ja: "x" } }), { code: "entry-needs-image" });
  const bad = await upload("x", "white");
  assert.throws(() => ws.saveSidebarEntry({ link: "javascript:alert(1)", description: {} }, bad), { code: "invalid-link", status: 400 });
  const added = ws.saveSidebarEntry({ link: "  ", description: { ja: "新刊", en: "" } }, await upload("new-book", "white"));
  assert.deepEqual(added, { id: "new-book", image: "sidebar/new-book.png", link: null, description: { ja: "新刊", en: "" } });
  const second = ws.saveSidebarEntry({ link: "https://shop.example/", description: { en: "Other" } }, await upload("new-book", "gray"));
  assert.equal(second.image, "sidebar/new-book-2.png");
  assert.deepEqual(ws.readSidebar().entries.map((e) => e.id), ["new-book-2", "new-book", "cover"]);

  // Editing keeps the id; a new image replaces (and deletes) the unsaved old one.
  ws.saveSidebarEntry({ id: "new-book", link: "https://example.com/b", description: { ja: "新刊", en: "New" } }, await upload("replaced", "blue"));
  assert.ok(!fs.existsSync(ws.file("public/sidebar/new-book.png")));
  assert.equal(ws.readSidebar().entries[1].image, "sidebar/replaced.png");
  assert.throws(() => ws.saveSidebarEntry({ id: "gone", link: "", description: {} }), { code: "entry-gone" });

  assert.throws(() => ws.setSidebar({ heading: { ja: "", en: "" }, order: ["cover"] }), { code: "sidebar-changed" });
  assert.throws(() => ws.setSidebar({ heading: { ja: "x".repeat(201), en: "" }, order: ["cover", "new-book", "new-book-2"] }), { code: "heading-too-long", params: { max: 200 } });
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

test("previous editions: add at the top, edit, reorder, remove, and kept when their entry is edited", async () => {
  // The 2018 edition as migrated: its cover lives directly in public/.
  await png(path.join(ws.root, "public/cover.png"), "red");
  await png(path.join(ws.root, "public/cover-2018.png"), "red");
  const old = { id: "cover-2018", image: "cover-2018.png", link: "https://example.com/2018", title: { ja: "本", en: "本" }, edition: { ja: "2018年版", en: "2018 edition" } };
  ws.writeSidebar({ heading: { ja: "著書", en: "My Books" }, entries: [{ id: "cover", image: "cover.png", link: null, description: { ja: "本", en: "" }, previousEditions: [old] }] });
  sh(ws.root, "add", ".");
  sh(ws.root, "commit", "--quiet", "-m", "sidebar");
  const editions = () => ws.readSidebar().entries[0].previousEditions;

  // Checked on the server, image first, then the label, title and link.
  const fields = { link: "https://example.com/2015", title: { ja: "  旧版の\n本 ", en: "" }, edition: { ja: "", en: "2015 edition" } };
  assert.throws(() => ws.saveEdition("cover", fields), { code: "edition-needs-image", status: 400 });
  const image = await upload("old-cover", "white");
  assert.throws(() => ws.saveEdition("cover", { ...fields, edition: { ja: " ", en: "" } }, image), { code: "edition-needs-label" });
  assert.throws(() => ws.saveEdition("cover", { ...fields, title: {} }, image), { code: "edition-needs-title" });
  assert.throws(() => ws.saveEdition("cover", { ...fields, link: " " }, image), { code: "edition-needs-link" });
  for (const link of ["javascript:alert(1)", "data:text/html,x", "ftp://example.com/", "example.com", "https://exa mple.com"]) {
    assert.throws(() => ws.saveEdition("cover", { ...fields, link }, image), { code: "invalid-link", status: 400 }, link);
  }
  assert.throws(() => ws.saveEdition("cover", { ...fields, title: { ja: "x".repeat(301) } }, image), { code: "title-too-long", params: { max: 300 } });
  assert.throws(() => ws.saveEdition("cover", { ...fields, edition: { ja: 1 } }, image), { code: "edition-label-too-long" });
  assert.throws(() => ws.saveEdition("nope", fields, image), { code: "entry-gone", status: 409 });
  assert.throws(() => ws.saveEdition("cover", { ...fields, id: "nope" }), { code: "edition-gone", status: 409 });
  // No refused edition left a stray image behind.
  assert.ok(!fs.existsSync(ws.file("public/sidebar")));

  const added = ws.saveEdition("cover", fields, image);
  assert.deepEqual(added, { id: "old-cover", image: "sidebar/old-cover.png", link: "https://example.com/2015", title: { ja: "旧版の 本", en: "" }, edition: { ja: "", en: "2015 edition" } });
  // A second upload of the same name gets a new file and id, at the top.
  const second = ws.saveEdition("cover", fields, await upload("old-cover", "gray"));
  assert.deepEqual([second.id, second.image], ["old-cover-2", "sidebar/old-cover-2.png"]);
  assert.deepEqual(editions().map((e) => e.id), ["old-cover-2", "old-cover", "cover-2018"]);

  // Editing keeps the id and the place; a new image deletes the unsaved old one.
  ws.saveEdition("cover", { ...fields, id: "old-cover", link: "https://example.com/b" }, await upload("replaced", "blue"));
  assert.ok(!fs.existsSync(ws.file("public/sidebar/old-cover.png")));
  assert.deepEqual(editions()[1], { ...added, image: "sidebar/replaced.png", link: "https://example.com/b" });

  // Editing the entry keeps its editions.
  ws.saveSidebarEntry({ id: "cover", link: "https://example.com/new", description: { ja: "新版", en: "" } });
  assert.equal(editions().length, 3);

  assert.throws(() => ws.setEditionOrder("cover", ["old-cover", "cover-2018"]), { code: "editions-changed", status: 409 });
  assert.throws(() => ws.setEditionOrder("cover", ["old-cover", "old-cover", "cover-2018"]), { code: "editions-changed" });
  assert.throws(() => ws.setEditionOrder("cover", "x"), { code: "editions-changed" });
  ws.setEditionOrder("cover", ["cover-2018", "old-cover", "old-cover-2"]);
  assert.deepEqual(editions().map((e) => e.id), ["cover-2018", "old-cover", "old-cover-2"]);

  ws.removeEdition("cover", "old-cover-2");
  assert.ok(!fs.existsSync(ws.file("public/sidebar/old-cover-2.png")));
  assert.throws(() => ws.removeEdition("cover", "old-cover-2"), { code: "edition-gone" });
  // The migrated cover outside public/sidebar/ stays, like the old book covers.
  ws.removeEdition("cover", "cover-2018");
  assert.ok(fs.existsSync(ws.file("public/cover-2018.png")));

  const draft = await ws.draft();
  assert.deepEqual(draft.entriesEdited, ["cover"]);
  assert.deepEqual(draft.editionsAdded, ["cover/old-cover"]);
  assert.deepEqual(draft.editionsRemoved, ["cover/cover-2018"]);
  // build-images makes public/sidebar/small/, ignored like large/.
  fs.mkdirSync(ws.file("public/sidebar/small"), { recursive: true });
  fs.writeFileSync(ws.file("public/sidebar/small/replaced.webp"), "x");
  await ws.save(log, "content: editions");
  const files = sh(ws.root, "show", "--name-only", "--format=", "HEAD").split("\n").sort();
  assert.deepEqual(files, ["public/sidebar/replaced.png", "src/sidebar-content.json"]);

  // The last one removed: no empty list is left in the file.
  ws.removeEdition("cover", "old-cover");
  assert.ok(!("previousEditions" in ws.readSidebar().entries[0]));
});

test("removing an entry removes its previous editions and their unsaved images, but not an image another one still uses", async () => {
  const book = ws.saveSidebarEntry({ link: "", description: { ja: "本" } }, await upload("book", "white"));
  const other = ws.saveSidebarEntry({ link: "", description: { ja: "別の本" } }, await upload("other", "white"));
  const fields = { link: "https://example.com/", title: { ja: "本" }, edition: { ja: "初版" } };
  const first = ws.saveEdition(book.id, fields, await upload("first", "red"));
  ws.saveEdition(book.id, fields, await upload("second", "red"));
  // Another entry's edition that uses the same file (written by hand).
  const content = ws.readSidebar();
  ws.writeSidebar({ ...content, entries: content.entries.map((e) => (e.id === other.id ? { ...e, previousEditions: [{ ...first, id: "shared" }] } : e)) });

  ws.removeSidebarEntry(book.id);
  assert.deepEqual(ws.readSidebar().entries.map((e) => e.id), [other.id]);
  assert.ok(!fs.existsSync(ws.file("public/sidebar/book.png")));
  assert.ok(!fs.existsSync(ws.file("public/sidebar/second.png")));
  assert.ok(fs.existsSync(ws.file("public/sidebar/first.png")), "still used by the other entry's edition");
  // Nothing anywhere still points at the removed entry.
  assert.ok(!JSON.stringify(ws.readSidebar()).includes('"book"'));
  ws.removeSidebarEntry(other.id);
  assert.deepEqual(fs.readdirSync(ws.file("public/sidebar")), []);
});

test("an edition whose content can't be written leaves no image behind", async () => {
  ws.saveSidebarEntry({ link: "", description: { ja: "本" } }, await upload("book", "white"));
  ws.writeSidebar = () => {
    throw new Error("disk full");
  };
  const image = await upload("lost", "white");
  assert.throws(() => ws.saveEdition("book", { link: "https://example.com/", title: { ja: "本" }, edition: { ja: "初版" } }, image), /disk full/);
  assert.ok(!fs.existsSync(ws.file("public/sidebar/lost.png")));
});

test("a content file that doesn't parse is reported by name", async () => {
  fs.writeFileSync(ws.file("src/image-order.json"), '{ "gallery": 123 }\n');
  assert.throws(() => ws.current(), { code: "content-unreadable", params: { file: "src/image-order.json", detail: '"gallery" must be a list of file names' } });
  fs.writeFileSync(ws.file("src/sidebar-content.json"), "{ broken");
  assert.throws(() => ws.readSidebar(), (error) => error.code === "content-unreadable" && error.params.file === "src/sidebar-content.json");
});
