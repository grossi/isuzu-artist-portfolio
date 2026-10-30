import * as React from "react";
import { Link as RouterLink } from "react-router";
import { makeStyles } from "tss-react/mui";
import type { CSSObject } from "tss-react";
import Toolbar from "@mui/material/Toolbar";
import Link from "@mui/material/Link";
import ButtonBase from "@mui/material/ButtonBase";
import { Lang, useLanguage } from "i18n/LanguageContext";
import { TranslationKey } from "i18n/ja";

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.up("lg")]: {
      paddingRight: theme.spacing(12),
      paddingLeft: theme.spacing(12),
    },
    [theme.breakpoints.up("xl")]: {
      paddingRight: theme.spacing(16),
      paddingLeft: theme.spacing(16),
    },
  },
  toolbarTitle: {
    marginRight: "auto",
    "&:hover": {
      textDecoration: "none",
    },
    [theme.breakpoints.down("sm")]: {
      fontSize: "2.5rem",
    },
  },
  toolbarLink: {
    padding: theme.spacing(2),
    flexShrink: 0,
    [theme.breakpoints.down("sm")]: {
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(1),
    },
  },
  languageToggle: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: theme.spacing(1),
    color: theme.palette.text.secondary,
    // MUI's typography type and tss-react's CSSObject differ only in their CSS typings
    ...(theme.typography.body2 as CSSObject),
  },
  languageOption: {
    padding: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    font: "inherit",
    color: "inherit",
    "&:hover": {
      color: theme.palette.text.primary,
    },
  },
  languageOptionFocus: {
    outline: "2px solid currentColor",
    outlineOffset: 1,
  },
  languageOptionActive: {
    color: theme.palette.text.primary,
    fontWeight: 700,
  },
}));

// The Work and CV pages are still work in progress, so their links are hidden for now.
// The routes stay live by direct URL. Set this to true to show the links again; below
// 375px the header will then need the tighter title and padding from commit 81c4b6b.
const showSectionLinks = false;

const sections: Array<{ titleKey: TranslationKey; url: string }> = [
  { titleKey: "nav.work", url: "/work" },
  { titleKey: "nav.history", url: "/history" },
];

// Each language is labelled in its own language, so it reads the same either way.
const languages: Array<{ lang: Lang; label: string; ariaLabel?: string }> = [
  { lang: "ja", label: "日本語" },
  { lang: "en", label: "EN", ariaLabel: "English" },
];

interface HeaderProps {
  title: string;
}

export default function Header(props: HeaderProps) {
  const { classes, cx } = useStyles();
  const { title } = props;
  const { lang, setLang, t } = useLanguage();

  return (
    <Toolbar component="nav" variant="dense" className={classes.toolbar}>
      <Link
        component={RouterLink}
        to="/"
        color="inherit"
        noWrap
        variant="h2"
        className={classes.toolbarTitle}
      >
        {title}
      </Link>
      {showSectionLinks &&
        sections.map((section) => (
          <Link
            component={RouterLink}
            to={section.url}
            color="inherit"
            noWrap
            key={section.url}
            variant="subtitle1"
            className={classes.toolbarLink}
          >
            {t(section.titleKey)}
          </Link>
        ))}
      <div
        role="group"
        aria-label={t("header.language")}
        className={classes.languageToggle}
      >
        {languages.map((option, index) => (
          <React.Fragment key={option.lang}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <ButtonBase
              lang={option.lang}
              aria-label={option.ariaLabel}
              aria-pressed={lang === option.lang}
              onClick={() => setLang(option.lang)}
              focusVisibleClassName={classes.languageOptionFocus}
              className={cx(classes.languageOption, {
                [classes.languageOptionActive]: lang === option.lang,
              })}
            >
              {option.label}
            </ButtonBase>
          </React.Fragment>
        ))}
      </div>
    </Toolbar>
  );
}
