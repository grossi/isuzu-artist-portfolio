import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Featured from "components/molecules/Featured";
import Sidebar from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import about from "assets/md/about.md";
import about_book from "assets/md/about_book.md";

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    marginTop: theme.spacing(3),
  },
  mainContainer: {
    minHeight: "100%",
    marginTop: theme.spacing(3),
    [theme.breakpoints.up('xs')]: {
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1)
    },
    [theme.breakpoints.up('sm')]: {
      paddingRight: theme.spacing(2),
      paddingLeft: theme.spacing(2)
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

const sidebar = {
  title: "プロフィール",
  description: about,
  secondaryTitle: "My BOOK",
  secondaryDescription: about_book,
  bookLink: "https://www.amazon.co.jp/o/ASIN/4774197793/gihyojp-22",
  socialLinks: {
    twitter: 'https://twitter.com/y_isuZu',
    pixiv: 'http://www.pixiv.net/member.php?id=124098',
    email: 'mailto:isuzu@bj8.so-net.ne.jp',
  }
};

export default function Home() {
  const classes = useStyles();

  return (
    <React.Fragment>
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
              bookLink={sidebar.bookLink}
              socialLinks={sidebar.socialLinks}
            />
          </Grid>
        </main>
      </Container>
    </React.Fragment>
  );
}
