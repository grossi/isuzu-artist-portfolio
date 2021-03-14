import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Footer from "./Footer";
import Header from "components/Header";
import Featured from "components/Featured";
import Sidebar from "components/Sidebar";
import Galery from 'components/Gallery';
import about from "assets/md/about.md";
import about_book from "assets/md/about_book.md";

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    marginTop: theme.spacing(3),
  },
  mainContainer: {
    marginTop: theme.spacing(3),
    [theme.breakpoints.up('xs')]: {
      paddingRight: 0,
      paddingLeft: 0
    },
    [theme.breakpoints.up('sm')]: {
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1)
    },
    [theme.breakpoints.up('md')]: {
      paddingRight: theme.spacing(6),
      paddingLeft: theme.spacing(6)
    },
    [theme.breakpoints.up('lg')]: {
      paddingRight: theme.spacing(12),
      paddingLeft: theme.spacing(12)
    },
    [theme.breakpoints.up('xl')]: {
      paddingRight: theme.spacing(16),
      paddingLeft: theme.spacing(16)
    },
  },
}));

const sections = [
  { title: "Portifolio", url: "#" },
  { title: "Contact", url: "#" },
  { title: "Book", url: "#" },
];

const sidebar = {
  title: "プロフィール",
  description: about,
  secondaryTitle: "My BOOK",
  secondaryDescription: about_book,
};

export default function Blog() {
  const classes = useStyles();

  return (
    <React.Fragment>
      <CssBaseline />
      <Header title="isuZu" sections={sections} />
      <Featured />
      <Container maxWidth="xl" className={classes.mainContainer}>
        <main>
          <Grid container spacing={2} className={classes.mainGrid}>
            <Galery />
            <Sidebar
              title={sidebar.title}
              description={sidebar.description}
              secondaryTitle={sidebar.secondaryTitle}
              secondaryDescription={sidebar.secondaryDescription}
            />
          </Grid>
        </main>
      </Container>
      <Footer
        title="isuZu"
        description="Footer Text"
      />
    </React.Fragment>
  );
}
