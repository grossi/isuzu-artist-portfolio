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
  - `about.md` → Work description
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
- `src/assets/md/` - Markdown content files

### Routing
- `/` - Home page with carousel and gallery
- `/works` - Work portfolio listing
- `/history` - Professional history/resume

## Development Notes

### Image Management
Images are processed at build time to create:
1. WebP versions for performance
2. JSON manifests with dimensions
3. Automatic thumbnails for galleries

Always run `yarn build-images` after adding/modifying images.

### Deployment
The site deploys to AWS S3 (isuzu.work) using:
```bash
yarn push-s3  # Syncs build folder to S3 bucket
```

### Japanese UI
The interface uses Japanese text:
- 仕事 (shigoto) = Work
- 職務経歴書 (shokumu keirekisho) = Resume/CV

### Material-UI Theme
Uses default MUI theme with responsive breakpoints. Components use `useMediaQuery` for responsive behavior.

### State Management
Simple prop drilling - no Redux or Context API. Gallery modal state managed locally in Gallery component.