# Moving pictures

These scripts make a moving picture for the top of the site (see `src/hero.ts`
and `src/components/molecules/MovingPicture`) from an artwork's layered PSD.

In the PSD, layers whose name starts with `m-` can move. `extract.mjs` lists
the ones that do, and how, in `MOTION`:

- `sway`: rooted at the bottom, like grass
- `hang`: hanging from the top, like grapes or leaves
- `bow`: held at both ends, swaying in the middle
- `float`: each dot drifts on its own and fades in and out, like fireflies

Each layer is split into its separate pieces (a grape bunch, a clump of grass),
and each piece moves from its own top or bottom. Under a moving piece, the
background is filled in from its surroundings, so no hole shows when it moves.
The `MOTION` table there is the one for `public/animated/10000/`. A new picture
gets its own table.

```bash
node tools/moving-picture/extract.mjs <picture.psd> <workDir>
node tools/moving-picture/pack.mjs <workDir> public/animated/<name>
```

`extract.mjs` writes the layers at half size, plus `rest.png` (the picture at
rest) and `reference.png` (the PSD's own composite) to compare it with.

`pack.mjs` writes the folder the site loads:

- `still.webp`: the picture at rest
- `base.webp`: everything that never moves
- `atlas*.webp`: the moving pieces, and the still pieces drawn over them, on
  one or two sheets
- `scene.json`: the draw order and each piece's motion

The motions repeat every 12 s of scene time, played 12/7 times as fast
(`loop` and `speed` in `scene.json`).
