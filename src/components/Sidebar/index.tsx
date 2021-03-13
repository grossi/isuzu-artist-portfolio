import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Markdown from "components/Markdown";
import CardMedia from "@material-ui/core/CardMedia";

const useStyles = makeStyles((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
    marginBottom: theme.spacing(3),
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
}));

interface SidebarProps {
  title: string;
  description: string;
  secondaryTitle: string;
  secondaryDescription: string;
}

export default function Sidebar(props: SidebarProps) {
  const classes = useStyles();
  const { title, description, secondaryTitle, secondaryDescription } = props;
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
    <Grid item xs={12} md={4}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Markdown>{loadedAbout}</Markdown>
      </Paper>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h4" gutterBottom>
          {secondaryTitle}
        </Typography>
        <CardMedia component="img" src={`${process.env.PUBLIC_URL}/isuzubook.jpg`} />
        <Markdown>{loadedSecondaryAbout}</Markdown>
      </Paper>
    </Grid>
  );
}