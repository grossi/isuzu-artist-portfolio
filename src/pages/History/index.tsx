import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import CardMedia from "@material-ui/core/CardMedia";
import workHistoryJa from "assets/md/work_history.ja.md";
import workHistoryEn from "assets/md/work_history.en.md";
import Markdown from "components/molecules/Markdown";
import useMarkdown from "hooks/useMarkdown";
import { Localized, useLanguage } from "i18n/LanguageContext";

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

const workHistory: Localized<string> = { ja: workHistoryJa, en: workHistoryEn };

export default function History() {
  const classes = useStyles();
  const { lang } = useLanguage();
  const loadedAbout = useMarkdown(workHistory[lang]);

  return (
    <React.Fragment>
      <CardMedia
        component="img"
        height={120}
        src={`${process.env.PUBLIC_URL}/isuzubook.webp`}
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
