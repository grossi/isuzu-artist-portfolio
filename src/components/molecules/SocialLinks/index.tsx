import * as React from "react";
import { darken } from "@mui/material/styles";
import { makeStyles } from "tss-react/mui";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import { IconType } from "react-icons";

const useStyles = makeStyles()((theme) => ({
  linkGrid: {
    justifyContent: 'flex-start',
    color: theme.palette.text.primary,
    paddingLeft: theme.spacing(2),
    textTransform: 'none',
    // MUI v7 sizes the button's zero-width ::before by this line height,
    // which made each link 0.5px taller than in v4
    lineHeight: 'normal',
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
  const { classes } = useStyles();
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
            startIcon={<Icon className={classes.icon} aria-hidden />}
          >
            <Typography variant="body1">{label}</Typography>
          </Button>
        );
      })}
    </div>
  );
}
