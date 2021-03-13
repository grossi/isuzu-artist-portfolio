import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Slider from "react-slick";

const useStyles = makeStyles((theme) => ({
  mainFeaturedPost: {
    height: "80vh",
    position: "relative",
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  },
}));

interface FeaturedPosts {
  posts: {
    description?: string;
    image: string;
    imageText?: string;
    linkText?: string;
    title: string;
  }[];
}

export default function Featured(props: FeaturedPosts) {
  const classes = useStyles();
  const { posts } = props;
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
  };

  return (
    <Slider {...settings}>
      {posts.map((post, index) => (
        <div key={index}>
          <div className={classes.mainFeaturedPost} style={{ backgroundImage: `url(${post.image})`}} />
          {/* Increase the priority of the hero background image */}
          {
            <img
              style={{ display: "none" }}
              src={post.image}
              alt={post.title}
            />
          }
        </div>
      ))}
    </Slider>
  );
}
