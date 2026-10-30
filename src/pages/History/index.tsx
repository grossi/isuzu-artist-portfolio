import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Container from "@mui/material/Container";
import CardMedia from "@mui/material/CardMedia";
import workHistoryJa from "assets/md/work_history.ja.md?url";
import workHistoryEn from "assets/md/work_history.en.md?url";
import Markdown from "components/molecules/Markdown";
import useMarkdown from "hooks/useMarkdown";
import { Localized, useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  mainGrid: {
    paddingTop: theme.spacing(3),
    // Same layout the v4 Grid container (spacing={2}) had
    display: "flex",
    flexWrap: "wrap",
    margin: theme.spacing(-1),
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
  const { classes } = useStyles();
  const { lang } = useLanguage();
  const loadedAbout = useMarkdown(workHistory[lang]);

  return (
    <React.Fragment>
      <CardMedia
        component="img"
        height={120}
        src={`${import.meta.env.BASE_URL}isuzubook.webp`}
      />
      <Container maxWidth="lg" className={classes.mainContainer}>
        <main>
          <div className={classes.mainGrid}>
            <Markdown>{loadedAbout}</Markdown>
          </div>
        </main>
      </Container>
    </React.Fragment>
  );
}
