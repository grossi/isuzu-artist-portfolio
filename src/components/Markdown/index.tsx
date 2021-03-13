import * as React from "react";
import ReactMarkdown from "markdown-to-jsx";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";

const useStyles = makeStyles((theme) => ({
  listItem: {
    marginTop: theme.spacing(1),
  },
  image: {},
}));

function MarkdownListItem(props: any) {
  const classes = useStyles();
  return (
    <li className={classes.listItem}>
      <Typography component="span" {...props} />
    </li>
  );
}

function MarkdownImage(props: any) {
  const classes = useStyles();
  console.log("props", props);
  return (
    <img
      alt={props.alt}
      src={props.src}
      title={props.title}
      className={classes.image}
    />
  );
}

const options = {
  overrides: {
    h1: {
      component: Typography,
      props: {
        gutterBottom: true,
        variant: "h5",
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
        paragraph: true,
      },
    },
    p: {
      component: Typography,
      props: { paragraph: true, variant: "body2" },
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
