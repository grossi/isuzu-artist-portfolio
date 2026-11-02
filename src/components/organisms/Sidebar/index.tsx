import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Markdown from "components/molecules/Markdown";
import SectionHeading from "components/molecules/SectionHeading";
import SocialLinks, { SocialLink } from "components/molecules/SocialLinks";
import useMarkdown from "hooks/useMarkdown";
import { Localized, useLanguage } from "i18n/LanguageContext";
import { bodyFont, displayFont } from "theme";

// A book cover drawn as a hardcover: a crease by the spine, the page edges
// showing on the right, and a soft shadow.
const hardcover = {
  position: "relative",
  alignSelf: "start",
  filter: "drop-shadow(0 14px 12px rgba(0,0,0,.22)) drop-shadow(0 2px 2px rgba(0,0,0,.18))",
  transition: "transform .4s cubic-bezier(.2,.7,.2,1)",
  "& img": {
    display: "block",
    width: "100%",
    height: "auto",
    position: "relative",
    zIndex: 1,
    borderRadius: "1px 3px 3px 1px",
  },
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "12%",
    zIndex: 2,
    borderRadius: "1px 0 0 1px",
    background:
      "linear-gradient(to right, rgba(0,0,0,.30) 0, rgba(0,0,0,.08) 18%, rgba(255,255,255,.35) 32%, rgba(0,0,0,.14) 55%, rgba(0,0,0,0) 100%)",
  },
  "&::after": {
    content: '""',
    position: "absolute",
    top: 3,
    bottom: 3,
    right: -6,
    width: 8,
    zIndex: 0,
    borderRadius: "0 2px 2px 0",
    background: "repeating-linear-gradient(to right, #fff 0 1px, #dcdcdc 1px 2px)",
  },
} as const;

const useStyles = makeStyles()({
  me: {
    display: "flex",
    alignItems: "center",
    gap: 18,
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    objectFit: "cover",
  },
  name: {
    margin: 0,
    fontFamily: displayFont,
    fontSize: 36,
    letterSpacing: "-0.02em",
  },
  reading: {
    marginLeft: 8,
    fontFamily: bodyFont,
    fontSize: 13,
    letterSpacing: "0.3em",
    color: "#5f5f5f",
  },
  // A one-paragraph profile renders as inline text, a longer one as paragraphs
  about: {
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 1.9,
    "& p": {
      margin: "0 0 8px",
      fontSize: 14,
      lineHeight: 1.9,
    },
    "& p:last-child": {
      marginBottom: 0,
    },
  },
  book: {
    display: "grid",
    gridTemplateColumns: "40px 112px minmax(0, 1fr)",
    gap: 16,
    paddingBottom: 28,
    marginBottom: 28,
    borderBottom: "1px solid #ddd",
  },
  number: {
    fontFamily: displayFont,
    fontStyle: "italic",
    fontSize: 30,
    lineHeight: 1,
    color: "#8a8a8a",
  },
  cover: {
    ...hardcover,
    display: "block",
    width: 100,
    "&:focus-visible": { outline: "2px solid #3f51b5", outlineOffset: 3 },
    "article:hover > &": { transform: "translateY(-6px)" },
    "@media (prefers-reduced-motion: reduce)": {
      "article:hover > &": { transform: "none" },
    },
  },
  // The entry's markdown: first paragraph a short lead-in with a dash, the
  // bold title, then the shop links in a row. Only the top-level blocks
  // (markdown-to-jsx wraps them in a div) take these roles: a list written
  // with blank lines between its items puts each link in a <p> of its own.
  text: {
    minWidth: 0,
    "& p": {
      margin: "0 0 12px",
    },
    "& > div > p:first-child": {
      display: "flex",
      alignItems: "flex-start",
      gap: 8,
      margin: "0 0 8px",
      fontSize: 12,
      lineHeight: 1.6,
      letterSpacing: 0,
      color: "#6b6b6b",
      "&::before": {
        content: '""',
        flex: "0 0 14px",
        height: 1,
        marginTop: 9,
        background: "#9e9e9e",
      },
    },
    "& > div > p:not(:first-child) > strong": {
      display: "block",
      fontSize: 15,
      lineHeight: 1.55,
      fontWeight: 700,
      color: "#111",
    },
    "& ul": {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexWrap: "wrap",
      gap: "4px 14px",
    },
    "& li": {
      margin: 0,
    },
    "& li > span": {
      fontSize: 13,
      lineHeight: 1.6,
    },
    "& li p": {
      display: "inline",
      margin: 0,
      fontSize: "inherit",
    },
    "& li a::after": {
      content: '" ↗"',
    },
  },
  previous: {
    gridColumn: "2 / 4",
    display: "flex",
    alignItems: "center",
    gap: 18,
    minHeight: 76,
    marginTop: 6,
    // The small cover tucks under the big one and the text lines up with the text above
    marginLeft: 58,
    minWidth: 0,
    color: "#111",
    textDecoration: "none",
    "&:focus-visible": { outline: "2px solid #3f51b5", outlineOffset: 3 },
  },
  previousCover: {
    ...hardcover,
    display: "block",
    alignSelf: "center",
    width: 52,
    flex: "0 0 52px",
    filter: "drop-shadow(0 6px 6px rgba(0,0,0,.22)) drop-shadow(0 1px 1px rgba(0,0,0,.15))",
    "&::after": {
      ...hardcover["&::after"],
      right: -4,
      width: 5,
      top: 2,
      bottom: 2,
    },
  },
  previousText: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
  },
  previousLabel: {
    fontSize: 12,
    letterSpacing: "0.08em",
    color: "#5f5f5f",
    // Wraps when the row is narrower than the label: on phones, or with a
    // long edition label (the admin allows up to 100 characters)
    overflowWrap: "anywhere",
  },
  previousTitle: {
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 500,
    "a:hover > span > &": { textDecoration: "underline" },
  },
});

