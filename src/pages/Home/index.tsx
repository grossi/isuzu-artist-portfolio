import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Featured from "components/molecules/Featured";
import { Books, Profile, SidebarData } from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import aboutJa from "assets/md/about.ja.md?url";
import aboutEn from "assets/md/about.en.md?url";
import sidebarData from "sidebar.json";
import { SiX, SiPixiv, SiFiverr } from "react-icons/si";
import { MdEmail } from "react-icons/md";
import { ThemeProvider } from "@mui/material/styles";
import { Localized, useLanguage } from "i18n/LanguageContext";
import { bodyFont, homeTheme } from "theme";

// The sections come in reading order on phones: profile, works, books. Above
// 1080px the works take the left column and the profile, then the books, the
// right one (the works span both rows; the second row takes the extra height
// so the books sit right under the profile).
const useStyles = makeStyles()({
  page: {
    fontFamily: bodyFont,
  },
  main: {
    maxWidth: 1440,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: "72px clamp(16px, 5vw, 80px) 0",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 380px)",
    gridTemplateRows: "auto 1fr",
    alignItems: "start",
    columnGap: 64,
    rowGap: 56,
    "@media (max-width: 1080px)": {
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: 56,
    },
  },
  works: {
    gridColumn: 1,
    gridRow: "1 / span 2",
    minWidth: 0,
  },
  profile: {
    gridColumn: 2,
    gridRow: 1,
    minWidth: 0,
  },
  books: {
    gridColumn: 2,
    gridRow: 2,
    minWidth: 0,
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
          <Profile
            className={classes.profile}
            title={t("home.profile")}
            description={about[lang]}
            socialLinks={socialLinks}
          />
          <Galery className={classes.works} />
          <Books
            className={classes.books}
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
          />
        </main>
      </div>
    </ThemeProvider>
  );
}
