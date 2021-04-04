import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { FaTwitter } from "react-icons/fa";
import { SiPixiv } from "react-icons/si";
import { MdEmail } from "react-icons/md";

const useStyles = makeStyles((theme) => ({
  linkGrid: {
    marginBottom: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  icon: {
    height: theme.spacing(2.5),
    width: theme.spacing(2.5),
    verticalAlign: "middle",
  },
}));

interface SocialLinksProps {
  socialLinks: {
    twitter: string;
    pixiv: string;
    email: string;
  };
}

export default function SocialLinks(props: SocialLinksProps) {
  const classes = useStyles();
  return (
    <>
      <Grid
        container
        direction="row"
        alignItems="center"
        spacing={2}
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.twitter}
        target="_blank"
        rel="noopener"
      >
        <Grid item>
          <FaTwitter className={classes.icon} />
        </Grid>
        <Grid item>
          <Typography variant="body1">twitter</Typography>
        </Grid>
      </Grid>
      <Grid
        container
        direction="row"
        alignItems="center"
        spacing={2}
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.pixiv}
        target="_blank"
        rel="noopener"
      >
        <Grid item>
          <SiPixiv className={classes.icon} />
        </Grid>
        <Grid item>
          <Typography variant="body1">pixiv</Typography>
        </Grid>
      </Grid>
      <Grid
        container
        direction="row"
        alignItems="center"
        spacing={2}
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.email}
        target="_blank"
        rel="noopener"
      >
        <Grid item>
          <MdEmail className={classes.icon} />
        </Grid>
        <Grid item>
          <Typography variant="body1">email</Typography>
        </Grid>
      </Grid>
    </>
  );
}
