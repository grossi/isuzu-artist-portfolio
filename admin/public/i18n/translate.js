import en from "./en.js";
import ja from "./ja.js";

// Pure helpers, shared by the browser (i18n/index.js) and the server (error
// messages, the preview's "building" page).

export const TABLES = { ja, en };
export const isLang = (value) => value === "ja" || value === "en";

// The first supported language among BCP 47 tags (navigator.languages, or
// Accept-Language without its weights), else Japanese: the site's rule.
export function matchLang(tags) {
  for (const tag of tags) {
    const base = String(tag ?? "").trim().toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "ja";
}

// "Busy: {kind}" + { kind: "save" } → "Busy: save". Unknown placeholders stay.
export function format(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

// English when the key is missing in Japanese; the key itself as a last resort.
export function translate(lang, key, params) {
  const template = TABLES[lang]?.[key] ?? en[key];
  return template === undefined ? key : format(template, params);
}
