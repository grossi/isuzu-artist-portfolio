import * as React from "react";
import { makeStyles, darken } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { FaTwitter } from "react-icons/fa";
import { SiPixiv } from "react-icons/si";
import { MdEmail } from "react-icons/md";

const useStyles = makeStyles((theme) => ({
  linkGrid: {
    justifyContent: 'flex-start',
    color: theme.palette.text.primary,
    paddingLeft: theme.spacing(2),
    textTransform: 'none',
    transition: 'background-color 0.3s ease',
    '&:hover': {
      backgroundColor: darken(theme.palette.grey[200], 0.2),
    },
  },
  icon: {
    height: theme.spacing(2.5),
    width: theme.spacing(2.5),
  },
  linksContainer: {
    display: 'flex',
    flexDirection: 'column',
  }
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
    <div className={classes.linksContainer}>
      <Button
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.twitter}
        target="_blank"
        rel="noopener"
        startIcon={<FaTwitter className={classes.icon} />}
      >
        <Typography variant="body1">twitter</Typography>
      </Button>
      <Button
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.pixiv}
        target="_blank"
        rel="noopener"
        startIcon={<SiPixiv className={classes.icon} />}
      >
        <Typography variant="body1">pixiv</Typography>
      </Button>
      <Button
        className={classes.linkGrid}
        component={Link}
        href={props.socialLinks.email}
        target="_blank"
        rel="noopener"
        startIcon={<MdEmail className={classes.icon} />}
      >
        <Typography variant="body1">email</Typography>
      </Button>
    </div>
  );
}
