// The top of the page (the slides under the isuZu wordmark).
//
// "showcase": the moving picture comes first and stays longer, then the
//   slides as before, each cut at its own position (set in the admin). The
//   moving picture shows only while the picture it stands in for
//   (movingPicture.replaces) is one of the carousel's slides.
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
  // Where the moving picture is cut when the slide it stands in for has no
  // position of its own (each slide's is chosen in the admin, carouselFocus
  // in src/utils/imageOrder.js): from 0 (keep the top) to 100.
  focusY: 30,
};
