import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPrivateHost, loadConfig } from "../lib/config.js";
import { resolveInside } from "../lib/static.js";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeStem } from "../lib/uploads.js";
import { commitMessage, describeChanges } from "../lib/workspace.js";

const require = createRequire(import.meta.url);
const sidebar = require("../../src/utils/sidebar.js");
const { parseOrder } = require("../../src/utils/imageOrder.js");

test("only loopback and tailnet addresses can be bound", () => {
  for (const host of ["127.0.0.1", "::1", "localhost", "100.101.102.103", "100.64.0.1", "fd7a:115c:a1e0::1"]) {
    assert.doesNotThrow(() => assertPrivateHost(host), host);
  }
  for (const host of ["0.0.0.0", "::", "192.0.2.10", "8.8.8.8", "100.128.0.1", "example.com", ""]) {
    assert.throws(() => assertPrivateHost(host), host);
  }
  assert.throws(() => loadConfig({ ADMIN_HOST: "0.0.0.0" }));
});

test("deploy command is split, never run through a shell", () => {
  assert.deepEqual(loadConfig({}).deployCommand, ["yarn", "deploy"]);
  assert.deepEqual(loadConfig({ ADMIN_DEPLOY_CMD: " bash  /tmp/stub.sh " }).deployCommand, ["bash", "/tmp/stub.sh"]);
});

test("the live site URL defaults to isuzu.work and must be http(s)", () => {
  assert.equal(loadConfig({}).siteUrl, "https://isuzu.work/");
  assert.equal(loadConfig({ ADMIN_SITE_URL: "" }).siteUrl, "https://isuzu.work/");
  assert.equal(loadConfig({ ADMIN_SITE_URL: " http://localhost:3000 " }).siteUrl, "http://localhost:3000/");
  assert.equal(loadConfig({ ADMIN_SITE_URL: "https://staging.example.com/en" }).siteUrl, "https://staging.example.com/en");
  for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://isuzu.work/", "isuzu.work", "//isuzu.work"]) {
    assert.throws(() => loadConfig({ ADMIN_SITE_URL: bad }), /ADMIN_SITE_URL/, bad);
  }
});

test("upload names become safe, dot-free stems", () => {
  assert.equal(sanitizeStem("My Piece (final).PNG"), "my-piece-final");
  assert.equal(sanitizeStem("../../etc/passwd"), "passwd");
  assert.equal(sanitizeStem("..\\..\\win.ini"), "win");
  assert.equal(sanitizeStem("a.b.c.jpg"), "a-b-c");
  assert.equal(sanitizeStem("Café crème.jpg"), "cafe-creme");
  assert.equal(sanitizeStem("夏の絵.png"), "illustration");
  assert.equal(sanitizeStem(".hidden"), "illustration");
  assert.equal(sanitizeStem(""), "illustration");
  assert.equal(sanitizeStem(`${"x".repeat(100)}.png`).length, 60);
  assert.match(sanitizeStem("x\0y\n.png"), /^[a-z0-9-]+$/);
});

test("static paths never leave the root", () => {
  const root = "/srv/preview";
  assert.equal(resolveInside(root, "/"), "/srv/preview");
  assert.equal(resolveInside(root, "/assets/app.js"), "/srv/preview/assets/app.js");
  assert.equal(resolveInside(root, "/gallery/zzzzz%20(1).png"), "/srv/preview/gallery/zzzzz (1).png");
  for (const bad of ["/../etc/passwd", "/a/../../etc", "/%2e%2e/etc/passwd", "/..%2fetc", "/a%5c..%5c..%5cetc", "/x%00.html", "/%E0%A4%A"]) {
    assert.equal(resolveInside(root, bad), null, bad);
  }
});

