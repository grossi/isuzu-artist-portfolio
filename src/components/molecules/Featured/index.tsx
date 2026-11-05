import * as React from "react";
import { makeStyles } from "tss-react/mui";
import { keyframes } from "tss-react";
import Slider from "react-slick";
import carouselData from 'carousel.json';
import LanguageSwitch from "components/molecules/LanguageSwitch";
import { useLanguage } from "i18n/LanguageContext";
import { displayFont } from "theme";
import { heroStyle, movingPicture } from "hero";
import MovingPicture from "components/molecules/MovingPicture";

const paintings = carouselData.map(image => {
  return {
    src: `${import.meta.env.BASE_URL}${image.locationLarge}`,
    location: image.locationLarge,
    // Which part of the picture stays when the slide cuts its top and bottom
    // (wide screens): from 0 (keep the top) to 100 (keep the bottom). Chosen
    // per slide in the admin; see carouselFocus in src/utils/imageOrder.js.
    focusY: image.focusY,
  };
});

// One faint wave (period 360px) that drifts one 1440px stretch and loops seamlessly.
const WAVE_PATH = "M-180,70 q90,-10 180,0" + " t180,0".repeat(26);

const flow = keyframes({
  from: { transform: "translateX(0)" },
  to: { transform: "translateX(-1440px)" },
});

// Side offset shared by the wordmark, the slide dots and the language switch
const SIDE = "max(5vw, 16px)";

const useStyles = makeStyles()({
  wrap: {
    // --hh: slide height. --wm: wordmark size. The wordmark's top part is drawn
    // white inside the slide and its bottom part ink-black below it, both from
    // the same position, so it reads as one word across the slide's edge.
    "--hh": "clamp(520px, 54vw, 780px)",
    "--wm": "clamp(100px, 19vw, 280px)",
    position: "relative",
  },
  hero: {
    position: "relative",
    height: "var(--hh)",
    overflow: "hidden",
    backgroundColor: "#222",
    // Slide dots sit on the art, bottom right
    "& .slick-dots": {
      left: "auto",
      right: `calc(${SIDE} - 10px)`,
      bottom: 14,
      width: "auto",
      margin: 0,
      // The row grows 28px per slide (the admin sets how many): it stops
      // short of the wordmark (about 2.6em wide with its margin) and wraps,
      // growing upward from the bottom edge, instead of running into it.
      // (react-slick sets display: block on it inline, so the dots are
      // inline-blocks lined up to the right.)
      maxWidth: `calc(100% - var(--wm) * 2.6 - 2 * ${SIDE})`,
      textAlign: "right",
      // On phones the wordmark reaches under the dots: they sit above it
      "@media (max-width: 599.95px)": {
        bottom: "calc(var(--wm) * 0.6 + 4px)",
        maxWidth: `calc(100% - 2 * ${SIDE})`,
      },
    },
    "& .slick-dots li": {
      width: 28,
      height: 44,
      margin: 0,
    },
    "& .slick-dots li button": {
      width: 28,
      height: 44,
      padding: 0,
    },
    "& .slick-dots li button::before, & .slick-dots li.slick-active button::before": {
      content: '""',
      top: "50%",
      left: "50%",
      width: 8,
      height: 8,
      margin: "-4px 0 0 -4px",
      borderRadius: "50%",
      backgroundColor: "rgba(255, 255, 255, 0.5)",
      boxShadow: "0 0 4px rgba(0, 0, 0, 0.25)",
    },
    "& .slick-dots li:hover button::before": {
      backgroundColor: "rgba(255, 255, 255, 0.85)",
    },
    "& .slick-dots li.slick-active button::before": {
      backgroundColor: "#fff",
    },
    "& .slick-dots li button:focus-visible": {
      outline: "2px solid #fff",
      outlineOffset: -6,
    },
  },
  slide: {
    height: "var(--hh)",
    position: "relative",
    backgroundColor: "#222",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    // The vertical position is each slide's focusY (set inline).
    objectPosition: "50% 50%",
  },
  // Keeps the white wordmark readable on light art
  shade: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    pointerEvents: "none",
    background:
      "linear-gradient(to bottom, rgba(0,0,0,.28), rgba(0,0,0,0) 16%, rgba(0,0,0,0) 68%, rgba(0,0,0,.36))",
  },
  wordmark: {
    position: "absolute",
    left: SIDE,
    margin: 0,
    fontFamily: displayFont,
    fontWeight: 500,
    fontSize: "var(--wm)",
    lineHeight: 1,
    letterSpacing: "-0.035em",
    whiteSpace: "nowrap",
    pointerEvents: "none",
  },
  wordmarkIn: {
    top: "calc(100% - 0.6em)",
    zIndex: 2,
    color: "#fff",
  },
  below: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "var(--hh)",
    height: "calc(var(--wm) * 0.5)",
    overflow: "hidden",
    pointerEvents: "none",
  },
  wordmarkOut: {
    top: "-0.6em",
    color: "#111",
  },
  tail: {
    position: "relative",
    zIndex: 1,
    height: "calc(var(--wm) * 0.42)",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    padding: `10px calc(${SIDE} - 10px) 0`,
  },
  // A faint flowing-water line drifting just under the wordmark
  water: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "var(--hh)",
    height: 160,
    overflow: "hidden",
    pointerEvents: "none",
    "& svg": {
      position: "absolute",
      left: 0,
      top: 0,
      width: 4320,
      height: 160,
      maxWidth: "none",
    },
  },
  wave: {
    animation: `${flow} 48s linear infinite`,
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
    },
  },
});

