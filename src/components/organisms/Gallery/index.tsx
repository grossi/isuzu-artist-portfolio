import * as React from "react";
import { makeStyles } from "tss-react/mui";
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CardMedia from "@mui/material/CardMedia";
import Dialog from "@mui/material/Dialog";
import SectionHeading from "components/molecules/SectionHeading";
import { GalleryPhotoData, GalleryPhotoSource, usePhotoAlts } from "components/molecules/PhotoRows";
import galleryData from "gallery.json";
import { useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  // The first work is shown large (two columns by two rows), the rest in a
  // grid of equal 4:5 tiles: three columns, two on phones.
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    },
  },
  lead: {
    gridColumn: "span 2",
    gridRow: "span 2",
    // On phones nothing sits beside it to size its rows, so it keeps the
    // 4:5 of the 2×2 block it is on wider screens.
    [theme.breakpoints.down("sm")]: {
      aspectRatio: "4 / 5",
    },
  },
  tile: {
    aspectRatio: "4 / 5",
  },
  card: {
    display: "block",
    width: "100%",
    height: "100%",
    padding: 0,
    border: 0,
    background: "#eee",
    overflow: "hidden",
    cursor: "zoom-in",
    "& img": {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: "transform .7s cubic-bezier(.2,.7,.2,1)",
    },
    "&:hover img": {
      transform: "scale(1.04)",
    },
    "&:focus-visible": {
      outline: "2px solid #3f51b5",
      outlineOffset: 3,
    },
    "@media (prefers-reduced-motion: reduce)": {
      "& img": { transition: "none" },
      "&:hover img": { transform: "none" },
    },
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
}));

const paintings: GalleryPhotoSource[] = galleryData.map((image) => {
  return {
    src: `${import.meta.env.BASE_URL}${image.locationSmall}`,
    srcBig: `${import.meta.env.BASE_URL}${image.locationLarge}`,
    width: image.width,
    height: image.height,
  };
});

export default function Gallery({ className }: { className?: string }) {
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
      <section className={className} aria-labelledby="home-works home-works-label">
        <SectionHeading id="home-works" title="Works" label={t("home.works")} size="large" />
        <div className={classes.grid} aria-label={t("gallery.label")} role="list">
          {photos.map((photo, index) => (
            <div key={photo.src} role="listitem" className={index === 0 ? classes.lead : classes.tile}>
              <button type="button" className={classes.card} onClick={() => openDialog(index)}>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  // The works start below the hero (and on phones below the
                  // profile too): none competes with the hero's image.
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>
          ))}
        </div>
      </section>
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
