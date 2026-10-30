import * as React from "react";
import { LayoutModel, StaticPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";
import { useLanguage } from "i18n/LanguageContext";

export interface GalleryPhotoSource {
  src: string;
  srcBig: string;
  width: number;
  height: number;
  // Optional width candidates; the photo's rendered width is passed as `sizes`.
  thumbnailSrcSet?: string;
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

// Gap around each photo (react-photo-gallery's default margin)
const PADDING = 2;

// react-photo-gallery rounded aspect ratios to 2 decimals; rows only break
// the same way with the same rounding
const ratio = ({ width, height }: { width: number; height: number }) =>
  Math.round((width / height) * 100) / 100;

/**
 * Lays photos out in justified rows the way react-photo-gallery did: the
 * cheapest set of row breaks, where each row costs (its height - target)² and
 * holds at most `maxPhotos`. react-photo-album's own rows layout weights that
 * cost by the photos in the row and caps the row length further, which
 * regroups these galleries, so the model is computed here and only rendered by
 * react-photo-album.
 */
export function computeRowsModel<T extends GalleryPhotoData>(
  photos: T[],
  containerWidth: number,
  targetRowHeight: number,
  maxPhotos: number
): LayoutModel<T> {
  const rowHeight = (start: number, end: number) => {
    let ratios = 0;
    for (let i = start; i < end; i += 1) ratios += ratio(photos[i]);
    return (containerWidth - (end - start) * 2 * PADDING) / ratios;
  };

  // cost[i]: cheapest layout of the first i photos; rowStart[i]: where its last row starts
  const cost = [0];
  const rowStart = [0];
  for (let end = 1; end <= photos.length; end += 1) {
    cost[end] = Infinity;
    for (let start = Math.max(0, end - maxPhotos); start < end; start += 1) {
      const candidate = cost[start] + (rowHeight(start, end) - targetRowHeight) ** 2;
      if (candidate < cost[end]) {
        cost[end] = candidate;
        rowStart[end] = start;
      }
    }
  }

  const tracks: LayoutModel<T>["tracks"][number][] = [];
  for (let end = photos.length; end > 0; end = rowStart[end]) {
    const start = rowStart[end];
    const height = rowHeight(start, end);
    tracks.unshift({
      photos: photos.slice(start, end).map((photo, i) => ({
        photo,
        index: start + i,
        width: height * ratio(photo),
        height,
      })),
    });
  }
  return { spacing: 0, padding: PADDING, containerWidth, tracks, horizontal: true };
}

function useContainerWidth() {
  const [containerWidth, setContainerWidth] = React.useState<number>();
  const observer = React.useRef<ResizeObserver | null>(null);
  const containerRef = React.useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const update = () => setContainerWidth(Math.floor(node.getBoundingClientRect().width));
    update();
    observer.current = new ResizeObserver(update);
    observer.current.observe(node);
  }, []);
  return { containerRef, containerWidth };
}

interface PhotoRowsProps {
  photos: GalleryPhotoData[];
  targetRowHeight: (containerWidth: number) => number;
  maxPhotosPerRow: (containerWidth: number) => number;
  onClick: (index: number) => void;
  /** Lay the photos out without downloading them yet. */
  deferred?: boolean;
}

/**
 * Justified rows of photos that open a viewer when clicked. Photos load lazily
 * and are rendered as buttons, so they can be opened from the keyboard.
 */
export default function PhotoRows({
  photos,
  targetRowHeight,
  maxPhotosPerRow,
  onClick,
  deferred = false,
}: PhotoRowsProps) {
  const { t } = useLanguage();
  const { containerRef, containerWidth } = useContainerWidth();
  // Like react-photo-gallery, lay out 1px narrower than the whole-pixel
  // container width, in case the browser rounds photo widths up
  const albumWidth = containerWidth ? containerWidth - 1 : undefined;
  const model = React.useMemo(
    () =>
      containerWidth && albumWidth
        ? computeRowsModel(photos, albumWidth, targetRowHeight(containerWidth), maxPhotosPerRow(containerWidth))
        : undefined,
    [photos, containerWidth, albumWidth, targetRowHeight, maxPhotosPerRow]
  );

  return (
    <div ref={containerRef}>
      <StaticPhotoAlbum
        layout="rows"
        model={model}
        onClick={({ index }) => onClick(index)}
        componentsProps={{
          container: { "aria-label": t("gallery.label"), style: { width: albumWidth } },
          // react-photo-album's srcset/sizes assume a full-viewport album whose
          // src is full size; these thumbnails need the rendered width instead.
          image: ({ photo, width }) => ({
            src: deferred ? undefined : photo.src,
            srcSet: deferred ? undefined : photo.thumbnailSrcSet,
            sizes: photo.thumbnailSrcSet ? `${Math.round(width * 10) / 10}px` : undefined,
          }),
        }}
      />
    </div>
  );
}
