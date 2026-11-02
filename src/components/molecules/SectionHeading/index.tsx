import * as React from "react";
import { makeStyles } from "tss-react/mui";
import { displayFont } from "theme";

const useStyles = makeStyles()({
  root: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    boxSizing: "border-box",
    paddingBottom: 12,
    borderBottom: "1px solid #111",
    marginBottom: 28,
  },
  // Works and Profile sit side by side, so their headings share one height and
  // their rules line up; Books, lower down, is shorter.
  tall: { height: 84 },
  short: { height: 64 },
  title: {
    margin: 0,
    fontFamily: displayFont,
    fontStyle: "italic",
    fontWeight: 400,
    color: "#111",
  },
  large: { fontSize: 64, lineHeight: 0.9 },
  small: { fontSize: 34, lineHeight: 1 },
  label: {
    fontSize: 12,
    letterSpacing: "0.2em",
    color: "#5f5f5f",
  },
});

interface SectionHeadingProps {
  id: string;
  /** The italic display title (Works, Profile, Books). */
  title: string;
  /** The localized name beside it; hidden when it repeats the title. */
  label?: string;
  size?: "large" | "small";
  height?: "tall" | "short";
}

export default function SectionHeading({ id, title, label, size = "small", height = "tall" }: SectionHeadingProps) {
  const { classes, cx } = useStyles();
  return (
    <div className={cx(classes.root, classes[height])}>
      <h2 id={id} className={cx(classes.title, classes[size])}>
        {title}
      </h2>
      {label && label !== title && <span className={classes.label}>{label}</span>}
    </div>
  );
}
