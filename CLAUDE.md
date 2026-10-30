# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an artist portfolio website for isuZu (isuzu.work), built with React and TypeScript. The site showcases artwork through galleries, work portfolios, and a professional history page.

## Commands

### Development
```bash
yarn start          # Start dev server on localhost:3000
yarn build-images   # Process images and generate JSON files (run before deployment)
yarn build          # Create production build
yarn test           # Run tests in watch mode
yarn deploy         # Full deployment pipeline (build-images → build → push-s3)
```

### Image Processing
The `yarn build-images` command processes images from:
- `/public/gallery/` → Main page gallery with automatic thumbnails
- `/public/carousel/` → Hero carousel images  
- `/public/work-gallery/` → Work portfolios (each folder = one work card)
  - `banner.png` → Card banner image
  - `about.ja.md` / `about.en.md` → Work description per language
  - Other images → Gallery images for that work

## Architecture

### Tech Stack
- React 17 with TypeScript
- Material-UI v4 for components
- React Router v5 for routing
- react-photo-gallery & react-slick for image displays

### Component Structure
```
components/
├── molecules/      # Reusable mid-level components
│   ├── Featured/   # Homepage featured content
│   ├── Markdown/   # Markdown renderer
│   ├── SocialLinks/
│   └── WorkCard/   # Work portfolio cards
└── organisms/      # Complex page sections
    ├── Gallery/    # Photo gallery with modal viewer
    ├── Header/     # Navigation header
    └── WorkGallery/# Work portfolio galleries
```

### Key Files
- `src/App.tsx` - Main routing setup
- `src/utils/loadImages.js` - Image processing script that generates JSON and WebP versions
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

Always run `yarn build-images` after adding/modifying images.

### Deployment
The site deploys to AWS S3 (isuzu.work) behind CloudFront (`E3FT8MC74I1LTP`) using:
```bash
yarn push-s3           # Uploads build/ with Cache-Control headers, then invalidates CloudFront
yarn push-s3 --dryrun  # Preview the uploads; no invalidation
```
See `scripts/push-s3.sh`. Never delete remote objects (no `sync --delete`): `isuzubook.jpg` exists only in S3.

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

### Material-UI Theme
Uses default MUI theme with responsive breakpoints. Components use `useMediaQuery` for responsive behavior.

### State Management
Mostly prop drilling, no Redux. The one Context is `LanguageContext` (`src/i18n/`) for the
current language. Gallery modal state managed locally in Gallery component.