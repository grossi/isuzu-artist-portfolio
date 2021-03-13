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
      <Container maxWidth="lg">
        <Typography
            variant="h2"
            color="inherit"
            noWrap
            className={classes.toolbarTitle}
          >
            {title}
          </Typography>
        </Container>
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
