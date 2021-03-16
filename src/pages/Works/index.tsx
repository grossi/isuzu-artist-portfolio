import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Galery from 'components/WorkGallery';

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    marginTop: theme.spacing(3),
  },
  mainContainer: {
    minHeight: "100%",
    marginTop: theme.spacing(3),
    [theme.breakpoints.up('xs')]: {
      paddingRight: theme.spacing(2),
      paddingLeft: theme.spacing(2)
    },
    [theme.breakpoints.up('sm')]: {
      paddingRight: theme.spacing(3),
      paddingLeft: theme.spacing(3)
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

export default function Works() {
  const classes = useStyles();

  return (
    <Container maxWidth="xl" className={classes.mainContainer}>
      <main>
        <Grid container spacing={2} className={classes.mainGrid}>
          <Galery />
        </Grid>
      </main>
    </Container>
  );
}
