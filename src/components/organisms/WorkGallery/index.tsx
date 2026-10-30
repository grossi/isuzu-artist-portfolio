import * as React from "react";
import WorkCard from "components/molecules/WorkCard";
import workGalleryData from "work-gallery.json";

const works = workGalleryData.map((work, k) => {
  let imageList = work.workList.map(painting => {
    return {
      src: `${process.env.PUBLIC_URL}/${painting.location}`,
      width: painting.width,
      height: painting.height,
      name: painting.name,
    };  
  });
  return {
    name: work.name,
    banner: {
      name: work.banner.name,
      src: `${process.env.PUBLIC_URL}/${work.banner.location}`,
    },
    about: {
      ja: `${process.env.PUBLIC_URL}/${work.about.ja}`,
      en: `${process.env.PUBLIC_URL}/${work.about.en}`,
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
