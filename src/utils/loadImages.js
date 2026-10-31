const fs = require("fs");
const sharp = require('sharp');
const { readOrder, listImages, orderGallery, orderCarousel, splitName } = require('./imageOrder');

async function sizeOf(imagePath) {
  const { width, height } = await sharp(imagePath).metadata();
  return { width, height };
}

// Full-size derivatives (hero slides, click-to-enlarge viewers) are capped at this
// width and never enlarged. Every current source is narrower, so they keep their
// native resolution and the viewer layout is unchanged.
const LARGE_WIDTH = 2048;
const LARGE_QUALITY = 85;

// WorkCard shows the banner 60px tall with object-fit: cover. While the card is at
// least 60 * BANNER_ASPECT_RATIO px wide, only a centred strip this many times
// shorter than the image width is ever visible, so that is all we ship.
const BANNER_ASPECT_RATIO = 4;

function rescale({ imagePath, width, destinationPath, quality, crop }) {
  const image = crop ? sharp(imagePath).extract(crop) : sharp(imagePath);
  return image.resize({ width, withoutEnlargement: true }).webp({effort: 6, quality}).toFile(`${destinationPath}.webp`);
}

function rescaleLarge({ imagePath, destinationPath }) {
  return rescale({ imagePath, width: LARGE_WIDTH, destinationPath, quality: LARGE_QUALITY });
}

// Derivative folders are rebuilt from scratch on every run, so files left over
// from renamed or deleted sources don't keep shipping (the folders are gitignored).
function freshDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function bannerStrip({ h, w }) {
  const height = Math.min(h, Math.ceil(w / BANNER_ASPECT_RATIO));
  return { left: 0, top: Math.floor((h - height) / 2), width: w, height };
}

function scaledDimentions({ h, w }) {
  if( h > w ) {
    return w > 600 ? 600 : w;
  }
  return w > 1100 ? 1100 : w;
}

