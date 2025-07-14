import * as React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Slider from "react-slick";
import carouselData from 'carousel.json';

const paintings = carouselData.map(image => {
  return { 
    src: `${process.env.PUBLIC_URL}/${image.location}`,
    name: image.name,
  };
});

const useStyles = makeStyles((theme) => ({
  mainFeaturedPost: {
    height: "80vh",
    position: "relative",
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center",
  },
}));

interface FeaturedProps {
  backgroundSize?: "cover" | "contain" | "auto" | string;
}

export default function Featured({ backgroundSize = "cover" }: FeaturedProps) {
  const classes = useStyles();
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    pauseOnHover: false,
  };

  return (
    <Slider {...settings}>
      {paintings.map((painting, index) => (
        <div key={index}>
          <div className={classes.mainFeaturedPost} style={{ backgroundImage: `url(${painting.src})`, backgroundSize }} />
          {/* Increase the priority of the hero background image */}
          {
            <img
              style={{ display: "none" }}
              src={painting.src}
              alt={painting.name}
            />
          }
        </div>
      ))}
    </Slider>
  );
}
