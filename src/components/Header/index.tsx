import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Container from "@material-ui/core/Container";
// import Link from '@material-ui/core/Link';

const useStyles = makeStyles((theme) => ({
  toolbar: {
    height: '10vh',
    borderBottom: `1px solid ${theme.palette.divider}`,
    justifyContent: 'space-between',
    overflowX: 'auto',
  },
  toolbarTitle: {
    flex: 1,
  },
  toolbarLink: {
    padding: theme.spacing(2),
    flexShrink: 0,
  },
  container: {
    [theme.breakpoints.up('lg')]: {
      paddingRight: theme.spacing(12),
      paddingLeft: theme.spacing(12)
    },
    [theme.breakpoints.up('xl')]: {
      paddingRight: theme.spacing(16),
      paddingLeft: theme.spacing(16)
    },
  }
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
  const { title } = props;

  return (
    <Toolbar component="nav" variant="dense" className={classes.toolbar}>
      <Container className={classes.container} disableGutters maxWidth="xl">
        <Typography
            variant="h2"
            color="inherit"
            noWrap
            className={classes.toolbarTitle}
          >
            {title}
          </Typography>
        </Container>
        {/* TODO: Add dedicated pages for different sections
        {sections.map((section) => (
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
