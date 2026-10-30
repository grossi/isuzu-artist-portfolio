import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Container from "@mui/material/Container";
import Galery from 'components/organisms/WorkGallery';

const useStyles = makeStyles()((theme) => ({
  mainGrid: {
    // Same layout the v4 Grid container (spacing={2}) had
    display: "flex",
    flexWrap: "wrap",
    margin: theme.spacing(3, -1, -1),
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
  const { classes } = useStyles();

  return (
    <Container maxWidth="xl" className={classes.mainContainer}>
      <main>
        <div className={classes.mainGrid}>
          <Galery />
        </div>
      </main>
    </Container>
  );
}
