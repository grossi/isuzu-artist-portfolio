// The top of the page (the slides under the isuZu wordmark).
//
// "showcase": every slide shows its whole picture on black, softly faded at
//   the sides, and the moving picture comes first and stays longer.
// "classic": the slides as they were before (filling the width, cropped at
//   the top and bottom), without the moving picture.
//
// To go back to the classic top, change "showcase" to "classic".
export const heroStyle: "showcase" | "classic" = "showcase";

// The moving picture of the showcase: its scene (a folder in public/, made
// from the artwork's layers), the carousel picture it stands in for (left
// out of the slides, so it doesn't show twice), its shape, and how long it
// shows before the next slide.
export const movingPicture = {
  scene: "animated/10000/",
  replaces: "gallery/large/10000.webp",
  aspect: 2047 / 1447,
  seconds: 10,
};
