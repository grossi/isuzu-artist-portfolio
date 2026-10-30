import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import clsx from "clsx";
import { makeStyles } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Link from "@material-ui/core/Link";
import ButtonBase from "@material-ui/core/ButtonBase";
import { Lang, useLanguage } from "i18n/LanguageContext";
import { TranslationKey } from "i18n/ja";

const useStyles = makeStyles((theme) => ({
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
    [theme.breakpoints.down("xs")]: {
      fontSize: "2.5rem",
    },
  },
  toolbarLink: {
    padding: theme.spacing(2),
    flexShrink: 0,
    [theme.breakpoints.down("xs")]: {
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
    ...theme.typography.body2,
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
  languageOptionActive: {
    color: theme.palette.text.primary,
    fontWeight: 700,
  },
}));

const sections: Array<{ titleKey: TranslationKey; url: string }> = [
  { titleKey: "nav.work", url: "/work" },
  { titleKey: "nav.history", url: "/history" },
];

// Each language is labelled in its own language, so it reads the same either way.
const languages: Array<{ lang: Lang; label: string }> = [
  { lang: "ja", label: "日本語" },
  { lang: "en", label: "EN" },
];

interface HeaderProps {
  title: string;
}

export default function Header(props: HeaderProps) {
  const classes = useStyles();
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
      {sections.map((section) => (
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
              aria-pressed={lang === option.lang}
              onClick={() => setLang(option.lang)}
              className={clsx(classes.languageOption, {
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
