import * as React from "react";
import { makeStyles } from "tss-react/mui";
import Slider from "react-slick";
import carouselData from 'carousel.json';

const paintings = carouselData.map(image => {
  return {
    src: `${import.meta.env.BASE_URL}${image.locationLarge}`,
  };
});

const useStyles = makeStyles()((theme) => ({
  mainFeaturedPost: {
    height: "80vh",
    position: "relative",
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  },
}));

export default function Featured() {
  const { classes } = useStyles();
  // Slides whose image may be fetched. Only the first slide loads up front; the
  // next one is fetched once it has loaded, and from then on each slide change
  // fetches the slide after the one coming into view. Once the visitor reaches
  // for the controls (hovering the arrows or dots, dragging, touching, focusing)
  // the rest are fetched too, so navigating doesn't land on a slide that hasn't
  // started loading.
  const [loadedSlides, setLoadedSlides] = React.useState(() => new Set([0]));
  const loadSlides = React.useCallback((...indexes: number[]) => {
    setLoadedSlides((slides) =>
      indexes.every((index) => slides.has(index))
        ? slides
        : new Set([...Array.from(slides), ...indexes])
    );
  }, []);
  const nextIndex = (index: number) => (index + 1) % paintings.length;
  const loadAllSlides = () => loadSlides(...paintings.map((_, index) => index));

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    pauseOnHover: false,
    beforeChange: (current: number, next: number) =>
      loadSlides(next, nextIndex(next)),
  };

  return (
    <div
      onMouseOver={(event) => {
        if ((event.target as Element).closest(".slick-arrow, .slick-dots")) {
          loadAllSlides();
        }
      }}
      onMouseDown={loadAllSlides}
      onTouchStart={loadAllSlides}
      onFocus={loadAllSlides}
    >
      <Slider {...settings}>
        {paintings.map((painting, index) => (
          <div key={index}>
            <div className={classes.mainFeaturedPost}>
              {loadedSlides.has(index) && (
                <img
                  className={classes.image}
                  src={painting.src}
                  alt=""
                  fetchPriority={index === 0 ? "high" : undefined}
                  onLoad={index === 0 ? () => loadSlides(nextIndex(0)) : undefined}
                />
              )}
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
}
