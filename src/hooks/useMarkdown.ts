import * as React from "react";

/**
 * Fetches a markdown file by URL. Returns "" until the file for the current
 * URL has loaded, so text from a previous URL (e.g. the other language) is
 * never shown.
 */
export default function useMarkdown(src: string) {
  const [loaded, setLoaded] = React.useState({ src: "", text: "" });
  React.useEffect(() => {
    let current = true;
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${src}`);
        return response.text();
      })
      .then((text) => {
        if (current) setLoaded({ src, text });
      })
      .catch((error) => {
        console.error("Failed to load markdown", error);
      });
    return () => {
      current = false;
    };
  }, [src]);
  return loaded.src === src ? loaded.text : "";
}
