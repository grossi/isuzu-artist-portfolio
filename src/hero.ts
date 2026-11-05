// The top of the page (the slides under the isuZu wordmark).
//
// "showcase": the moving picture comes first and stays longer, then the
//   slides as before. movingPicture.fit says how the pictures fill them.
// "classic": the slides as they were before (filling the width, cropped at
//   the top and bottom), without the moving picture.
//
// To go back to the classic top, change "showcase" to "classic".
export const heroStyle: "showcase" | "classic" = "showcase";

// The moving picture of the showcase: its scene (a folder in public/, made
// from the artwork's layers), the carousel picture it stands in for (left
// out of the slides, so it doesn't show twice), its shape, and how long it
// shows before the next slide.
//
// fit: how every picture fills its slide (the slides are as tall as the
// classic ones):
//   "cover"  as the classic slides: the full width, cut at the top and bottom
//   "inset"  `inset` times the slide's height: smaller, so less is cut, with
//            black at the sides and the pictures' sides faded into it
export const movingPicture: {
  scene: string;
  replaces: string;
  aspect: number;
  seconds: number;
  fit: "cover" | "inset";
  inset: number;
} = {
  scene: "animated/10000/",
  replaces: "gallery/large/10000.webp",
  aspect: 2047 / 1447,
  seconds: 10,
  fit: "cover",
  inset: 1.14,
};
