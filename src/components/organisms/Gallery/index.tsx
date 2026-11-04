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
  // The first work is shown large, uncropped, with the next two stacked
  // beside it; the rest follow in a grid of equal 4:5 tiles: three columns.
  //
  // The lead keeps its own shape (--lead-aspect, width / height) and sets the
  // block's height. The side column is as wide as two 4:5 tiles stacked to
  // that height need, but never narrower than one grid column, so a wide
  // lead doesn't squeeze them: they then turn a little wide themselves.
  // With W the block's width, a the lead's aspect and H its height:
  //   a·H + 16 + 0.4·(H − 16) = W  →  H = (W − 9.6px) / (a + 0.4)
  //   side = max((W − 32px) / 3, 0.4·(H − 16px))
  // On phones it is the old 2×2 block: a 4:5 lead across both columns, the
  // two side works as ordinary tiles below it.
  // The top block and the grid below it, one above the other.
  works: {
    display: "grid",
    gap: 16,
    [theme.breakpoints.down("sm")]: {
      gap: 10,
    },
  },
  top: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) max(calc((100% - 32px) / 3), calc(0.4 * ((100% - 9.6px) / (var(--lead-aspect) + 0.4) - 16px)))",
    gap: 16,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    },
  },
  lead: {
    aspectRatio: "var(--lead-aspect)",
    [theme.breakpoints.down("sm")]: {
      gridColumn: "span 2",
      aspectRatio: "4 / 5",
    },
  },
  side: {
    display: "grid",
    gridTemplateRows: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    // Its pictures must not size the row: the lead does.
    contain: "size",
    [theme.breakpoints.down("sm")]: {
      display: "contents",
    },
  },
  sideTile: {
    minHeight: 0,
    [theme.breakpoints.down("sm")]: {
      aspectRatio: "4 / 5",
    },
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
    [theme.breakpoints.down("sm")]: {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
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

  // The lead block needs a lead and two works beside it; with fewer, every
  // work is an ordinary tile.
  const featured = photos.length >= 3 ? photos.slice(0, 3) : [];
  const rest = photos.slice(featured.length);
  const lead = featured[0];
  // A size missing from gallery.json falls back to the tiles' 4:5.
  const aspect = lead ? lead.width / lead.height : NaN;
  const leadAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 5;

  const item = (photo: GalleryPhotoData, index: number, className: string) => (
    <div key={photo.src} role="listitem" className={className}>
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
  );

  return (
    <React.Fragment>
      <section className={className} aria-labelledby="home-works home-works-label">
        <SectionHeading id="home-works" title="Works" label={t("home.works")} size="large" />
        <div className={classes.works} aria-label={t("gallery.label")} role="list">
          {featured.length > 0 && (
            <div className={classes.top} style={{ "--lead-aspect": leadAspect } as React.CSSProperties}>
              {item(featured[0], 0, classes.lead)}
              <div className={classes.side}>
                {featured.slice(1).map((photo, i) => item(photo, i + 1, classes.sideTile))}
              </div>
            </div>
          )}
          {rest.length > 0 && (
            <div className={classes.grid}>
              {rest.map((photo, i) => item(photo, featured.length + i, classes.tile))}
            </div>
          )}
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
