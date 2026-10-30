import * as React from "react";

// Markdown files are static, so each URL only needs fetching once per visit.
const cache = new Map<string, string>();

/**
 * Fetches a markdown file by URL. Returns "" until the file for the current
 * URL has loaded, so text from a previous URL (e.g. the other language) is
 * never shown.
 */
export default function useMarkdown(src: string) {
  const [, setLoadedSrc] = React.useState("");
  React.useEffect(() => {
    if (cache.has(src)) return;
    let current = true;
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${src}`);
        return response.text();
      })
      .then((text) => {
        cache.set(src, text);
        if (current) setLoadedSrc(src);
      })
      .catch((error) => {
        console.error("Failed to load markdown", error);
      });
    return () => {
      current = false;
    };
  }, [src]);
  return cache.get(src) ?? "";
}
