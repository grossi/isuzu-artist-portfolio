import * as React from 'react';
import { makeStyles } from "tss-react/mui";
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useLanguage } from 'i18n/LanguageContext';
import { bodyFont } from 'theme';

const useStyles = makeStyles()((theme) => ({
  // The other pages (Work, CV) keep the footer they were made with.
  footer: {
    backgroundColor: theme.palette.background.paper,
    marginTop: theme.spacing(8),
    padding: theme.spacing(2),
  },
  // The home page's: a thin black bar, the copyright on the left, the site's
  // name on the right. On phones the two lines stack tightly so the bar stays thin.
  homeFooter: {
    marginTop: theme.spacing(12),
    backgroundColor: "#111",
    padding: "20px clamp(16px, 5vw, 80px)",
    fontFamily: bodyFont,
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

export default function Footer({ home = false }: { home?: boolean }) {
  const { classes } = useStyles();
  const { t } = useLanguage();
  const copyright = t('footer.copyright', { year: new Date().getFullYear() });

  if (!home) {
    return (
      <footer className={classes.footer}>
        <Container maxWidth="lg">
          <Typography variant="body2" color="text.secondary" align="center">
            {copyright}
          </Typography>
        </Container>
      </footer>
    );
  }
  return (
    <footer className={classes.homeFooter}>
      <div className={classes.inner}>
        <span>{copyright}</span>
        <span className={classes.name} lang="en">ILLUSTRATION GALLERY</span>
      </div>
    </footer>
  );
}