// The showcase top (see hero.ts): the classic slides, with the moving
// picture first. Pictures fill the slide's width and are cut at the top and
// bottom; focusY (0: keep the top, 100: keep the bottom) says where.
const useShowcaseStyles = makeStyles()({
  slide: {
    height: "var(--hh)",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#222",
  },
  picture: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  // At least the slide's width and height, cut like the pictures.
  moving: {
    position: "absolute",
    left: "50%",
    width: `max(100%, calc(var(--hh) * ${movingPicture.aspect}))`,
    aspectRatio: String(movingPicture.aspect),
  },
});

// The point focusY% down a picture sits focusY% down the slide (what
// object-position does for an <img>).
const movingPlace = (focusY: number): React.CSSProperties => ({ top: `${focusY}%`, transform: `translate(-50%, -${focusY}%)` });

export default function Featured() {
  return heroStyle === "showcase" ? <Showcase /> : <ClassicCarousel />;
}

// The slides as they were before the showcase, unchanged.
function ClassicCarousel() {
  const { classes, cx } = useStyles();
  const { t } = useLanguage();
  // Slides whose image may be fetched. Only the first slide loads up front; the
  // next one is fetched once it has loaded, and from then on each slide change
  // fetches the slide after the one coming into view. Once the visitor reaches
  // for the controls (hovering the dots, dragging, touching, focusing) the rest
  // are fetched too, so navigating doesn't land on a slide that hasn't started
  // loading.
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

  // Visitors who ask for less motion get the slides without the autoplay
  // (the dots still change them).
  const [reducedMotion] = React.useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: !reducedMotion,
    pauseOnHover: false,
    beforeChange: (current: number, next: number) =>
      loadSlides(next, nextIndex(next)),
  };

  return (
    <section className={classes.wrap} aria-label={t("hero.label")}>
      <div className={classes.water} aria-hidden="true">
        <svg viewBox="0 0 4320 160" fill="none" strokeLinecap="round">
          <path className={classes.wave} d={WAVE_PATH} stroke="#d2d2d2" strokeWidth={1.2} />
        </svg>
      </div>
      <div
        className={classes.hero}
        onMouseOver={(event) => {
          if ((event.target as Element).closest(".slick-dots")) {
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
              <div className={classes.slide}>
                {loadedSlides.has(index) && (
                  <img
                    className={classes.image}
                    style={{ objectPosition: `50% ${painting.focusY}%` }}
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
        <div className={classes.shade} />
        <h1 className={cx(classes.wordmark, classes.wordmarkIn)}>isuZu</h1>
      </div>
      <div className={classes.below} aria-hidden="true">
        <p className={cx(classes.wordmark, classes.wordmarkOut)}>isuZu</p>
      </div>
      <div className={classes.tail}>
        <LanguageSwitch />
      </div>
    </section>
  );
}

// The showcase: the moving picture first, then the carousel's pictures (but
// the one it stands in for), each cut at its own focusY. The moving picture
// shows only while the picture it stands in for is one of the carousel's
// slides (chosen in the admin), and is cut where that slide is. Slides load
// as in the classic carousel; the moving one shows for movingPicture.seconds,
// the others for 3 s, as the classic autoplay did.
type ShowcaseSlide = { moving: boolean; src: string; focusY: number };
const replaced = paintings.find((painting) => painting.location === movingPicture.replaces);
const showcaseSlides: ShowcaseSlide[] = [
  ...(replaced ? [{ moving: true, src: replaced.src, focusY: replaced.focusY ?? movingPicture.focusY }] : []),
  ...paintings.filter((painting) => painting !== replaced).map((painting) => ({ moving: false, src: painting.src, focusY: painting.focusY })),
];
// react-slick's autoplay changed slides every 3 s (and 50 ms), counted from
// the start of each change.
const SLIDE_MS = 3050;
const showsFor = (index: number) => (showcaseSlides[index].moving ? movingPicture.seconds * 1000 : SLIDE_MS);

function Showcase() {
  const { classes, cx } = useStyles();
  const { classes: own } = useShowcaseStyles();
  const { t } = useLanguage();
  const sliderRef = React.useRef<Slider>(null);
  const [current, setCurrent] = React.useState(0);
  const [loadedSlides, setLoadedSlides] = React.useState(() => new Set([0]));
  const loadSlides = React.useCallback((...indexes: number[]) => {
    setLoadedSlides((slides) => (indexes.every((index) => slides.has(index)) ? slides : new Set([...Array.from(slides), ...indexes])));
  }, []);
  const nextIndex = (index: number) => (index + 1) % showcaseSlides.length;
  const loadAllSlides = () => loadSlides(...showcaseSlides.map((_, index) => index));
  const [reducedMotion] = React.useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  // Whether the moving picture's still has loaded: its time starts then, so
  // a slow connection doesn't spend it on an empty slide.
  const [stillShown, setStillShown] = React.useState(false);

  // The autoplay, by hand: each slide has its own time, counted from the
  // start of the change that brought it. Visitors who ask for less motion get
  // none (the dots still change the slides). If the carousel ignores a
  // change (it is still sliding, say after a dot was clicked), it's tried
  // again a moment later.
  // (Only the moving slide waits for its still: a still arriving while
  // another slide shows doesn't restart that slide's time.)
  const waiting = Boolean(showcaseSlides[current]?.moving && !stillShown);
  React.useEffect(() => {
    // (Nothing to change with fewer than two slides: the admin allows none.)
    if (reducedMotion || showcaseSlides.length < 2 || waiting) return;
    let timer = 0;
    const next = () => {
      sliderRef.current?.slickNext();
      timer = window.setTimeout(next, 1000);
    };
    timer = window.setTimeout(next, showsFor(current));
    return () => window.clearTimeout(timer);
  }, [current, reducedMotion, waiting]);

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    beforeChange: (_: number, next: number) => {
      loadSlides(next, nextIndex(next));
      setCurrent(next);
    },
  };

  return (
    <section className={classes.wrap} aria-label={t("hero.label")}>
      <div className={classes.water} aria-hidden="true">
        <svg viewBox="0 0 4320 160" fill="none" strokeLinecap="round">
          <path className={classes.wave} d={WAVE_PATH} stroke="#d2d2d2" strokeWidth={1.2} />
        </svg>
      </div>
      <div
        className={classes.hero}
        onMouseOver={(event) => {
          if ((event.target as Element).closest(".slick-dots")) {
            loadAllSlides();
          }
        }}
        onMouseDown={loadAllSlides}
        onTouchStart={loadAllSlides}
        onFocus={loadAllSlides}
      >
        <Slider ref={sliderRef} {...settings}>
          {showcaseSlides.map((slide, index) => (
            <div key={index}>
              <div className={own.slide}>
                {slide.moving ? (
                  <MovingPicture
                    className={own.moving}
                    style={movingPlace(slide.focusY)}
                    scene={`${import.meta.env.BASE_URL}${movingPicture.scene}`}
                    fallback={slide.src}
                    active={current === index}
                    onStillLoad={() => {
                      setStillShown(true);
                      loadSlides(nextIndex(index));
                    }}
                  />
                ) : (
                  loadedSlides.has(index) && (
                    <img
                      className={own.picture}
                      style={{ objectPosition: `50% ${slide.focusY}%` }}
                      src={slide.src}
                      alt=""
                      fetchPriority={index === 0 ? "high" : undefined}
                      onLoad={index === 0 ? () => loadSlides(nextIndex(0)) : undefined}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </Slider>
        <div className={classes.shade} />
        <h1 className={cx(classes.wordmark, classes.wordmarkIn)}>isuZu</h1>
      </div>
      <div className={classes.below} aria-hidden="true">
        <p className={cx(classes.wordmark, classes.wordmarkOut)}>isuZu</p>
      </div>
      <div className={classes.tail}>
        <LanguageSwitch />
      </div>
    </section>
  );
}
