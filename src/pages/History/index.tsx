import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import CardMedia from "@material-ui/core/CardMedia";
import work_history from "assets/md/work_history.md";
import Markdown from "components/Markdown";

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    paddingTop: theme.spacing(3),
  },
  mainContainer: {
    minHeight: "100%",
    backgroundColor: theme.palette.background.paper,
    paddingTop: theme.spacing(3),
    [theme.breakpoints.up("xs")]: {
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1),
    },
    [theme.breakpoints.up("sm")]: {
      paddingRight: theme.spacing(2),
      paddingLeft: theme.spacing(2),
    },
    [theme.breakpoints.up("md")]: {
      paddingRight: theme.spacing(6),
      paddingLeft: theme.spacing(6),
    },
    [theme.breakpoints.up("lg")]: {
      paddingRight: theme.spacing(12),
      paddingLeft: theme.spacing(12),
    },
    [theme.breakpoints.up("xl")]: {
      paddingRight: theme.spacing(16),
      paddingLeft: theme.spacing(16),
    },
  },
}));

export default function History() {
  const classes = useStyles();
  const [loadedAbout, setLoadedAbout] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedAbout("");
    fetch(work_history)
      .then((data) => data.text())
      .then((text) => {
        setLoadedAbout(text);
      });
  }, []);

  return (
    <React.Fragment>
      <CardMedia
        component="img"
        height={120}
        src={`${process.env.PUBLIC_URL}/isuzubook.jpg`}
      />
      <Container maxWidth="lg" className={classes.mainContainer}>
        <main>
          <Grid container spacing={2} className={classes.mainGrid}>
            <Markdown>{loadedAbout}</Markdown>
          </Grid>
        </main>
      </Container>
    </React.Fragment>
  );
}
