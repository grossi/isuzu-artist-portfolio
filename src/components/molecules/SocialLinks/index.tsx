import * as React from "react";
import { makeStyles, darken } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import { IconType } from "react-icons";

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

export interface SocialLink {
  label: string;
  href: string;
  Icon: IconType;
}

interface SocialLinksProps {
  socialLinks: SocialLink[];
}

const isExternal = (href: string) => /^https?:\/\//.test(href);

export default function SocialLinks(props: SocialLinksProps) {
  const classes = useStyles();
  return (
    <div className={classes.linksContainer}>
      {props.socialLinks.map(({ label, href, Icon }) => {
        const external = isExternal(href);
        return (
          <Button
            key={href}
            className={classes.linkGrid}
            component={Link}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            startIcon={<Icon className={classes.icon} />}
          >
            <Typography variant="body1">{label}</Typography>
          </Button>
        );
      })}
    </div>
  );
}
