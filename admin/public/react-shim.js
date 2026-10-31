// markdown-to-jsx imports React, but the admin only uses its compiler with a
// createElement of its own (markdown.js), so nothing here is ever called.
export function createElement() {
  throw new Error("React is not available in the admin");
}
export const cloneElement = createElement;
