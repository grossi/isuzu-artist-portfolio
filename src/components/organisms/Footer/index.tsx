import * as React from 'react';
import { makeStyles } from "tss-react/mui";
import { useLanguage } from 'i18n/LanguageContext';

// A thin black bar: the copyright on the left, the site's name on the right.
// On phones the two lines stack tightly so the bar stays thin.
const useStyles = makeStyles()((theme) => ({
  footer: {
    marginTop: theme.spacing(12),
    backgroundColor: "#111",
    padding: "20px clamp(16px, 5vw, 80px)",
    [theme.breakpoints.down("sm")]: {
      paddingTop: 8,
      paddingBottom: 8,
    },
  },
  inner: {
    maxWidth: 1440 - 160,
    margin: "0 auto",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#bdbdbd",
    [theme.breakpoints.down("sm")]: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 0,
      fontSize: 11,
    },
  },
  name: {
    letterSpacing: "0.3em",
  },
}));

export default function Footer() {
  const { classes } = useStyles();
  const { t } = useLanguage();

  return (
    <footer className={classes.footer}>
      <div className={classes.inner}>
        <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
        <span className={classes.name} lang="en">ILLUSTRATION GALLERY</span>
      </div>
    </footer>
  );
}
