const fs = require("fs");
const path = require("path");

// The home sidebar's second box (著書 / My Books today) is data in
// src/sidebar-content.json, written by the admin console (admin/):
//
//   {
//     "heading": { "ja": "著書", "en": "My Books" },
//     "entries": [
//       {
//         "id": "isuzubook",
//         "image": "isuzubook.webp",
//         "link": "https://www.amazon.co.jp/dp/429713134X",
//         "description": { "ja": "markdown", "en": "markdown" },
//         "previousEditions": [
//           {
//             "id": "isuzubook-2018",
//             "image": "isuzubook-2018.jpg",
//             "link": "https://www.amazon.co.jp/dp/B07D55TSL4",
//             "title": { "ja": "…", "en": "" },
//             "edition": { "ja": "2018年版", "en": "2018 edition" }
//           }
//         ]
//       }
//     ]
//   }
//
// Entries are shown in order. "image" is either a file in public/sidebar/
// ("sidebar/cover.png"), which the build turns into a sidebar-sized webp, or
// a web-ready file directly in public/ ("isuzubook.webp"), shipped as it is.
// "link" is optional (null: the image is not a link) and must be http(s).
// An empty description or heading falls back to the other language.
//
// "previousEditions" (optional) are older editions of that book, listed in
// order under it with a small cover. Their images follow the same rules (the
// build makes a cover-sized webp of a public/sidebar/ file), the link is
// required, and the title and edition label each need at least one language.
// Edition ids are unique across the whole file.
const CONTENT_FILE = "src/sidebar-content.json";
const SIDEBAR_DIR = "public/sidebar";
const MAX_TITLE = 300;
const MAX_EDITION_LABEL = 100;

function isValidLink(link) {
  // URL() would silently drop tabs and newlines, so refuse any whitespace or control character.
  if (typeof link !== "string" || link.length > 2000 || /\s/.test(link) || [...link].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f)) return false;
  try {
    const url = new URL(link);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidImage(image) {
  return typeof image === "string" && /^(sidebar\/)?[^/\\]+\.(webp|png|jpg)$/.test(image) && !image.split("/").pop().startsWith(".");
}

const isText = (value) => typeof value === "string";
const isLocalized = (value) => Boolean(value) && isText(value.ja) && isText(value.en);
const hasText = (value) => value.ja.trim() !== "" || value.en.trim() !== "";
const isId = (id) => typeof id === "string" && /^[a-z0-9-]+$/.test(id);

// Throws on anything the site can't render safely.
function validateContent(content) {
  const fail = (message) => {
    throw new Error(`${CONTENT_FILE}: ${message}`);
  };
  if (!content || typeof content !== "object") fail("expected an object");
  const { heading = { ja: "", en: "" }, entries } = content;
  if (!heading || !isText(heading.ja) || !isText(heading.en)) fail('"heading" must have "ja" and "en" strings');
  if (!Array.isArray(entries)) fail('"entries" must be a list');
  const ids = new Set();
  const editionIds = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") fail("every entry must be an object");
    if (!isId(entry.id) || ids.has(entry.id)) fail(`bad or repeated id "${entry.id}"`);
    ids.add(entry.id);
    if (!isValidImage(entry.image)) fail(`${entry.id}: bad image "${entry.image}"`);
    if (entry.link !== null && !isValidLink(entry.link)) fail(`${entry.id}: the link must be an http(s) URL or null`);
    if (!entry.description || !isText(entry.description.ja) || !isText(entry.description.en)) {
      fail(`${entry.id}: "description" must have "ja" and "en" strings`);
    }
    if (entry.previousEditions === undefined) continue;
    if (!Array.isArray(entry.previousEditions)) fail(`${entry.id}: "previousEditions" must be a list`);
    for (const edition of entry.previousEditions) {
      if (!edition || typeof edition !== "object") fail(`${entry.id}: every previous edition must be an object`);
      if (!isId(edition.id) || editionIds.has(edition.id)) fail(`${entry.id}: bad or repeated previous edition id "${edition.id}"`);
      editionIds.add(edition.id);
      const name = `${entry.id}/${edition.id}`;
      if (!isValidImage(edition.image)) fail(`${name}: bad image "${edition.image}"`);
      if (!isValidLink(edition.link)) fail(`${name}: the link must be an http(s) URL`);
      if (!isLocalized(edition.title) || !hasText(edition.title)) fail(`${name}: "title" must have "ja" and "en" strings, one of them not empty`);
      if (!isLocalized(edition.edition) || !hasText(edition.edition)) fail(`${name}: "edition" must have "ja" and "en" strings, one of them not empty`);
      if (edition.title.ja.length > MAX_TITLE || edition.title.en.length > MAX_TITLE) fail(`${name}: "title" is longer than ${MAX_TITLE} characters`);
      if (edition.edition.ja.length > MAX_EDITION_LABEL || edition.edition.en.length > MAX_EDITION_LABEL) fail(`${name}: "edition" is longer than ${MAX_EDITION_LABEL} characters`);
    }
  }
  return { heading, entries };
}

function readContent(root) {
  const file = path.join(root, CONTENT_FILE);
  if (!fs.existsSync(file)) return { heading: { ja: "", en: "" }, entries: [] };
  return validateContent(JSON.parse(fs.readFileSync(file, "utf-8")));
}

// Each language falls back to the other; "" when both are empty.
function localized({ ja, en }) {
  const has = (text) => text.trim() !== "";
  return { ja: has(ja) ? ja : has(en) ? en : "", en: has(en) ? en : has(ja) ? ja : "" };
}

module.exports = { CONTENT_FILE, SIDEBAR_DIR, MAX_TITLE, MAX_EDITION_LABEL, isValidLink, isValidImage, validateContent, readContent, localized };
