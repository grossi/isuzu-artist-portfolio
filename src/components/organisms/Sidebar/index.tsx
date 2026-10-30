import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Markdown from "components/molecules/Markdown";
import Link from "@mui/material/Link";
import CardMedia from "@mui/material/CardMedia";
import Avatar from "@mui/material/Avatar";
import SocialLinks, { SocialLink } from "components/molecules/SocialLinks";
import useMarkdown from "hooks/useMarkdown";
import { useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
    marginBottom: theme.spacing(3),
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
  avatarGrid: {
    // 2 + the 1 unit of item padding v4 Grid added
    marginBottom: theme.spacing(3),
  },
  avatar: {
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  sidebarGrid: {
    order: 2,
    [theme.breakpoints.down("md")]: {
      order: 1,
    },
  },
}));

interface Book {
  link: string;
  image: string;
  description: string;
}

interface SidebarProps {
  title: string;
  description: string;
  booksHeader: string;
  books: Book[];
  socialLinks: SocialLink[];
}

function BookEntry(props: Book) {
  const description = useMarkdown(props.description);
  return (
    <React.Fragment>
      <Link href={props.link}>
        <CardMedia component="img" src={props.image} />
      </Link>
      <Markdown>{description}</Markdown>
    </React.Fragment>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { classes } = useStyles();
  const { title, description, booksHeader, books, socialLinks } = props;
  const { t } = useLanguage();
  const loadedAbout = useMarkdown(description);

  return (
    <Grid size={{ xs: 12, md: 4 }} className={classes.sidebarGrid}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Grid container direction="row" alignItems="center" spacing={2} className={classes.avatarGrid}>
          <Grid>
            <Avatar className={classes.avatar} alt={t("sidebar.avatarAlt")} src={`${import.meta.env.BASE_URL}isuzu.jpg`} />
          </Grid>
          <Grid>
            <Typography variant="h4">isuZu</Typography>
          </Grid>
        </Grid>
        <Markdown>{loadedAbout}</Markdown>
        <SocialLinks socialLinks={socialLinks} />
      </Paper>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h4" gutterBottom>
          {booksHeader}
        </Typography>
        {books.map((book) => (
          <BookEntry key={book.link} {...book} />
        ))}
      </Paper>
    </Grid>
  );
}