test("changes and commit message", () => {
  const noSidebar = { heading: { ja: "", en: "" }, entries: [] };
  const head = { gallery: ["a.png", "b.png", "c.png"], carousel: ["carousel/x.png"], sidebar: noSidebar };
  const same = describeChanges(head, head);
  assert.deepEqual(same, {
    added: [], removed: [], reordered: false, slidesAdded: [], slidesRemoved: [], carouselReordered: false, slidesRefocused: [],
    entriesAdded: [], entriesRemoved: [], entriesEdited: [], entriesReordered: false,
    editionsAdded: [], editionsRemoved: [], editionsEdited: [], editionsReordered: [], headingChanged: false,
  });

  const uploads = describeChanges(head, { ...head, gallery: ["new.png", ...head.gallery] });
  assert.deepEqual(uploads.added, ["new.png"]);
  assert.equal(uploads.reordered, false, "prepending is not a reorder");

  const changes = describeChanges(head, { gallery: ["new.png", "c.png", "a.png", "b.png"], carousel: ["gallery/new.png"], sidebar: noSidebar });
  assert.equal(changes.reordered, true);
  assert.deepEqual(changes.slidesAdded, ["gallery/new.png"]);
  assert.deepEqual(changes.slidesRemoved, ["carousel/x.png"]);
  assert.equal(
    commitMessage(changes),
    "content: add 1 illustration, reorder the gallery, update the carousel\n\n" +
      "Added to the gallery:\n- new.png\nGallery order changed.\n" +
      "Carousel slides added:\n- gallery/new.png\nCarousel slides removed:\n- carousel/x.png\n"
  );
});

test("a slide's new cut position is a carousel change; the default needs no entry", () => {
  const noSidebar = { heading: { ja: "", en: "" }, entries: [] };
  const head = { gallery: ["a.png"], carousel: ["carousel/x.png", "gallery/a.png"], carouselFocus: { "carousel/x.png": 30, "gallery/a.png": 50 }, sidebar: noSidebar };
  // A manifest without positions (as tests and old drafts have) is all default.
  assert.deepEqual(describeChanges({ ...head, carouselFocus: undefined }, { ...head, carouselFocus: { "carousel/x.png": 30, "gallery/a.png": 30 } }).slidesRefocused, []);
  const changes = describeChanges(head, { ...head, carouselFocus: { "carousel/x.png": 15, "gallery/a.png": 50 } });
  assert.deepEqual(changes.slidesRefocused, ["carousel/x.png: 30 → 15"]);
  assert.equal(
    commitMessage(changes),
    "content: update the carousel\n\nCarousel slides cut elsewhere (0: keep the top, 100: the bottom):\n- carousel/x.png: 30 → 15\n"
  );
  // A slide that's new isn't "refocused": it's added.
  assert.deepEqual(describeChanges({ ...head, carousel: ["carousel/x.png"] }, { ...head, carouselFocus: { "gallery/a.png": 15 } }).slidesRefocused, []);
});

test("carouselFocus: slides to whole numbers from 0 to 100, and optional", () => {
  assert.deepEqual(parseOrder('{"carousel":["carousel/a.png"]}'), { carousel: ["carousel/a.png"] });
  assert.deepEqual(parseOrder('{"carouselFocus":{"carousel/a.png":15,"gallery/b (2).jpg":42}}').carouselFocus, { "carousel/a.png": 15, "gallery/b (2).jpg": 42 });
  for (const focus of ['[]', 'null', '"x"', '{"carousel/a.png":42.5}', '{"carousel/a.png":101}', '{"carousel/a.png":-1}', '{"carousel/a.png":"15"}',
    '{"__proto__":15}', '{"constructor":30}', '{"../../etc/passwd":30}', '{"carousel/a/b.png":30}', '{"carousel/..":30}', '{"public/carousel/a.png":30}']) {
    assert.throws(() => parseOrder(`{"carouselFocus":${focus}}`), /carouselFocus/, focus);
  }
});

