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
    objectPosition: "center",
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

// The showcase top (see hero.ts). The slides are as tall as the classic
// ones; how the pictures fill them is movingPicture.fit:
// "cover"  as the classic slides: the full width, cut at the top and bottom
// "inset"  a little smaller: movingPicture.inset times the slide's height, so
//          less is cut, with black at the sides and the pictures' sides faded
//          into it
const SHOWCASE_BLACK = "#141414";
const FEATHER = "min(56px, 4%)";
const feather = `linear-gradient(to right, transparent, #000 ${FEATHER}, #000 calc(100% - ${FEATHER}), transparent)`;
// Never larger than "cover" would make it: on a narrow window (a phone),
// where "cover" already cuts the sides, the two are the same.
const insetHeight = `min(calc(var(--hh) * ${movingPicture.inset}), max(var(--hh), calc(100vw / ${movingPicture.aspect})))`;

// For comparing the two while they're reviewed: ?fit=cover or ?fit=inset.
const fitParam = new URLSearchParams(window.location.search).get("fit");
const fit: "cover" | "inset" = fitParam === "cover" || fitParam === "inset" ? fitParam : movingPicture.fit;

const useShowcaseStyles = makeStyles()({
  coverSlide: {
    height: "var(--hh)",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#222",
  },
  coverPicture: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  },
  // At least the slide's width and height, centred: cut like the pictures.
  coverMoving: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: `max(100%, calc(var(--hh) * ${movingPicture.aspect}))`,
    aspectRatio: String(movingPicture.aspect),
  },
  insetSlide: {
    height: "var(--hh)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: SHOWCASE_BLACK,
  },
  // Taller than the slide by the same share for every picture; one wider
  // than the slide loses a little at both sides too.
  insetPicture: {
    display: "block",
    flex: "none",
    height: insetHeight,
    width: "auto",
    maxWidth: "none",
    maskImage: feather,
    WebkitMaskImage: feather,
  },
  insetMoving: {
    flex: "none",
    height: insetHeight,
    aspectRatio: String(movingPicture.aspect),
    maskImage: feather,
    WebkitMaskImage: feather,
  },
  insetHero: {
    backgroundColor: SHOWCASE_BLACK,
  },
});

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
// the one it stands in for), each whole on black. Slides load as in the
// classic carousel; the moving one shows for movingPicture.seconds, the
// others for 3 s, as the classic autoplay did.
type ShowcaseSlide = { moving: true } | { moving: false; src: string };
const showcaseSlides: ShowcaseSlide[] = [
  { moving: true },
  ...paintings.filter((painting) => painting.location !== movingPicture.replaces).map((painting) => ({ moving: false as const, src: painting.src })),
];
const SLIDE_MS = 3000;

function Showcase() {
  const { classes, cx } = useStyles();
  const { classes: own } = useShowcaseStyles();
  const { t } = useLanguage();
  const sliderRef = React.useRef<Slider>(null);
  const [current, setCurrent] = React.useState(0);
  const [loadedSlides, setLoadedSlides] = React.useState(() => new Set([0, 1]));
  const loadSlides = React.useCallback((...indexes: number[]) => {
    setLoadedSlides((slides) => (indexes.every((index) => slides.has(index)) ? slides : new Set([...Array.from(slides), ...indexes])));
  }, []);
  const nextIndex = (index: number) => (index + 1) % showcaseSlides.length;
  const loadAllSlides = () => loadSlides(...showcaseSlides.map((_, index) => index));
  const [reducedMotion] = React.useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);

  // The autoplay, by hand: each slide has its own time. Visitors who ask for
  // less motion get none (the dots still change the slides).
  React.useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => sliderRef.current?.slickNext(), showcaseSlides[current].moving ? movingPicture.seconds * 1000 : SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [current, reducedMotion]);

  const settings = {
    dots: true,
    arrows: false,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    beforeChange: (_: number, next: number) => loadSlides(next, nextIndex(next)),
    afterChange: (index: number) => setCurrent(index),
  };

  return (
    <section className={classes.wrap} aria-label={t("hero.label")}>
      <div className={classes.water} aria-hidden="true">
        <svg viewBox="0 0 4320 160" fill="none" strokeLinecap="round">
          <path className={classes.wave} d={WAVE_PATH} stroke="#d2d2d2" strokeWidth={1.2} />
        </svg>
      </div>
      <div
        className={cx(classes.hero, fit === "inset" && own.insetHero)}
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
              <div className={fit === "cover" ? own.coverSlide : own.insetSlide}>
                {slide.moving ? (
                  <MovingPicture
                    className={fit === "cover" ? own.coverMoving : own.insetMoving}
                    scene={`${import.meta.env.BASE_URL}${movingPicture.scene}`}
                    active={current === index}
                  />
                ) : (
                  loadedSlides.has(index) && <img className={fit === "cover" ? own.coverPicture : own.insetPicture} src={slide.src} alt="" />
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
