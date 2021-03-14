import * as React from "react";
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import CardMedia from "@material-ui/core/CardMedia";
import Dialog from "@material-ui/core/Dialog";
import Grid from "@material-ui/core/Grid";
import PhotoGallery from "react-photo-gallery";
import galleryData from "gallery.json";

const useStyles = makeStyles((theme) => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
}));

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
  if (containerWidth > 800) {
    return 700;
  } else {
    return 450;
  }
};

export default function Gallery() {
  const classes = useStyles();
  const [currentImage, setCurrentImage] = React.useState("");
  const [viewerIsOpen, setViewerIsOpen] = React.useState(false);

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentImage(photo.src);
    setViewerIsOpen(true);
  }, []);

  return (
    <React.Fragment>
      <Grid item xs={12} md={8}>
        <PhotoGallery
          targetRowHeight={calculateTargetRowHeight}
          photos={paintings}
          onClick={openDialog}
        />
      </Grid>
      <Dialog
        open={viewerIsOpen}
        onClose={() => setViewerIsOpen(false)}
        scroll="body"
        maxWidth="xl"
      >
        <CardMedia component="img" src={currentImage} />
        <IconButton aria-label="close" className={classes.closeButton} onClick={() => setViewerIsOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Dialog>
    </React.Fragment>
  );
}
