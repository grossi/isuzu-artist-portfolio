import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { AdminError, HttpError, describeError } from "../lib/errors.js";
import en from "../public/i18n/en.js";
import ja from "../public/i18n/ja.js";
import { format, matchLang, translate } from "../public/i18n/translate.js";

const admin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(admin, file), "utf-8");
const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const codeSpans = (text) => (text.match(/`/g) ?? []).length;

test("the Japanese and English tables have the same keys, placeholders and code spans", () => {
  assert.deepEqual(Object.keys(ja).filter((key) => !(key in en)), [], "missing from en.js");
  assert.deepEqual(Object.keys(en).filter((key) => !(key in ja)), [], "missing from ja.js");
  for (const key of Object.keys(en)) {
    assert.equal(typeof ja[key], "string", key);
    assert.ok(ja[key].trim() && en[key].trim(), `${key} is empty`);
    assert.deepEqual(placeholders(ja[key]), placeholders(en[key]), `placeholders of ${key}`);
    assert.equal(codeSpans(ja[key]), codeSpans(en[key]), `code spans of ${key}`);
    assert.equal(codeSpans(en[key]) % 2, 0, `unbalanced backquote in ${key}`);
  }
});

test("every Japanese string is written in Japanese", () => {
  // Names and punctuation that read the same in both languages.
  const same = new Set(["lang.ja"]);
  const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}、。・]/u;
  for (const [key, text] of Object.entries(ja)) {
    if (!same.has(key)) assert.match(text, japanese, key);
  }
});

test("every key the page and the server use exists", () => {
  const html = read("public/index.html");
  const app = read("public/app.js");
  const server = ["server.js", ...fs.readdirSync(path.join(admin, "lib")).map((name) => `lib/${name}`)].map(read).join("\n");
  const namespaces = new Set(Object.keys(en).map((key) => key.split(".")[0]));
  const used = [
    ...[...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]),
    // Any "namespace.key" literal in the page's script.
    ...[...app.matchAll(/"([a-z]+)\.([\w-]+)"/g)].filter((m) => namespaces.has(m[1])).map((m) => `${m[1]}.${m[2]}`),
    ...["ja", "en"].map((code) => `lang.${code}`),
    // Error codes, lock kinds, job kinds and steps the server sends.
    ...[...server.matchAll(/new (?:HttpError\(\d+, |AdminError\()"([\w-]+)"/g)].map((m) => `error.${m[1]}`),
    ...[...server.matchAll(/(?:HttpError\(\d+, |AdminError\()\w+ \? "([\w-]+)" : "([\w-]+)"/g)].flatMap((m) => [`error.${m[1]}`, `error.${m[2]}`]),
    ...[...server.matchAll(/\b(?:withLock|mutate|startJob|start)\("(\w+)"|withUpload\(req, "(\w+)"/g)].map((m) => `kind.${m[1] ?? m[2]}`),
    ...[...server.matchAll(/startJob\("(\w+)"/g)].map((m) => `job.${m[1]}`),
    ...[...server.matchAll(/\bstep\(log, "(\w+)"/g)].map((m) => `step.${m[1]}`),
    ...[...server.matchAll(/"(previewPage\.\w+)"/g)].map((m) => m[1]),
  ];
  assert.ok(used.length > 150, `only ${used.length} uses found: the patterns are out of date`);
  assert.deepEqual([...new Set(used)].filter((key) => !(key in en)), []);
  for (const kind of ["upload", "reorder", "remove", "sidebar", "discard", "preview", "save", "deploy"]) assert.ok(`kind.${kind}` in en, kind);
});

test("translation helpers", () => {
  assert.equal(format("{n} of {total}, {n}", { n: 1 }), "1 of {total}, 1");
  assert.equal(translate("ja", "error.busy", { kind: "保存" }), "現在「保存」を実行中です。終わってからもう一度お試しください。");
  assert.equal(translate("en", "nope.missing"), "nope.missing");
  assert.equal(matchLang(["en-US", "ja"]), "en");
  assert.equal(matchLang(["fr-FR", "ja-JP"]), "ja");
  assert.equal(matchLang(["fr", "de"]), "ja", "Japanese by default");
  assert.equal(matchLang([]), "ja");
});

test("errors carry a code and parameters, with the English text as the message", () => {
  const busy = new HttpError(409, "busy", { kind: "deploy" });
  assert.ok(busy instanceof AdminError);
  assert.equal(busy.message, "Busy: deploy is running. Try again when it finishes.");
  assert.deepEqual(describeError(busy), { message: busy.message, code: "busy", params: { kind: "deploy" } });
  assert.deepEqual(describeError(new Error("disk full")), {
    message: "Unexpected error: disk full",
    code: "unexpected",
    params: { detail: "disk full" },
  });
});
