import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Grid from "@material-ui/core/Grid";
import Container from "@material-ui/core/Container";
import Main from "./Main";
import Footer from "./Footer";
import Header from "components/Header";
import Featured from "components/Featured";
import Sidebar from "components/Sidebar";
import post1 from "assets/md/blog-post.1.md";
import post2 from "assets/md/blog-post.2.md";
import post3 from "assets/md/blog-post.3.md";
import about from "assets/md/about.md";

const useStyles = makeStyles((theme) => ({
  mainGrid: {
    marginTop: theme.spacing(3),
  },
}));

const sections = [
  { title: "Portifolio", url: "#" },
  { title: "Contact", url: "#" },
  { title: "Book", url: "#" },
];

const mainFeaturedPost = [
  {
    title: "Year of the Bull",
    image: "https://cdn.discordapp.com/attachments/722868699060502599/819976469748908053/d423d88c275a75e3.png",
  },
  {
    title: "Year of the Pig",
    image: "https://cdn.discordapp.com/attachments/722868699060502599/819984304318054440/72460479_p0.png",
  },
  {
    title: "Cooking in the Forest",
    image: "https://cdn.discordapp.com/attachments/722868699060502599/819984594174214204/51049030_p0.png",
  },
  {
    title: "Year of the Mouse",
    image: "https://cdn.discordapp.com/attachments/722868699060502599/820003138240643092/ce31602284327e82.jpg",
  }
];

const posts = [post1, post2, post3];

const sidebar = {
  title: "プロフィール",
  description: about
};

export default function Blog() {
  const classes = useStyles();

  return (
    <React.Fragment>
      <CssBaseline />
      <Header title="isuZu" sections={sections} />
      <Featured posts={mainFeaturedPost} />
      <Container maxWidth="lg">
        <main>
          <Grid container spacing={5} className={classes.mainGrid}>
            <Main title="From the firehose" posts={posts} />
            <Sidebar
              title={sidebar.title}
              description={sidebar.description}
            />
          </Grid>
        </main>
      </Container>
      <Footer
        title="Footer"
        description="Something here to give the footer a purpose!"
      />
    </React.Fragment>
  );
}
