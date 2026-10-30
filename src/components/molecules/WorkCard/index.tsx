import React from "react";
import { makeStyles } from "tss-react/mui";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import Collapse from "@mui/material/Collapse";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CloseIcon from "@mui/icons-material/Close";

import Markdown from "components/molecules/Markdown";
import PhotoGallery, { RenderImageProps } from "react-photo-gallery";
import useMarkdown from "hooks/useMarkdown";
import { Localized, useLanguage } from "i18n/LanguageContext";
import GalleryPhoto, { GalleryPhotoData, GalleryPhotoSource, usePhotoAlts } from "components/atoms/GalleryPhoto";

const useStyles = makeStyles()((theme) => ({
  root: {
    width: "100%",
    marginBottom: theme.spacing(2),
  },
  closeButton: {
    position: "absolute",
    right: theme.spacing(1),
    top: theme.spacing(1),
    color: theme.palette.grey[200],
  },
  mainContent: {
    display: 'flex',
    alignItems: 'center',
  },
  expand: {
    height: 'fit-content',
    transform: 'rotate(0deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
  expandOpen: {
    transform: 'rotate(180deg)',
  },
}));

interface WorkCardProps {
  open?: boolean;
  setOpen?: (value: (state: any) => boolean) => any;
  work: {
    name: string;
    about: Localized<string>;
    banner: { src: string; name: string };
    imageList: GalleryPhotoSource[];
  };
}

const calculateTargetRowHeight = (containerWidth: number) => {
  if (containerWidth > 800) {
    return 300;
  } else {
    return 200;
  }
};

const calculateLimitNodeSearch = (containerWidth: number) => {
  if (containerWidth > 800) {
    return 10;
  } else {
    return 8;
  }
};

export default function WorkCard(props: WorkCardProps) {
  const { classes, cx } = useStyles();
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [viewerIsOpen, setViewerIsOpen] = React.useState(false);
  const [galleryIsOpen, setGalleryIsOpen] = React.useState(false);
  // The gallery stays mounted so Collapse can measure it, but its images are only
  // downloaded once the card has been opened.
  const [galleryWasOpened, setGalleryWasOpened] = React.useState(false);
  const renderPhoto = React.useCallback(
    (photoProps: RenderImageProps) =>
      GalleryPhoto({ ...photoProps, deferred: !galleryWasOpened }),
    [galleryWasOpened]
  );
  const { work } = props;
  const { lang, t } = useLanguage();
  const loadedAbout = useMarkdown(work.about[lang]);
  const bannerAlt = t("workCard.bannerAlt", { name: work.name });
  const photos = usePhotoAlts(work.imageList);
  const currentImage: GalleryPhotoData | undefined = photos[currentIndex];

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentIndex(index);
    setViewerIsOpen(true);
  }, []);

  return (
    <React.Fragment>
      <Card className={classes.root}>
        <CardActionArea
          onClick={() => {
            setGalleryIsOpen((state) => !state);
            setGalleryWasOpened(true);
          }}
          aria-expanded={galleryIsOpen}
        >
          <CardMedia
            component="img"
            alt={bannerAlt}
            height="60"
            image={work.banner.src}
            title={bannerAlt}
          />
          <CardContent className={classes.mainContent}>
            <Markdown>{loadedAbout}</Markdown>
            {/* Decorative: the whole CardActionArea is the toggle button */}
            <IconButton
              component="span"
              tabIndex={-1}
              role="presentation"
              aria-hidden
              className={cx(classes.expand, {
                [classes.expandOpen]: galleryIsOpen,
              })}
            >
              <ExpandMoreIcon />
            </IconButton>
          </CardContent>
        </CardActionArea>
        <Collapse in={galleryIsOpen}>
          <PhotoGallery
            onClick={openDialog}
            targetRowHeight={calculateTargetRowHeight}
            photos={photos}
            limitNodeSearch={calculateLimitNodeSearch}
            renderImage={renderPhoto}
          />
        </Collapse>
      </Card>
      <Dialog
        open={viewerIsOpen}
        onClose={() => setViewerIsOpen(false)}
        scroll="body"
        maxWidth="xl"
      >
        <CardMedia component="img" src={currentImage?.srcBig} alt={currentImage?.alt} />
        <IconButton
          aria-label={t("common.close")}
          className={classes.closeButton}
          onClick={() => setViewerIsOpen(false)}
        >
          <CloseIcon />
        </IconButton>
      </Dialog>
    </React.Fragment>
  );
}
