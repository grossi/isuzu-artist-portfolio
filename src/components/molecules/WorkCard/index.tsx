import React from "react";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardActionArea from "@material-ui/core/CardActionArea";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import IconButton from "@material-ui/core/IconButton";
import Dialog from "@material-ui/core/Dialog";
import Collapse from "@material-ui/core/Collapse";

import ExpandMoreIcon from "@material-ui/icons/ExpandMore";
import CloseIcon from "@material-ui/icons/Close";

import Markdown from "components/molecules/Markdown";
import PhotoGallery, { RenderImageProps } from "react-photo-gallery";
import useMarkdown from "hooks/useMarkdown";
import { Localized, useLanguage } from "i18n/LanguageContext";
import GalleryPhoto, { GalleryPhotoData } from "components/atoms/GalleryPhoto";

const useStyles = makeStyles((theme) => ({
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
    imageList: GalleryPhotoData[];
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
  const classes = useStyles();
  const [currentImage, setCurrentImage] = React.useState<GalleryPhotoData>();
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

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentImage(photo);
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
            <IconButton
              className={clsx(classes.expand, {
                [classes.expandOpen]: galleryIsOpen,
              })}
              aria-expanded={galleryIsOpen}
              aria-label={t("workCard.showMore")}
            >
              <ExpandMoreIcon />
            </IconButton>
          </CardContent>
        </CardActionArea>
        <Collapse in={galleryIsOpen}>
          <PhotoGallery
            onClick={openDialog}
            targetRowHeight={calculateTargetRowHeight}
            photos={work.imageList}
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
