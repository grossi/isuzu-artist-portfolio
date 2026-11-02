import * as React from "react";
import { makeStyles } from "tss-react/mui";
import { IconType } from "react-icons";

const useStyles = makeStyles()({
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  // A row per account: the icon pops and the row slides right on hover
  link: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minHeight: 44,
    padding: "0 20px",
    color: "#111",
    fontSize: 14,
    textDecoration: "none",
    transition: "background-color .3s, padding-left .35s cubic-bezier(.2,.7,.2,1)",
    "&:hover": {
      backgroundColor: "#eeeeee",
      paddingLeft: 28,
    },
    "&:hover svg": {
      transform: "scale(1.22) rotate(-8deg)",
    },
    "&:focus-visible": {
      outline: "2px solid #3f51b5",
      outlineOffset: -2,
    },
    "@media (prefers-reduced-motion: reduce)": {
      transition: "background-color .3s",
      "&:hover": { paddingLeft: 20 },
      "&:hover svg": { transform: "none" },
    },
  },
  icon: {
    width: 18,
    height: 18,
    flex: "0 0 18px",
    transition: "transform .45s cubic-bezier(.34,1.56,.64,1)",
  },
});

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
    <ul className={classes.list}>
      {props.socialLinks.map(({ label, href, Icon }) => {
        const external = isExternal(href);
        return (
          <li key={href}>
            <a
              className={classes.link}
              href={href}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
            >
              <Icon className={classes.icon} aria-hidden />
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
