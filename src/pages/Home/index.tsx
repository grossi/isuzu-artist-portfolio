import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import Featured from "components/molecules/Featured";
import Sidebar, { SidebarData } from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import aboutJa from "assets/md/about.ja.md?url";
import aboutEn from "assets/md/about.en.md?url";
import sidebarData from "sidebar.json";
import { SiX, SiPixiv, SiFiverr } from "react-icons/si";
import { MdEmail } from "react-icons/md";
import { Localized, useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  mainGrid: {
    // 3 + the 1 unit of item padding v4 Grid added
    marginTop: theme.spacing(4),
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
    <React.Fragment>
      <Featured />
      <Container maxWidth="xl" className={classes.mainContainer}>
        <main>
          <Grid container spacing={2} className={classes.mainGrid}>
            <Galery />
            <Sidebar
              title={t("home.profile")}
              description={about[lang]}
              entriesHeader={sidebar.heading[lang] || t("home.books")}
              entries={sidebar.entries.map((entry) => ({
                ...entry,
                image: `${import.meta.env.BASE_URL}${entry.image}`,
                description: entry.description[lang],
              }))}
              socialLinks={socialLinks}
            />
          </Grid>
        </main>
      </Container>
    </React.Fragment>
  );
}
