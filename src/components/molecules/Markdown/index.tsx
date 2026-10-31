import * as React from "react";
import ReactMarkdown from "markdown-to-jsx";
import { makeStyles } from "tss-react/mui";
import Typography from "@mui/material/Typography";
import CardMedia from "@mui/material/CardMedia";
import Link from "@mui/material/Link";

const useStyles = makeStyles()((theme) => ({
  listItem: {
    marginTop: theme.spacing(1),
  },
  boldText: {
    fontWeight: 700,
  },
  image: {},
}));

function MarkdownListItem(props: any) {
  const { classes } = useStyles();
  return (
    <li className={classes.listItem}>
      <Typography component="span" {...props} />
    </li>
  );
}

function MarkdownImage(props: any) {
  const { classes } = useStyles();
  return (
    <CardMedia
      className={classes.image}
      component="img"
      src={props.src}
      title={props.title}
      alt={props.alt}
    />
  );
}

// Links and images may only point to http(s), mailto or relative URLs.
// markdown-to-jsx's default only blocks a few schemes (javascript:, ...).
export function safeUrl(url: string): string | null {
  // Browsers ignore control characters and whitespace inside a scheme ("java\tscript:").
  const compact = Array.from(url).filter((c) => c.charCodeAt(0) > 0x20 && c.charCodeAt(0) !== 0x7f).join("");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  return !scheme || ["http", "https", "mailto"].includes(scheme[1].toLowerCase()) ? url : null;
}

// Markdown text is written in the admin console: raw HTML is shown as text,
// never turned into elements (no <script>, <iframe srcdoc>, onerror=...).
const options = {
  disableParsingRawHTML: true,
  sanitizer: safeUrl,
  overrides: {
    h1: {
      component: Typography,
      props: {
        gutterBottom: true,
        variant: "h4",
      },
    },
    h2: {
      component: Typography,
      props: { gutterBottom: true, variant: "h6" },
    },
    h3: {
      component: Typography,
      props: { gutterBottom: true, variant: "overline" },
    },
    h4: {
      component: Typography,
      props: {
        gutterBottom: true,
        variant: "caption",
        component: "p",
        sx: { mb: 2 },
      },
    },
    p: {
      component: Typography,
      props: { variant: "body2", sx: { mb: 2 } },
    },
    a: { component: Link },
    li: {
      component: MarkdownListItem,
    },
    image: { component: MarkdownImage },
  },
};

export default function Markdown(props: any) {
  return <ReactMarkdown options={options} {...props} />;
}
