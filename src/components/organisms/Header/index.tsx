import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Toolbar from "@material-ui/core/Toolbar";
import Link from "@material-ui/core/Link";

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
    marginRight: 'auto',
    "&:hover": {
      textDecoration: "none",
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
}));

interface HeaderProps {
  sections: Array<{
    title: string;
    url: string;
  }>;
  title: string;
}

export default function Header(props: HeaderProps) {
  const classes = useStyles();
  const { title, sections } = props;

  return (
    <Toolbar component="nav" variant="dense" className={classes.toolbar}>
      <Link
        color="inherit"
        noWrap
        variant="h2"
        href={"/"}
        className={classes.toolbarTitle}
      >
        {title}
      </Link>
      {/* {sections.map((section) => (
        <Link
          color="inherit"
          noWrap
          key={section.title}
          variant="subtitle1"
          href={section.url}
          className={classes.toolbarLink}
        >
          {section.title}
        </Link>
      ))} */}
    </Toolbar>
  );
}
