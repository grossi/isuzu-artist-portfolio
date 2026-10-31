# Simple page to showcase isuZu's work

Can be viewed at [http://isuzu.work](http://isuzu.work)

## Requirements

Node.js 20.19+, 22.13+ or 24+ (the range Vite 8 and ESLint 10 support) and Yarn 1.

## Available Scripts

In the project directory, you can run:

### `yarn build-images`

This reads the images inside the `/public` folder to create the json who are used to create the pages.

`public/gallery` -> Main page gallery images

`public/carousel` -> Main page hero carousel images

`src/image-order.json` -> Gallery order and carousel slides (optional)

`src/sidebar-content.json` -> The home sidebar's 著書 / My Books box (entries in `public/sidebar/`)

These are normally edited with the admin console, see [`admin/README.md`](admin/README.md).

`public/work-gallery` -> Work page, each folder representing a work card with `about.ja.md` / `about.en.md` as the Japanese / English description, `banner.png` as the card banner and the rest as the work card gallery.


### `yarn start`

Runs `yarn build-images`, then the [Vite](https://vite.dev) dev server.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser. Edits are hot-reloaded.

### `yarn build`

Runs `yarn build-images`, type-checks with `tsc`, lints, then builds the app for production into the `build` folder.\
The build is minified, the filenames include hashes, and no source maps are emitted.

### `yarn preview`

Serves the production build from `build/` locally.

### `yarn lint`

Lints the project with ESLint.

### `yarn deploy`

Builds the app, then uploads `build/` to S3 with Cache-Control headers and invalidates CloudFront (`yarn push-s3`, see `scripts/push-s3.sh`).
