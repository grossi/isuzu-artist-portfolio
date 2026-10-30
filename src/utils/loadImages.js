const fs = require("fs");
const sizeOf = require('image-size');
const sharp = require('sharp');

function rescale({ imagePath, width, destinationPath }) {
  return sharp(imagePath).resize({ width }).webp({effort: 6}).toFile(`${destinationPath}.webp`);
}

function scaledDimentions({ h, w }) {
  if( h > w ) {
    return w > 600 ? 600 : w;
  }
  return w > 1100 ? 1100 : w;
}

/** Generates Gallery json */

const galleryNormalizedPath = require("path").join(__dirname, "../../public/gallery");

if (!fs.existsSync('public/gallery/small')){
  fs.mkdirSync('public/gallery/small');
}

const rescaleJobs = [];

// Plain code-unit (byte) order, e.g. "zzzzz (10)" before "zzzzz (2)": the gallery order is curated against it.
const galleryPictures = fs.readdirSync(galleryNormalizedPath).sort().map((file, k) => {
  let fileStats = fs.statSync(`public/gallery/${file}`);
  if(!fileStats.isDirectory()) {
    const extension = file.split('.')[1];
    const name = file.split('.')[0];
    const dimensions = sizeOf(`public/gallery/${file}`);

    rescaleJobs.push(rescale({
      imagePath: `public/gallery/${file}`,
      width: scaledDimentions({ h: dimensions.height, w: dimensions.width }),
      destinationPath: `public/gallery/small/${name}`
    }));

    return {
      name,
      extension,
      width: dimensions.width,
      height: dimensions.height,
      location: `gallery/${file}`,
      locationSmall: `gallery/small/${name}.webp`,
    }
  } else {
    return {};
  }
}).filter(picture => (picture.extension === 'jpg' || picture.extension === 'png'));

fs.writeFileSync('./src/gallery.json', JSON.stringify(galleryPictures, null, 2), 'utf-8'); 

/** Generates Carousel json */

const carouselNormalizedPath = require("path").join(__dirname, "../../public/carousel");

const carouselPictures = fs.readdirSync(carouselNormalizedPath).map((file, k) => {
  const extension = file.split('.')[1];
  const name = file.split('.')[0];

  return {
    name,
    extension,
    location: `carousel/${file}`
  }
}).filter(picture => (picture.extension === 'jpg' || picture.extension === 'png'));

fs.writeFileSync('./src/carousel.json', JSON.stringify(carouselPictures, null, 2), 'utf-8'); 

/** Generates Work Gallery json */

const workGalleryNormalizedPath = require("path").join(__dirname, "../../public/work-gallery");

const workGalleryDirectories = fs.readdirSync(workGalleryNormalizedPath).map((workDirectory, k) => {
  if (workDirectory[0] !== '.') {
    let filePath = workGalleryNormalizedPath + '/' + workDirectory; 
    let fileStats = fs.statSync(filePath);
    let about;
    let banner;
    if(fileStats.isDirectory()) {
      let workList = fs.readdirSync(filePath).map((file, k) => {
        const extension = file.split('.')[1];
        const name = file.split('.')[0];
        let dimensions;
        if( extension === 'jpg' || extension === 'png') {
          dimensions = sizeOf(`public/work-gallery/${workDirectory}/${file}`);
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
          banner = {
            name,
            extension,
            width: dimensions.width,
            height: dimensions.height,
            location: `work-gallery/${workDirectory}/${file}`,
          };
          return { };
        }

        return {
          name,
          extension,
          width: dimensions.width,
          height: dimensions.height,
          location: `work-gallery/${workDirectory}/${file}`,
        }
      }).filter(picture => (picture.extension === 'jpg' || picture.extension === 'png'));
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
}).filter(work => (work.name !== undefined));

fs.writeFileSync('./src/work-gallery.json', JSON.stringify(workGalleryDirectories, null, 2), 'utf-8'); 

Promise.all(rescaleJobs).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
