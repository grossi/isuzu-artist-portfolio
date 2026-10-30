import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import Featured from "components/molecules/Featured";
import Sidebar from "components/organisms/Sidebar";
import Galery from 'components/organisms/Gallery';
import aboutJa from "assets/md/about.ja.md?url";
import aboutEn from "assets/md/about.en.md?url";
import aboutBookJa from "assets/md/about_book.ja.md?url";
import aboutBookEn from "assets/md/about_book.en.md?url";
import aboutBook2Ja from "assets/md/about_book2.ja.md?url";
import aboutBook2En from "assets/md/about_book2.en.md?url";
import aboutBook3Ja from "assets/md/about_book3.ja.md?url";
import aboutBook3En from "assets/md/about_book3.en.md?url";
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

const books: Array<{ link: string; image: string; description: Localized<string> }> = [
  {
    link: "https://www.amazon.co.jp/dp/429713134X",
    image: `${import.meta.env.BASE_URL}isuzubook.webp`,
    description: { ja: aboutBookJa, en: aboutBookEn },
  },
  {
    link: "https://www.amazon.co.jp/o/ASIN/4297128349/gihyojp-22",
    image: `${import.meta.env.BASE_URL}isuzubook2.webp`,
    description: { ja: aboutBook2Ja, en: aboutBook2En },
  },
  {
    link: "https://amazon.co.jp/dp/4297149761",
    image: `${import.meta.env.BASE_URL}isuzubook3.webp`,
    description: { ja: aboutBook3Ja, en: aboutBook3En },
  },
];

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
              booksHeader={t("home.books")}
              books={books.map((book) => ({
                ...book,
                description: book.description[lang],
              }))}
              socialLinks={socialLinks}
            />
          </Grid>
        </main>
      </Container>
    </React.Fragment>
  );
}