test("previous editions are reported one by one, not as an edited entry", () => {
  const edition = (id, label = "2018年版") => ({ id, image: `sidebar/${id}.png`, link: "https://example.com/", title: { ja: "本", en: "" }, edition: { ja: label, en: "" } });
  const book = (editions) => ({ id: "book", image: "book.webp", link: null, description: { ja: "", en: "" }, ...(editions && { previousEditions: editions }) });
  const state = (entries) => ({ gallery: [], carousel: [], sidebar: { heading: { ja: "", en: "" }, entries } });
  const head = state([book([edition("a"), edition("b")]), { ...book(), id: "gone", previousEditions: [edition("c")] }]);
  const now = state([book([edition("b", "2019年版"), edition("new"), edition("a")])]);
  const changes = describeChanges(head, now);
  assert.deepEqual(changes.entriesEdited, []);
  assert.deepEqual(changes.entriesRemoved, ["gone"]);
  assert.deepEqual(changes.editionsAdded, ["book/new"]);
  assert.deepEqual(changes.editionsEdited, ["book/b"]);
  assert.deepEqual(changes.editionsRemoved, ["gone/c"]);
  assert.deepEqual(changes.editionsReordered, ["book"]);
  assert.match(commitMessage(changes), /^content: update the sidebar\n/);
  assert.match(commitMessage(changes), /Previous editions added:\n- book\/new\nPrevious editions edited:\n- book\/b\nPrevious editions removed:\n- gone\/c\nPrevious editions reordered:\n- book\n/);
  // The last edition removed: the entry loses its key, which is no entry edit either.
  const emptied = describeChanges(state([book([edition("a")])]), state([book()]));
  assert.deepEqual([emptied.entriesEdited, emptied.editionsRemoved], [[], ["book/a"]]);
});

test("previous editions: validated with their entry", () => {
  const edition = { id: "old", image: "isuzubook-2018.jpg", link: "https://www.amazon.co.jp/dp/B07D55TSL4", title: { ja: "本", en: "" }, edition: { ja: "2018年版", en: "2018 edition" } };
  const entry = { id: "a", image: "sidebar/a.png", link: null, description: { ja: "", en: "" } };
  const content = (...editions) => ({ entries: [{ ...entry, previousEditions: editions }] });
  assert.doesNotThrow(() => sidebar.validateContent(content(edition)));
  assert.doesNotThrow(() => sidebar.validateContent(content()));
  for (const link of ["javascript:alert(1)", "", null, "//example.com", "https://example.com/\tx"]) {
    assert.throws(() => sidebar.validateContent(content({ ...edition, link })), /a\/old: the link must be an http\(s\) URL/, String(link));
  }
  assert.throws(() => sidebar.validateContent(content({ ...edition, image: "../x.png" })), /bad image/);
  assert.throws(() => sidebar.validateContent(content({ ...edition, title: { ja: " ", en: "" } })), /"title"/);
  assert.throws(() => sidebar.validateContent(content({ ...edition, title: { ja: "本" } })), /"title"/);
  assert.throws(() => sidebar.validateContent(content({ ...edition, edition: { ja: "", en: "" } })), /"edition"/);
  assert.throws(() => sidebar.validateContent(content({ ...edition, title: { ja: "x".repeat(301), en: "" } })), /longer/);
  assert.throws(() => sidebar.validateContent(content(edition, edition)), /repeated previous edition id/);
  assert.throws(() => sidebar.validateContent(content({ ...edition, id: "Old" })), /bad or repeated previous edition id/);
  // Ids are unique across entries too.
  assert.throws(() => sidebar.validateContent({ entries: [content(edition).entries[0], { ...entry, id: "b", previousEditions: [edition] }] }), /repeated previous edition id/);
  assert.throws(() => sidebar.validateContent({ entries: [{ ...entry, previousEditions: {} }] }), /must be a list/);
});

