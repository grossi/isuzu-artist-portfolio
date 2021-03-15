import * as React from "react";
import WorkCard from "components/WorkCard";
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
    about: `${process.env.PUBLIC_URL}/${work.about.location}`,
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
