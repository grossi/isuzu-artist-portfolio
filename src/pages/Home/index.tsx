import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Featured from "components/molecules/Featured";
import Sidebar from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import about from "assets/md/about.md";
import about_book from "assets/md/about_book.md";
import about_book2 from "assets/md/about_book2.md";

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
  firstBookHeader: "My first book",
  firstBookDescription: about_book,
  secondBookHeader: "My new book",
  secondBookDescription: about_book2,
  bookLink: "https://www.amazon.co.jp/o/ASIN/4774197793/gihyojp-22",
  book2Link: "https://www.amazon.co.jp/o/ASIN/4297128349/gihyojp-22",
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
              firstBookHeader={sidebar.firstBookHeader}
              firstBookDescription={sidebar.firstBookDescription}
              secondBookHeader={sidebar.secondBookHeader}
              secondBookDescription={sidebar.secondBookDescription}
              bookLink={sidebar.bookLink}
              book2Link={sidebar.book2Link}
              socialLinks={sidebar.socialLinks}
            />
          </Grid>
        </main>
      </Container>
    </React.Fragment>
  );
}
