import * as React from "react";
import { makeStyles } from '@material-ui/core/styles';
import IconButton from '@material-ui/core/IconButton';
import CloseIcon from '@material-ui/icons/Close';
import CardMedia from "@material-ui/core/CardMedia";
import Dialog from "@material-ui/core/Dialog";
import Grid from "@material-ui/core/Grid";
import PhotoGallery from "react-photo-gallery";
import GalleryPhoto, { GalleryPhotoData } from "components/atoms/GalleryPhoto";
import galleryData from "gallery.json";
import { useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles((theme) => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
  galleryGrid: {
    order: 1,
    [theme.breakpoints.down('sm')]: {
      order: 2,
    },
  },
}));

const paintings: GalleryPhotoData[] = galleryData.map((image, k) => {
  return {
    src: `${process.env.PUBLIC_URL}/${image.locationSmall}`,
    srcBig: `${process.env.PUBLIC_URL}/${image.locationLarge}`,
    width: image.width,
    height: image.height,
    alt: `isuZu illustration ${k + 1}`,
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
  const [currentImage, setCurrentImage] = React.useState<GalleryPhotoData>();
  const [viewerIsOpen, setViewerIsOpen] = React.useState(false);
  const { t } = useLanguage();

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentImage(photo);
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
          renderImage={GalleryPhoto}
        />
      </Grid>
      <Dialog
        open={viewerIsOpen}
        onClose={() => setViewerIsOpen(false)}
        scroll="body"
        maxWidth="xl"
      >
        <CardMedia component="img" src={currentImage?.srcBig} alt={currentImage?.alt} />
        <IconButton aria-label={t("common.close")} className={classes.closeButton} onClick={() => setViewerIsOpen(false)}>
          <CloseIcon />
        </IconButton>
      </Dialog>
    </React.Fragment>
  );
}
