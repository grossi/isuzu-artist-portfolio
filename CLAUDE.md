# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an artist portfolio website for isuZu (isuzu.work), built with React and TypeScript. The site showcases artwork through galleries, work portfolios, and a professional history page.

## Commands

### Development
```bash
yarn start          # Generate image derivatives, then start the Vite dev server on localhost:3000
yarn build-images   # Process images and generate JSON files (run before deployment)
yarn build          # build-images → type-check (tsc) → lint → Vite production build into build/
yarn preview        # Serve the production build locally
yarn lint           # ESLint (flat config in eslint.config.mjs)
yarn deploy         # Full deployment pipeline (build → push-s3)
```

### Image Processing
The `yarn build-images` command processes images from:
- `/public/gallery/` → Main page gallery with automatic thumbnails
- `/public/carousel/` → Hero carousel images  
- `src/image-order.json` (optional) → Gallery order and carousel slides (see `src/utils/imageOrder.js`): listed gallery files first, then the rest in byte order; carousel slides may be `carousel/<file>` or `gallery/<file>`. Without it, the whole gallery in byte order and every image in `public/carousel/`
- `src/sidebar-content.json` → The home sidebar's second box (著書 / My Books): heading plus ordered entries with image, optional http(s) link and ja/en markdown (see `src/utils/sidebar.js`). Images in `/public/sidebar/` get a sidebar-sized webp; images directly in `public/` (the original `isuzubook*.webp` covers) ship as they are. Generates `src/sidebar.json`
- `/public/work-gallery/` → Work portfolios (each folder = one work card)
  - `banner.png` → Card banner image
  - `about.ja.md` / `about.en.md` → Work description per language
  - Other images → Gallery images for that work

For each source image it writes WebP derivatives next to it: `small/` (grid thumbnails and the cropped work-card banner strip) and `large/` (hero slides and the click-to-enlarge viewer, max 2048px wide; sidebar images, max 800px). These folders are gitignored and regenerated on every `yarn start`/`yarn build`; only the originals and the `src/*.json` manifests are committed.

## Architecture

### Tech Stack
- React 19 with TypeScript 6, built with Vite 8
- MUI v7 (`@mui/material`) for components, styled with `tss-react`'s `makeStyles`
- React Router v7 (`react-router`) for routing
- react-photo-album (rows layout) & react-slick for image displays

### Component Structure
```
components/
├── molecules/      # Reusable mid-level components
│   ├── Featured/   # Homepage featured content
│   ├── Markdown/   # Markdown renderer
│   ├── PhotoRows/  # Justified photo rows (react-photo-album)
│   ├── SocialLinks/
│   └── WorkCard/   # Work portfolio cards
└── organisms/      # Complex page sections
    ├── Gallery/    # Photo gallery with modal viewer
    ├── Header/     # Navigation header
    └── WorkGallery/# Work portfolio galleries
```

### Key Files
- `index.html` - HTML entry point (Vite serves it from the project root)
- `vite.config.mts` - Vite config (output dir `build/`, no source maps, vendor chunks)
- `src/index.tsx` - React entry point
- `src/App.tsx` - Main routing setup
- `src/theme.ts` - MUI theme
- `src/utils/loadImages.js` - Image processing script that generates JSON and WebP versions (`imageOrder.js` and `sidebar.js` hold the shared rules, also used by the admin)
- `admin/` - Tailnet-only admin console (own `package.json`, outside the site's build and lint): uploads, gallery/carousel order, sidebar entries, preview, save to `main` and deploy. See `admin/README.md`
- `src/components/molecules/PhotoRows/` - Justified photo rows shared by the galleries: react-photo-gallery's row layout rendered with react-photo-album, lazy-loaded photos that open the viewer
- `src/pages/` - Page components for each route
- `src/assets/md/` - Markdown content files, one per language (`name.ja.md`, `name.en.md`)
- `src/i18n/` - `LanguageContext` plus the UI string tables (`ja.ts`, `en.ts`)

### Routing
- `/` - Home page with carousel and gallery
- `/work` - Work portfolio listing
- `/history` - Professional history/resume

## Development Notes

### Image Management
Images are processed at build time to create:
1. WebP versions for performance
2. JSON manifests with dimensions
3. Automatic thumbnails for galleries

Always run `yarn build-images` after adding/modifying images (and commit the updated `src/*.json`). The generated WebP folders are build-only and never committed.

Content changes usually come from the admin console, which commits straight to `main` and deploys. Expect commits titled `content: …` on `main`.

### Markdown
`components/molecules/Markdown` never parses raw HTML and only allows http(s), mailto and relative URLs, because sidebar descriptions are written in the admin console. Keep it that way.

### Imports and Assets
- Bare imports resolve from `src/` (`components/...`, `pages/...`, `gallery.json`) through the `paths` mapping in `tsconfig.json` (Vite's `resolve.tsconfigPaths`).
- Markdown files imported for fetching need the `?url` suffix (`import about from "assets/md/about.md?url"`).
- Reference files in `public/` with `` `${import.meta.env.BASE_URL}file.jpg` `` (`BASE_URL` already ends in `/`).

### Deployment
The site deploys to AWS S3 (isuzu.work) behind CloudFront (`E3FT8MC74I1LTP`) using:
```bash
yarn push-s3           # Uploads build/ with Cache-Control headers, then invalidates CloudFront
yarn push-s3 --dryrun  # Preview the uploads; no invalidation
```
See `scripts/push-s3.sh`: Vite's hashed `build/assets/*` are uploaded as immutable, images get a one-week cache, everything else (`index.html`, markdown, ...) `no-cache`. Never delete remote objects (no `sync --delete`): `isuzubook.jpg` exists only in S3.

It is a single-page app: CloudFront serves `index.html` for unknown paths so `/work` and `/history` deep links work. Vercel PR previews use `vercel.json` (Vite preset, `build/` output, the same SPA rewrite).

### Languages (Japanese / English)
The site is bilingual; Japanese is the default and the header has a "日本語 / EN" toggle.
- UI strings live in `src/i18n/ja.ts` and `src/i18n/en.ts`. `en.ts` is typed against
  `ja.ts`, so a key missing from either table is a compile error. Read them with
  `const { t } = useLanguage()`; `t("key", { name })` fills `{name}` placeholders.
- Long-form text is markdown, split into `.ja.md` / `.en.md` files. Import both and pick
  `content[lang]`, then load it with the `useMarkdown(url)` hook.
- The choice is saved in `localStorage` (`lang`). First visits follow `navigator.languages`,
  falling back to Japanese. `LanguageProvider` keeps `<html lang>`, the title and the meta
  description in sync.
- Japanese CV/profile text is the source; keep names, titles and dates identical in English.

### MUI Theme
`src/theme.ts` keeps the Material-UI v4 defaults the design was built with: breakpoints (sm 600, md 960, lg 1280, xl 1920), primary colour, `#fafafa` background, body2 body text and hover-only link underlines. Remember that MUI v5+ `breakpoints.down(key)` is exclusive of `key` (v4's `down('sm')` is `down('md')` now).

The v7 `Grid` uses `size={{ xs: 12, md: 8 }}` and has no item padding or negative container margins.

### State Management
Mostly prop drilling, no Redux. The one Context is `LanguageContext` (`src/i18n/`) for the
current language. Gallery modal state managed locally in Gallery component.