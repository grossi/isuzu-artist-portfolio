import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Markdown from "components/Markdown";
import Link from "@material-ui/core/Link";
import CardMedia from "@material-ui/core/CardMedia";
import Avatar from "@material-ui/core/Avatar";

const useStyles = makeStyles((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
    marginBottom: theme.spacing(3),
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
  avatarGrid: {
    marginBottom: theme.spacing(2),
  },
  avatar: {
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  sidebarGrid: {
    order: 2,
    [theme.breakpoints.down("sm")]: {
      order: 1,
    },
  },
}));

interface SidebarProps {
  title: string;
  description: string;
  secondaryTitle: string;
  secondaryDescription: string;
  bookLink: string;
}

export default function Sidebar(props: SidebarProps) {
  const classes = useStyles();
  const {
    title,
    description,
    secondaryTitle,
    secondaryDescription,
    bookLink,
  } = props;
  const [loadedAbout, setLoadedAbout] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedAbout("");
    fetch(description)
      .then((data) => data.text())
      .then((text) => {
        setLoadedAbout(text);
      });
  }, [description]);
  const [
    loadedSecondaryAbout,
    setLoadedSecondaryAbout,
  ] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedSecondaryAbout("");
    fetch(secondaryDescription)
      .then((data) => data.text())
      .then((text) => {
        setLoadedSecondaryAbout(text);
      });
  }, [secondaryDescription]);

  return (
    <Grid item xs={12} md={4} className={classes.sidebarGrid}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Grid container direction="row" alignItems="center" spacing={2} className={classes.avatarGrid}>
          <Grid item>
            <Avatar className={classes.avatar} alt="isuZu" src={`${process.env.PUBLIC_URL}/isuzu.jpg`} />
          </Grid>
          <Grid item>
            <Typography variant="h4">isuZu</Typography>
          </Grid>
        </Grid>
        <Markdown>{loadedAbout}</Markdown>
      </Paper>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h4" gutterBottom>
          {secondaryTitle}
        </Typography>
        <Link href={bookLink}>
          <CardMedia
            component="img"
            src={`${process.env.PUBLIC_URL}/isuzubook.jpg`}
          />
        </Link>
        <Markdown>{loadedSecondaryAbout}</Markdown>
      </Paper>
    </Grid>
  );
}
