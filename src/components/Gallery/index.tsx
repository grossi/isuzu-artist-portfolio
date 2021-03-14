import * as React from "react";
import PhotoGallery from "react-photo-gallery";
import Grid from '@material-ui/core/Grid';
import galleryData from 'gallery.json';

const paintings = galleryData.map((image, k) => {
  return { 
    src: `${process.env.PUBLIC_URL}/${image.location}`,
    width: image.width,
    height: image.height,
    name: image.name,
  };
});

const calculateTargetRowHeight = (containerWidth: number) => {
  console.log(containerWidth);
  if (containerWidth>800) {
    return 700;
  } else {
    return 450;
  }
}

export default function Gallery() {

  return (
    <Grid item xs={12} md={8}>
      <PhotoGallery targetRowHeight={calculateTargetRowHeight} photos={paintings} />
    </Grid>
  );
}
