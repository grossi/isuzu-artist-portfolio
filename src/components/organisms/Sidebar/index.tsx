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
import { Localized, useLanguage } from "i18n/LanguageContext";

const useStyles = makeStyles()((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
    marginBottom: theme.spacing(3),
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
  previousEditions: {
    // Nest past editions under this book, with a larger gap before the next book.
    marginInlineStart: theme.spacing(2),
    marginTop: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    borderBottom: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(3),
    // The last book has no next book to separate from.
    "&:last-child": {
      paddingBottom: 0,
      borderBottom: 0,
      marginBottom: 0,
    },
  },
  editionsList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  editionLink: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    minHeight: 64,
    paddingBlock: theme.spacing(0.5),
    color: theme.palette.text.primary,
    "&:focus-visible": {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 3,
    },
  },
  editionCover: {
    width: 40,
    height: 56,
    objectFit: "contain",
    flexShrink: 0,
  },
  editionText: {
    flex: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
  editionTitle: {
    display: "block",
    fontSize: "0.75rem",
    lineHeight: 1.5,
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

// The shape of src/sidebar.json
export interface SidebarData {
  heading: Localized<string>;
  entries: Array<{
    id: string;
    image: string;
    link: string | null;
    description: Localized<string>;
    previousEditions: Array<{ id: string; image: string; link: string; title: Localized<string>; edition: Localized<string> }>;
  }>;
}

interface Entry {
  id: string;
  image: string;
  link: string | null;
  description: string;
  previousEditions: Array<{
    id: string;
    image: string;
    link: string;
    title: string;
    edition: string;
  }>;
}

interface SidebarProps {
  title: string;
  description: string;
  entriesHeader: string;
  entries: Entry[];
  socialLinks: SocialLink[];
}

function SidebarEntry(props: Entry) {
  const { classes } = useStyles();
  const { t } = useLanguage();
  const headingId = React.useId();
  const image = <CardMedia component="img" src={props.image} />;
  return (
    <React.Fragment>
      {props.link ? <Link href={props.link}>{image}</Link> : image}
      {props.description.trim() && <Markdown>{props.description}</Markdown>}
      {props.previousEditions.length > 0 && (
        <section className={classes.previousEditions} aria-labelledby={headingId}>
          {/* Under the box's h4 heading */}
          <Typography component="h5" variant="subtitle2" id={headingId} gutterBottom>
            {t("sidebar.previousEditions")}
          </Typography>
          <ul className={classes.editionsList}>
            {props.previousEditions.map((edition) => (
              <li key={edition.id}>
                <Link href={edition.link} className={classes.editionLink}>
                  <img src={edition.image} alt="" width={40} height={56} loading="lazy" className={classes.editionCover} />
                  <span className={classes.editionText}>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {edition.edition}
                    </Typography>
                    <span className={classes.editionTitle}>{edition.title}</span>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </React.Fragment>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { classes } = useStyles();
  const { title, description, entriesHeader, entries, socialLinks } = props;
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
      {entries.length > 0 && (
        <Paper elevation={0} className={classes.sidebarAboutBox}>
          <Typography variant="h4" gutterBottom>
            {entriesHeader}
          </Typography>
          {entries.map((entry) => (
            <SidebarEntry key={entry.id} {...entry} />
          ))}
        </Paper>
      )}
    </Grid>
  );
}
