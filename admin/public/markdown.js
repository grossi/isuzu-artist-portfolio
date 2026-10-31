import { compiler } from "/vendor/markdown-to-jsx.js";

// Same rules as the site's components/molecules/Markdown: no raw HTML, and
// links and images only to http(s), mailto or relative URLs.
export function safeUrl(url) {
  const compact = Array.from(url).filter((c) => c.charCodeAt(0) > 0x20 && c.charCodeAt(0) !== 0x7f).join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  return !scheme || ["http", "https", "mailto"].includes(scheme[1].toLowerCase()) ? url : null;
}

// Builds DOM nodes instead of React elements. Only plain, inert attributes are
// copied, so nothing in the text can add a handler or a script URL. No "id":
// a "## Gallery" heading would otherwise take over the page's own ids.
const ATTRIBUTES = new Set(["href", "src", "alt", "title", "start", "colspan", "rowspan", "type", "checked"]);
function createElement(type, props, ...children) {
  const node = document.createElement(typeof type === "string" ? type : "div");
  for (const [key, value] of Object.entries(props ?? {})) {
    if (!ATTRIBUTES.has(key) || value === null || value === undefined || value === false) continue;
    if ((key === "href" || key === "src") && safeUrl(String(value)) === null) continue;
    node.setAttribute(key, String(value));
  }
  if (type === "a") Object.assign(node, { target: "_blank", rel: "noopener noreferrer" });
  if (type === "input") node.disabled = true; // "- [x] task" checkboxes
  const append = (child) => {
    if (Array.isArray(child)) child.forEach(append);
    else if (child instanceof Node) node.append(child);
    else if (child !== null && child !== undefined && child !== false && child !== true) node.append(String(child));
  };
  children.forEach(append);
  return node;
}

export function renderMarkdown(text) {
  const out = compiler(text, { createElement, disableParsingRawHTML: true, sanitizer: safeUrl });
  return out instanceof Node ? out : document.createTextNode(String(out ?? ""));
}
