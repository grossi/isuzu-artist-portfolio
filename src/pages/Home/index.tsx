import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Featured from "components/molecules/Featured";
import Sidebar, { SidebarData } from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import aboutJa from "assets/md/about.ja.md?url";
import aboutEn from "assets/md/about.en.md?url";
import sidebarData from "sidebar.json";
import { SiX, SiPixiv, SiFiverr } from "react-icons/si";
import { MdEmail } from "react-icons/md";
import { ThemeProvider } from "@mui/material/styles";
import { Localized, useLanguage } from "i18n/LanguageContext";
import { bodyFont, homeTheme } from "theme";

// Works on the left, profile and books on the right. When the two columns
// stack (phones, narrow tablets) the order becomes profile, works, books:
// see STACKED in the Gallery and Sidebar components.
const useStyles = makeStyles()({
  page: {
    fontFamily: bodyFont,
  },
  main: {
    maxWidth: 1440,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "72px clamp(16px, 5vw, 80px) 0",
    display: "flex",
    // Side by side down to 1081px, where the two bases (560 + 380 + the gap)
    // don't quite fit: wrapping there would put the profile under every work.
    alignItems: "flex-start",
    gap: 64,
    "@media (max-width: 1080px)": {
      flexDirection: "column",
      alignItems: "stretch",
      gap: 56,
    },
  },
});

const about: Localized<string> = { ja: aboutJa, en: aboutEn };

// Generated from src/sidebar-content.json by `yarn build-images`
const sidebar: SidebarData = sidebarData;

export default function Home() {
  const { classes } = useStyles();
  const { lang, t } = useLanguage();

  const socialLinks = [
    { label: "X", href: "https://x.com/y_isuZu", Icon: SiX },
    { label: "pixiv", href: "https://www.pixiv.net/member.php?id=124098", Icon: SiPixiv },
    { label: "Fiverr", href: "https://www.fiverr.com/y_isuzu", Icon: SiFiverr },
    { label: t("social.email"), href: "mailto:isuzu@bj8.so-net.ne.jp", Icon: MdEmail },
  ];

  return (
    <ThemeProvider theme={homeTheme}>
      <div className={classes.page}>
        <Featured />
        <main className={classes.main}>
          <Galery />
          <Sidebar
            title={t("home.profile")}
            description={about[lang]}
            entriesHeader={sidebar.heading[lang] || t("home.books")}
            entries={sidebar.entries.map((entry) => ({
              ...entry,
              image: `${import.meta.env.BASE_URL}${entry.image}`,
              description: entry.description[lang],
              previousEditions: entry.previousEditions.map((edition) => ({
                ...edition,
                image: `${import.meta.env.BASE_URL}${edition.image}`,
                title: edition.title[lang],
                edition: edition.edition[lang],
              })),
            }))}
            socialLinks={socialLinks}
          />
        </main>
      </div>
    </ThemeProvider>
  );
}
