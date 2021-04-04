import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import CardMedia from "@material-ui/core/CardMedia";
import Dialog from "@material-ui/core/Dialog";
import Grid from "@material-ui/core/Grid";
import PhotoGallery, { RenderImageProps } from "react-photo-gallery";
import LazyLoad from "react-lazyload";
import galleryData from "gallery.json";

const useStyles = makeStyles((theme) => ({
  closeButton: {
    position: "absolute",
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
  image: {
    cursor: "pointer",
    overflow: "hidden",
    position: "relative",
    width: "auto",
  },
  galleryGrid: {
    order: 1,
    [theme.breakpoints.down('sm')]: {
      order: 2,
    },
  },
}));

const paintings = galleryData.map((image, k) => {
  return {
    src: `${process.env.PUBLIC_URL}/${image.location}`,
    width: image.width,
    height: image.height,
    alt: image.name,
  };
});

const calculateTargetRowHeight = (containerWidth: number) => {
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

  const LazyImageLoading = React.useCallback((props: RenderImageProps) => {
    return (
      <LazyLoad height={props.photo.height} style={{ margin: `${props.margin}px`}}>
        <img
          className={classes.image}
          height={props.photo.height}
          width={props.photo.width}
          onClick={(event: React.MouseEvent<Element, MouseEvent>) =>
            props.onClick
              ? props.onClick(event, { ...props.photo, index: props.index })
              : {}
          }
          src={props.photo.src}
          alt={props.photo.alt}
        />
      </LazyLoad>
    );
  }, [classes.image]);

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentImage(photo.src);
    setViewerIsOpen(true);
  }, []);

  return (
    <React.Fragment>
      <Grid item xs={12} md={8} className={classes.galleryGrid}>
        <PhotoGallery
          targetRowHeight={calculateTargetRowHeight}
          photos={paintings}
          onClick={openDialog}
          limitNodeSearch={4}
          renderImage={LazyImageLoading}
        />
      </Grid>
      <Dialog
        open={viewerIsOpen}
        onClose={() => setViewerIsOpen(false)}
        scroll="body"
        maxWidth="xl"
      >
        <CardMedia component="img" src={currentImage} />
        <IconButton
          aria-label="close"
          className={classes.closeButton}
          onClick={() => setViewerIsOpen(false)}
        >
          <CloseIcon />
        </IconButton>
      </Dialog>
    </React.Fragment>
  );
}
