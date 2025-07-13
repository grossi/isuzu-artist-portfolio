import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Markdown from "components/molecules/Markdown";
import Link from "@material-ui/core/Link";
import CardMedia from "@material-ui/core/CardMedia";
import Avatar from "@material-ui/core/Avatar";
import SocialLinks from "components/molecules/SocialLinks";

const useStyles = makeStyles((theme) => ({
  sidebarAboutBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[200],
    marginBottom: theme.spacing(3),
  },
  sidebarSection: {
    marginTop: theme.spacing(3),
  },
  avatarGrid: {
    marginBottom: theme.spacing(2),
  },
  avatar: {
    width: theme.spacing(7),
    height: theme.spacing(7),
  },
  sidebarGrid: {
    order: 2,
    [theme.breakpoints.down("sm")]: {
      order: 1,
    },
  },
}));

interface SidebarProps {
  title: string;
  description: string;
  firstBookHeader: string;
  firstBookDescription: string;
  secondBookHeader: string;
  secondBookDescription: string;
  thirdBookHeader: string;
  thirdBookDescription: string;
  bookLink: string;
  book2Link: string;
  book3Link: string;
  socialLinks: {
    twitter: string;
    pixiv: string;
    email: string;
  }
}

export default function Sidebar(props: SidebarProps) {
  const classes = useStyles();
  const {
    title,
    description,
    firstBookHeader,
    firstBookDescription,
    secondBookHeader,
    secondBookDescription,
    thirdBookHeader,
    thirdBookDescription,
    bookLink,
    book2Link,
    book3Link,
  } = props;
  const [loadedAbout, setLoadedAbout] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedAbout("");
    fetch(description)
      .then((data) => data.text())
      .then((text) => {
        setLoadedAbout(text);
      });
  }, [description]);
  const [
    loadedFirstBookDescription,
    setLoadedFirstBookDescription,
  ] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedFirstBookDescription("");
    fetch(firstBookDescription)
      .then((data) => data.text())
      .then((text) => {
        setLoadedFirstBookDescription(text);
      });
  }, [firstBookDescription]);
  const [
    loadedSecondBookDescription,
    setLoadedSecondBookDescription,
  ] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedSecondBookDescription("");
    fetch(secondBookDescription)
      .then((data) => data.text())
      .then((text) => {
        setLoadedSecondBookDescription(text);
      });
  }, [secondBookDescription]);
  const [
    loadedThirdBookDescription,
    setLoadedThirdBookDescription,
  ] = React.useState<string>("");
  React.useEffect(() => {
    setLoadedThirdBookDescription("");
    fetch(thirdBookDescription)
      .then((data) => data.text())
      .then((text) => {
        setLoadedThirdBookDescription(text);
      });
  }, [thirdBookDescription]);

  return (
    <Grid item xs={12} md={4} className={classes.sidebarGrid}>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Grid container direction="row" alignItems="center" spacing={2} className={classes.avatarGrid}>
          <Grid item>
            <Avatar className={classes.avatar} alt="isuZu" src={`${process.env.PUBLIC_URL}/isuzu.jpg`} />
          </Grid>
          <Grid item>
            <Typography variant="h4">isuZu</Typography>
          </Grid>
        </Grid>
        <Markdown>{loadedAbout}</Markdown>
        <SocialLinks socialLinks={props.socialLinks} />
      </Paper>
      <Paper elevation={0} className={classes.sidebarAboutBox}>
        <Typography variant="h4" gutterBottom>
          {firstBookHeader}
        </Typography>
        <Link href={bookLink}>
          <CardMedia
            component="img"
            src={`${process.env.PUBLIC_URL}/isuzubook.webp`}
          />
        </Link>
        <Markdown>{loadedFirstBookDescription}</Markdown>
        <Typography variant="h4" gutterBottom>
          {secondBookHeader}
        </Typography>
        <Link href={book2Link}>
          <CardMedia
            component="img"
            src={`${process.env.PUBLIC_URL}/isuzubook2.webp`}
          />
        </Link>
        <Markdown>{loadedSecondBookDescription}</Markdown>
        <Typography variant="h4" gutterBottom>
          {thirdBookHeader}
        </Typography>
        <Link href={book3Link}>
          <CardMedia
            component="img"
            src={`${process.env.PUBLIC_URL}/isuzubook3.webp`}
          />
        </Link>
        <Markdown>{loadedThirdBookDescription}</Markdown>
      </Paper>
    </Grid>
  );
}
