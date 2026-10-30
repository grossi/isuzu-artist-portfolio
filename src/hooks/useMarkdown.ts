import * as React from "react";

/** Fetches a markdown file by URL, ignoring responses for a URL that is no longer current. */
export default function useMarkdown(src: string) {
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    let current = true;
    fetch(src)
      .then((response) => response.text())
      .then((loaded) => {
        if (current) setText(loaded);
      });
    return () => {
      current = false;
    };
  }, [src]);
  return text;
}
