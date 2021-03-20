# Simple page to showcase isuZu's work

Can be viewed at [http://isuzu.work](http://isuzu.work)

## Available Scripts

In the project directory, you can run:

### `yarn build-images`

This reads the images inside the `/public` folder to create the json who are used to create the pages.

`public/gallery` -> Main page gallery images

`public/carousel` -> Main page hero carousel images

`public/work-gallery` -> Work page, each folder representing a work card with `about.md` as the description, `banner.png` as the card banner and the rest as the work card gallery.


### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `yarn test`

Launches the test runner in the interactive watch mode.

### `yarn build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
