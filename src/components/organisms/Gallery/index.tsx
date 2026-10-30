import * as React from "react";
import { makeStyles } from "tss-react/mui";
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import Grid from "@mui/material/Grid";
import PhotoRows, { GalleryPhotoData, GalleryPhotoSource, usePhotoAlts } from "components/molecules/PhotoRows";
import galleryData from "gallery.json";
import { useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
  galleryGrid: {
    order: 1,
    [theme.breakpoints.down('md')]: {
      order: 2,
    },
  },
}));

const paintings: GalleryPhotoSource[] = galleryData.map((image, k) => {
  return {
    src: `${import.meta.env.BASE_URL}${image.locationSmall}`,
    srcBig: `${import.meta.env.BASE_URL}${image.locationLarge}`,
    width: image.width,
    height: image.height,
  };
});

const calculateTargetRowHeight = (containerWidth: number) => {
  if (containerWidth > 800) {
    return 700;
  } else {
    return 450;
  }
};

const maxPhotosPerRow = () => 4;

export default function Gallery() {
  const { classes } = useStyles();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [viewerIsOpen, setViewerIsOpen] = React.useState(false);
  const { t } = useLanguage();
  const photos = usePhotoAlts(paintings);
  const currentImage: GalleryPhotoData | undefined = photos[currentIndex];

  const openDialog = React.useCallback((index: number) => {
    setCurrentIndex(index);
    setViewerIsOpen(true);
  }, []);

  return (
    <React.Fragment>
      <Grid size={{ xs: 12, md: 8 }} className={classes.galleryGrid}>
        <PhotoRows
          photos={photos}
          targetRowHeight={calculateTargetRowHeight}
          maxPhotosPerRow={maxPhotosPerRow}
          onClick={openDialog}
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
