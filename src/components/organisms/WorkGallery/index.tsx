import * as React from "react";
import WorkCard from "components/molecules/WorkCard";
import workGalleryData from "work-gallery.json";

const works = workGalleryData.map((work, k) => {
  const imageList = work.workList.map(painting => {
    const src = `${import.meta.env.BASE_URL}${painting.locationSmall}`;
    const srcBig = `${import.meta.env.BASE_URL}${painting.locationLarge}`;
    return {
      src,
      srcBig,
      // Some row layouts render a thumbnail wider than the small derivative
      // covers on retina screens; let the browser fall back to the large one.
      thumbnailSrcSet: painting.widthLarge > painting.widthSmall
        ? `${src} ${painting.widthSmall}w, ${srcBig} ${painting.widthLarge}w`
        : undefined,
      width: painting.width,
      height: painting.height,
    };  
  });
  return {
    name: work.name,
    banner: {
      name: work.banner.name,
      src: `${import.meta.env.BASE_URL}${work.banner.locationSmall}`,
    },
    about: {
      ja: `${import.meta.env.BASE_URL}${work.about.ja}`,
      en: `${import.meta.env.BASE_URL}${work.about.en}`,
    },
    imageList
  };
});

export default function WorkGallery() {
  return (
    <React.Fragment>
      {works.map((work, index) => {
        return (<WorkCard work={work} key={index} />)  
      })}
    </React.Fragment>
  );
}