// The shape of src/sidebar.json
export interface SidebarData {
  heading: Localized<string>;
  entries: Array<{
    id: string;
    image: string;
    link: string | null;
    description: Localized<string>;
    previousEditions: Array<{ id: string; image: string; link: string; title: Localized<string>; edition: Localized<string> }>;
  }>;
}

interface Entry {
  id: string;
  image: string;
  link: string | null;
  description: string;
  previousEditions: Array<{
    id: string;
    image: string;
    link: string;
    title: string;
    edition: string;
  }>;
}

interface ProfileProps {
  className?: string;
  title: string;
  description: string;
  socialLinks: SocialLink[];
}

interface BooksProps {
  className?: string;
  entriesHeader: string;
  entries: Entry[];
}

function SidebarEntry(props: Entry & { number: number }) {
  const { classes } = useStyles();
  const { t } = useLanguage();
  // When the text beside it links to the same page, the cover link is skipped
  // by keyboard and screen readers. Otherwise (the link and the description
  // are separate fields in the admin) it is the only way there.
  const repeated = Boolean(props.link) && props.description.includes(`](${props.link})`);
  const image = <img src={props.image} alt={props.link && !repeated ? t("sidebar.coverAlt") : ""} />;
  return (
    <article className={classes.book}>
      <span className={classes.number}>{String(props.number).padStart(2, "0")}</span>
      {props.link ? (
        <a
          href={props.link}
          className={classes.cover}
          tabIndex={repeated ? -1 : undefined}
          aria-hidden={repeated || undefined}
        >
          {image}
        </a>
      ) : (
        <div className={classes.cover}>{image}</div>
      )}
      <div className={classes.text}>
        {props.description.trim() && <Markdown>{props.description}</Markdown>}
      </div>
      {props.previousEditions.map((edition) => (
        <a key={edition.id} href={edition.link} className={classes.previous}>
          <span className={classes.previousCover}>
            <img src={edition.image} alt="" width={52} loading="lazy" />
          </span>
          <span className={classes.previousText}>
            <span className={classes.previousLabel}>{t("sidebar.previousEdition", { edition: edition.edition })}</span>
            <span className={classes.previousTitle}>{edition.title} ↗</span>
          </span>
        </a>
      ))}
    </article>
  );
}

// The home page's right-hand column: the profile, and under it the books
// (著書 / My Books). The page places them (see pages/Home).
export function Profile({ className, title, description, socialLinks }: ProfileProps) {
  const { classes } = useStyles();
  const { t } = useLanguage();
  const loadedAbout = useMarkdown(description);

  return (
    <section className={className} aria-labelledby="home-profile home-profile-label">
      <SectionHeading id="home-profile" title="Profile" label={title} />
      <div className={classes.me}>
        <img className={classes.avatar} alt={t("sidebar.avatarAlt")} src={`${import.meta.env.BASE_URL}isuzu.jpg`} />
        <p className={classes.name}>
          isuZu<span className={classes.reading}>うずし</span>
        </p>
      </div>
      <div className={classes.about}>
        <Markdown>{loadedAbout}</Markdown>
      </div>
      <SocialLinks socialLinks={socialLinks} />
    </section>
  );
}

export function Books({ className, entriesHeader, entries }: BooksProps) {
  if (entries.length === 0) return null;
  return (
    <section className={className} aria-labelledby="home-books home-books-label">
      <SectionHeading id="home-books" title="Books" label={entriesHeader} height="short" />
      {entries.map((entry, index) => (
        <SidebarEntry key={entry.id} number={index + 1} {...entry} />
      ))}
    </section>
  );
}
