import * as React from "react";
import { RenderImageProps } from "react-photo-gallery";

export interface GalleryPhotoData {
  src: string;
  srcBig: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Lazy-loading replacement for react-photo-gallery's default image. Only the
 * props an <img> understands are passed on, and photos that open the viewer can
 * also be activated from the keyboard.
 *
 * The gallery calls this as a plain function rather than rendering it as a
 * component, so it must not use hooks and has to set the key itself.
 */
export default function GalleryPhoto({
  index,
  onClick,
  photo,
  margin,
}: RenderImageProps) {
  const clickable = onClick !== null;

  return (
    <img
      key={photo.key || photo.src}
      src={photo.src}
      width={photo.width}
      height={photo.height}
      alt={photo.alt}
      loading="lazy"
      decoding="async"
      style={{ margin, display: "block", cursor: clickable ? "pointer" : undefined }}
      onClick={clickable ? (event) => onClick!(event, { index }) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }
          : undefined
      }
    />
  );
}
