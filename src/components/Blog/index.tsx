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
      <Container disableGutters maxWidth="lg">
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