test("the site's sidebar content is valid, with the 2018 edition under its book", () => {
  const content = sidebar.readContent(path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."));
  const book = content.entries.find((entry) => entry.id === "isuzubook");
  assert.ok(book, "the isuzubook entry");
  // Newer editions are added (and may be reordered) from the admin: only the
  // 2018 one is pinned.
  assert.deepEqual((book.previousEditions ?? []).find((edition) => edition.id === "clip-studio-paint-pro-2018"), {
    id: "clip-studio-paint-pro-2018",
    image: "isuzubook-2018.jpg",
    link: "https://www.amazon.co.jp/dp/B07D55TSL4",
    title: { ja: "プロが教える！CLIP STUDIO PAINT PROの教科書", en: "プロが教える！CLIP STUDIO PAINT PROの教科書" },
    edition: { ja: "2018年版", en: "2018 edition" },
  });
});

test("sidebar entries: links, images and fallbacks", () => {
  for (const link of ["https://amazon.co.jp/dp/4297149761", "http://example.com/a?b=c#d"]) assert.ok(sidebar.isValidLink(link), link);
  for (const link of ["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,x", "ftp://x", "//example.com", "https://", "https://exa mple.com",
    "https://example.com/\nx", "java\tscript:alert(1)", "example.com", "", "https://example.com/" + "x".repeat(2000)]) {
    assert.ok(!sidebar.isValidLink(link), JSON.stringify(link));
  }
  for (const image of ["isuzubook.webp", "sidebar/new-book.png", "sidebar/a.jpg"]) assert.ok(sidebar.isValidImage(image), image);
  for (const image of ["../x.png", "sidebar/../x.png", "a/b.png", "sidebar/.png", "x.gif", "/etc/x.png", "sidebar\\x.png"]) assert.ok(!sidebar.isValidImage(image), image);

  const valid = { heading: { ja: "", en: "" }, entries: [{ id: "a", image: "sidebar/a.png", link: null, description: { ja: "", en: "" } }] };
  assert.doesNotThrow(() => sidebar.validateContent(valid));
  assert.throws(() => sidebar.validateContent({ ...valid, entries: [...valid.entries, valid.entries[0]] }), /repeated/);
  assert.throws(() => sidebar.validateContent({ ...valid, entries: [{ ...valid.entries[0], link: "javascript:alert(1)" }] }), /link/);

  assert.deepEqual(sidebar.localized({ ja: "本", en: "  " }), { ja: "本", en: "本" });
  assert.deepEqual(sidebar.localized({ ja: "", en: "Books" }), { ja: "Books", en: "Books" });
  assert.deepEqual(sidebar.localized({ ja: "", en: "" }), { ja: "", en: "" });
});

test("a timeout stops the whole process tree", async () => {
  const { run } = await import("../lib/jobs.js");
  const started = Date.now();
  // The shell's sleeping child would keep the output pipe open after the shell dies.
  await assert.rejects(run("sh", ["-c", "sleep 30 & sleep 30; wait"], { cwd: "/tmp", log: () => {}, timeoutMs: 200 }), /timed out/);
  assert.ok(Date.now() - started < 5000, `took ${Date.now() - started} ms`);
});

test("a job reports its steps, and a failure as a code", async () => {
  const { Jobs } = await import("../lib/jobs.js");
  const jobs = new Jobs();
  const events = [];
  jobs.subscribe((event, data) => event === "job" && events.push(data));
  jobs.start("deploy", async (log) => {
    log.step("push");
    log.step("rebase");
    const { AdminError } = await import("../lib/errors.js");
    throw new AdminError("push-failed");
  });
  assert.throws(() => jobs.start("save", async () => {}), { code: "busy", status: 409, params: { kind: "deploy" } });
  await new Promise((resolve) => jobs.subscribe((event) => event === "state" && resolve()));
  assert.deepEqual(events.map((job) => job.step), [undefined, { code: "push", params: {} }, { code: "rebase", params: {} }, { code: "rebase", params: {} }]);
  const last = events.at(-1);
  assert.equal(last.status, "failed");
  assert.deepEqual([last.errorCode, last.errorParams], ["push-failed", {}]);
  assert.match(last.error, /^Push failed/);
});
