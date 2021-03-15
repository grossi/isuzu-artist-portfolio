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

import Markdown from "components/Markdown";
import PhotoGallery from "react-photo-gallery";

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
    about: string;
    banner: { src: string; name: string };
    imageList: { src: string; height: number; width: number; name: string }[];
  };
}

const calculateTargetRowHeight = (containerWidth: number) => {
  if (containerWidth > 800) {
    return 300;
  } else {
    return 200;
  }
};

export default function WorkCard(props: WorkCardProps) {
  const classes = useStyles();
  const [currentImage, setCurrentImage] = React.useState("");
  const [viewerIsOpen, setViewerIsOpen] = React.useState(false);
  const [galleryIsOpen, setGalleryIsOpen] = React.useState(false);
  const { work } = props;
  const [loadedAbout, setLoadedAbout] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedAbout("");
    fetch(work.about)
      .then((data) => data.text())
      .then((text) => {
        setLoadedAbout(text);
      });
  }, [work.about]);

  const openDialog = React.useCallback((event, { photo, index }) => {
    setCurrentImage(photo.src);
    setViewerIsOpen(true);
  }, []);

  return (
    <React.Fragment>
      <Card className={classes.root}>
        <CardActionArea onClick={() => setGalleryIsOpen((state) => !state)}>
          <CardMedia
            component="img"
            alt={`${work.name} banner`}
            height="60"
            image={work.banner.src}
            title={`${work.name} banner`}
          />
          <CardContent className={classes.mainContent}>
            <Markdown>{loadedAbout}</Markdown>
            <IconButton
              className={clsx(classes.expand, {
                [classes.expandOpen]: galleryIsOpen,
              })}
              aria-expanded={galleryIsOpen}
              aria-label="show more"
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
          />
        </Collapse>
      </Card>
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
