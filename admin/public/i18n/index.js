import { TABLES, isLang, matchLang, translate } from "./translate.js";

// The admin's language: the saved choice, else the browser's languages, else
// Japanese (the site's rule, src/i18n/LanguageContext.tsx).
const STORAGE_KEY = "isuzu-admin-lang";
// Read by the preview server for its "building" page (cookies are shared
// across the ports of one host).
const COOKIE = "isuzu-admin-lang";

function initialLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // storage disabled
  }
  return matchLang(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

export let lang = initialLang();
const listeners = new Set();

export const t = (key, params) => translate(lang, key, params);
t.has = (key) => Object.hasOwn(TABLES.en, key);
export const onLangChange = (listener) => listeners.add(listener);

export function setLang(next) {
  if (!isLang(next) || next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // the choice just won't survive a reload
  }
  sync();
  for (const listener of listeners) listener(lang);
}

function sync() {
  document.documentElement.lang = lang;
  document.title = t("meta.title");
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}
sync();

// A translated string as nodes: `text` becomes <code>, and line breaks <br>.
// Parameters are filled in after the split, so they are always plain text.
export function rich(key, params = {}) {
  const nodes = [];
  t(key, Object.fromEntries(Object.keys(params).map((name) => [name, `\0${name}\0`])))
    .split("`")
    .forEach((part, i) => {
      const text = part.replace(/\0(\w+)\0/g, (_, name) => String(params[name]));
      if (i % 2) {
        const code = document.createElement("code");
        code.textContent = text;
        nodes.push(code);
        return;
      }
      text.split("\n").forEach((line, j) => {
        if (j) nodes.push(document.createElement("br"));
        if (line) nodes.push(line);
      });
    });
  return nodes;
}

// Static markup: data-i18n (text, rich), data-i18n-title, -aria-label and
// -placeholder.
export function translatePage(root = document) {
  for (const node of root.querySelectorAll("[data-i18n]")) node.replaceChildren(...rich(node.dataset.i18n));
  for (const attribute of ["title", "aria-label", "placeholder"]) {
    for (const node of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      node.setAttribute(attribute, t(node.getAttribute(`data-i18n-${attribute}`)));
    }
  }
}
