import assert from "node:assert/strict";
import { test } from "node:test";
import { assertPrivateHost, loadConfig } from "../lib/config.js";
import { resolveInside } from "../lib/static.js";
import { sanitizeStem } from "../lib/uploads.js";
import { commitMessage, describeChanges } from "../lib/workspace.js";

test("only loopback and tailnet addresses can be bound", () => {
  for (const host of ["127.0.0.1", "::1", "localhost", "100.79.168.105", "100.64.0.1", "fd7a:115c:a1e0::1"]) {
    assert.doesNotThrow(() => assertPrivateHost(host), host);
  }
  for (const host of ["0.0.0.0", "::", "192.168.50.10", "8.8.8.8", "100.128.0.1", "example.com", ""]) {
    assert.throws(() => assertPrivateHost(host), host);
  }
  assert.throws(() => loadConfig({ ADMIN_HOST: "0.0.0.0" }));
});

test("deploy command is split, never run through a shell", () => {
  assert.deepEqual(loadConfig({}).deployCommand, ["yarn", "deploy"]);
  assert.deepEqual(loadConfig({ ADMIN_DEPLOY_CMD: " bash  /tmp/stub.sh " }).deployCommand, ["bash", "/tmp/stub.sh"]);
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
  const head = { gallery: ["a.png", "b.png", "c.png"], carousel: ["carousel/x.png"] };
  const same = describeChanges(head, head);
  assert.deepEqual(same, { added: [], removed: [], reordered: false, slidesAdded: [], slidesRemoved: [], carouselReordered: false });

  const uploads = describeChanges(head, { gallery: ["new.png", ...head.gallery], carousel: head.carousel });
  assert.deepEqual(uploads.added, ["new.png"]);
  assert.equal(uploads.reordered, false, "prepending is not a reorder");

  const changes = describeChanges(head, { gallery: ["new.png", "c.png", "a.png", "b.png"], carousel: ["gallery/new.png"] });
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
