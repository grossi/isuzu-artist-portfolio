const fs = require("fs");
const sizeOf = require('image-size');

/** Generates Gallery json */

const galleryNormalizedPath = require("path").join(__dirname, "../../public/gallery");

const galleryPictures = fs.readdirSync(galleryNormalizedPath).map((file, k) => {
  const extension = file.split('.')[1];
  const name = file.split('.')[0];
  const dimensions = sizeOf(`public/gallery/${file}`);

  return {
    name,
    extension,
    width: dimensions.width,
    height: dimensions.height,
    location: `gallery/${file}`
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
    if(fileStats.isDirectory) {
      let workList = fs.readdirSync(filePath).map((file, k) => {
        const extension = file.split('.')[1];
        const name = file.split('.')[0];
        let dimensions;
        if( extension === 'jpg' || extension === 'png') {
          dimensions = sizeOf(`public/work-gallery/${workDirectory}/${file}`);
        } else {
          if( extension === "md" ) {
            about = {
              name,
              extension,
              location: `work-gallery/${workDirectory}/${file}`,
            };
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
