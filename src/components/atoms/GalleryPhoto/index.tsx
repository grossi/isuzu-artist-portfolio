import * as React from "react";
import { RenderImageProps } from "react-photo-gallery";
import { useLanguage } from "i18n/LanguageContext";

export interface GalleryPhotoSource {
  src: string;
  srcBig: string;
  width: number;
  height: number;
}

export interface GalleryPhotoData extends GalleryPhotoSource {
  alt: string;
}

/** Adds translated, numbered alt text to a gallery's photos. */
export function usePhotoAlts(photos: GalleryPhotoSource[]): GalleryPhotoData[] {
  const { t } = useLanguage();
  return React.useMemo(
    () =>
      photos.map((photo, index) => ({
        ...photo,
        alt: t("gallery.photoAlt", { n: index + 1 }),
      })),
    [photos, t]
  );
}

/**
 * Lazy-loading replacement for react-photo-gallery's default image. Only the
 * props an <img> understands are passed on, and photos that open the viewer can
 * also be activated from the keyboard. Supports the default row layout only
 * (column layout would need the absolute top/left positioning).
 *
 * The gallery calls this as a plain function rather than rendering it as a
 * component, so it must not use hooks and has to set the key itself.
 *
 * `deferred` leaves out the src, so the photo takes up its place in the layout
 * without being downloaded.
 */
export default function GalleryPhoto({
  index,
  onClick,
  photo,
  margin,
  deferred = false,
}: RenderImageProps & { deferred?: boolean }) {
  const clickable = onClick !== null;

  return (
    <img
      key={photo.key || photo.src}
      src={deferred ? undefined : photo.src}
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
