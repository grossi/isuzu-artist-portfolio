const fs = require("fs");
const sizeOf = require('image-size');

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