async function main() {
  // Gallery order and carousel slides, see imageOrder.js
  const order = readOrder(require("path").join(__dirname, "../.."));

  /** Generates Gallery json */

  const galleryNormalizedPath = require("path").join(__dirname, "../../public/gallery");

  freshDir('public/gallery/small');
  freshDir('public/gallery/large');

  const rescaleJobs = [];

  const galleryFiles = orderGallery(listImages(galleryNormalizedPath), order.gallery);
  const galleryPictures = await Promise.all(galleryFiles.map(async (file) => {
    const { name, extension } = splitName(file);
    const dimensions = await sizeOf(`public/gallery/${file}`);

    rescaleJobs.push(rescale({
      imagePath: `public/gallery/${file}`,
      width: scaledDimentions({ h: dimensions.height, w: dimensions.width }),
      destinationPath: `public/gallery/small/${name}`
    }));
    rescaleJobs.push(rescaleLarge({
      imagePath: `public/gallery/${file}`,
      destinationPath: `public/gallery/large/${name}`
    }));

    return {
      name,
      extension,
      width: dimensions.width,
      height: dimensions.height,
      location: `gallery/${file}`,
      locationSmall: `gallery/small/${name}.webp`,
      locationLarge: `gallery/large/${name}.webp`,
    }
  }));

  fs.writeFileSync('./src/gallery.json', JSON.stringify(galleryPictures, null, 2), 'utf-8'); 

  /** Generates Carousel json */

  const carouselNormalizedPath = require("path").join(__dirname, "../../public/carousel");

  freshDir('public/carousel/large');

  // Slides taken from the gallery reuse its large/ derivatives.
  const carouselPictures = orderCarousel(listImages(carouselNormalizedPath), galleryFiles, order.carousel).map((ref) => {
    const [folder, file] = ref.split('/');
    const { name, extension } = splitName(file);

    if (folder === 'carousel') {
      rescaleJobs.push(rescaleLarge({
        imagePath: `public/carousel/${file}`,
        destinationPath: `public/carousel/large/${name}`
      }));
    }

    return {
      name,
      extension,
      location: ref,
      locationLarge: `${folder}/large/${name}.webp`,
    }
  });

  fs.writeFileSync('./src/carousel.json', JSON.stringify(carouselPictures, null, 2), 'utf-8'); 

  /** Generates Work Gallery json */

  const workGalleryNormalizedPath = require("path").join(__dirname, "../../public/work-gallery");

  const workGalleryDirectories = (await Promise.all(fs.readdirSync(workGalleryNormalizedPath).map(async (workDirectory, k) => {
    if (workDirectory[0] !== '.') {
      let filePath = workGalleryNormalizedPath + '/' + workDirectory; 
      let fileStats = fs.statSync(filePath);
      let about;
      let banner;
      if(fileStats.isDirectory()) {
        freshDir(`${filePath}/small`);
        freshDir(`${filePath}/large`);
        let workList = (await Promise.all(fs.readdirSync(filePath).map(async (file, k) => {
          const extension = file.split('.')[1];
          const name = file.split('.')[0];
          let dimensions;
          if( extension === 'jpg' || extension === 'png') {
            dimensions = await sizeOf(`public/work-gallery/${workDirectory}/${file}`);
          } else {
            // about.ja.md / about.en.md; a plain about.md counts as Japanese
            const aboutMatch = file.match(/^about(?:\.(ja|en))?\.md$/);
            if( aboutMatch ) {
              about = { ...about, [aboutMatch[1] || 'ja']: `work-gallery/${workDirectory}/${file}` };
            }
            return {
              name,
              extension,
              location: `work-gallery/${workDirectory}/${file}`,
            }
          }

          if( name === 'banner' ) {
            rescaleJobs.push(rescale({
              imagePath: `public/work-gallery/${workDirectory}/${file}`,
              width: dimensions.width,
              destinationPath: `public/work-gallery/${workDirectory}/small/${name}`,
              quality: LARGE_QUALITY,
              crop: bannerStrip({ h: dimensions.height, w: dimensions.width }),
            }));
            banner = {
              name,
              extension,
              width: dimensions.width,
              height: dimensions.height,
              location: `work-gallery/${workDirectory}/${file}`,
              locationSmall: `work-gallery/${workDirectory}/small/${name}.webp`,
            };
            return { };
          }

          const widthSmall = scaledDimentions({ h: dimensions.height, w: dimensions.width });
          rescaleJobs.push(rescale({
            imagePath: `public/work-gallery/${workDirectory}/${file}`,
            width: widthSmall,
            destinationPath: `public/work-gallery/${workDirectory}/small/${name}`
          }));
          rescaleJobs.push(rescaleLarge({
            imagePath: `public/work-gallery/${workDirectory}/${file}`,
            destinationPath: `public/work-gallery/${workDirectory}/large/${name}`
          }));

          return {
            name,
            extension,
            width: dimensions.width,
            height: dimensions.height,
            location: `work-gallery/${workDirectory}/${file}`,
            locationSmall: `work-gallery/${workDirectory}/small/${name}.webp`,
            locationLarge: `work-gallery/${workDirectory}/large/${name}.webp`,
            widthSmall,
            widthLarge: Math.min(dimensions.width, LARGE_WIDTH),
          }
        }))).filter(picture => (picture.extension === 'jpg' || picture.extension === 'png'));
        if (!about) throw new Error(`public/work-gallery/${workDirectory} has no about.ja.md or about.en.md`);
        // Fall back to the other language if only one exists
        about = { ja: about.ja || about.en, en: about.en || about.ja };
        return {
          name: workDirectory,
          about,
          banner,
          workList
        }
      }
    }
    return {};
  }))).filter(work => (work.name !== undefined));

  fs.writeFileSync('./src/work-gallery.json', JSON.stringify(workGalleryDirectories, null, 2), 'utf-8'); 

  await Promise.all(rescaleJobs);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
