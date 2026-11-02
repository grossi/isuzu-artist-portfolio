import * as React from "react";
import { makeStyles } from "tss-react/mui";
import { Lang, useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()({
  group: {
    display: "flex",
    alignItems: "center",
  },
  option: {
    position: "relative",
    minHeight: 44,
    padding: "0 10px",
    border: 0,
    background: "none",
    cursor: "pointer",
    font: "inherit",
    fontSize: 13,
    letterSpacing: "0.12em",
    color: "#6b6b6b",
    "&:hover": { color: "#111" },
    "&:focus-visible": { outline: "2px solid #3f51b5", outlineOffset: 2 },
  },
  active: {
    color: "#111",
    fontWeight: 700,
    // A short rule under the language in use
    "&::after": {
      content: '""',
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 9,
      height: 1,
      background: "#111",
    },
  },
  divider: {
    width: 1,
    height: 12,
    background: "#bdbdbd",
  },
});

// Each language is labelled in its own language, so it reads the same either way.
const languages: Array<{ lang: Lang; label: string; ariaLabel?: string }> = [
  { lang: "ja", label: "日本語" },
  { lang: "en", label: "EN", ariaLabel: "English" },
];

/** The 日本語 | EN switch under the home page's hero. */
export default function LanguageSwitch() {
  const { classes, cx } = useStyles();
  const { lang, setLang, t } = useLanguage();
  return (
    <div role="group" aria-label={t("header.language")} className={classes.group}>
      {languages.map((option, index) => (
        <React.Fragment key={option.lang}>
          {index > 0 && <span aria-hidden="true" className={classes.divider} />}
          <button
            type="button"
            lang={option.lang}
            aria-label={option.ariaLabel}
            aria-pressed={lang === option.lang}
            onClick={() => setLang(option.lang)}
            className={cx(classes.option, { [classes.active]: lang === option.lang })}
          >
            {option.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
