// The top of the page (the slides under the isuZu wordmark).
//
// "showcase": the moving picture comes first and stays longer, then the
//   slides as before, cut at movingPicture.focusY.
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
  // Which part of the slides' pictures stays when their top and bottom are
  // cut (on a computer; phones cut the sides): from 0 (all of the top) to
  // 100 (all of the bottom). 50 cuts both alike, as the classic slides do.
  focusY: 30,
};
