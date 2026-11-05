const fs = require("fs");
const path = require("path");

// The gallery order and the carousel are explicit data in src/image-order.json,
// written by the admin console (admin/):
//
//   {
//     "gallery": ["new-piece.png", "10000.png", ...],
//     "carousel": ["carousel/2024.png", "gallery/new-piece.png", ...]
//   }
//
// "gallery" lists files in public/gallery/. Listed files come first, in that
// order, then any unlisted ones in plain code-unit (byte) order, so a file added
// by hand still shows up. "carousel" is the complete, ordered list of slides:
// files in public/carousel/ or in public/gallery/, which reuse the gallery's
// large/ derivatives. Without the file, or without a key, the old behaviour
// applies: the whole gallery in byte order, every image in public/carousel/.
//
// "carouselFocus" (optional) says, per slide, where its picture is cut when
// the slide is wider than the picture's shape: { "carousel/2024.png": 50 },
// from 0 (keep the top) to 100 (keep the bottom). A slide without one uses
// DEFAULT_FOCUS_Y. src/utils/loadImages.js writes each slide's value into
// src/carousel.json as "focusY", which the home page slider (Featured) uses.
// The admin offers FOCUS_CHOICES.
const ORDER_FILE = "src/image-order.json";
const DEFAULT_FOCUS_Y = 30;
const FOCUS_CHOICES = [15, 30, 50];
// A slide as the order file names it: a file directly in public/carousel/ or
// public/gallery/.
const SLIDE_REF = /^(carousel|gallery)\/(?!\.\.?$)[^/]+$/;

const IMAGE_EXTENSIONS = ["jpg", "png", "webp"];

// Same split the generated manifests have always used: "a.b.png" is not an image.
function splitName(file) {
  const [name, extension] = file.split(".");
  return { name, extension };
}

function isImageFile(file) {
  return IMAGE_EXTENSIONS.includes(splitName(file).extension);
}

function readOrder(root) {
  const file = path.join(root, ORDER_FILE);
  return fs.existsSync(file) ? parseOrder(fs.readFileSync(file, "utf-8")) : {};
}

function parseOrder(text) {
  const order = JSON.parse(text);
  for (const key of ["gallery", "carousel"]) {
    if (order[key] !== undefined && !(Array.isArray(order[key]) && order[key].every((item) => typeof item === "string"))) {
      throw new Error(`${ORDER_FILE}: "${key}" must be a list of file names`);
    }
  }
  const focus = order.carouselFocus;
  if (
    focus !== undefined &&
    !(
      focus &&
      typeof focus === "object" &&
      !Array.isArray(focus) &&
      Object.entries(focus).every(([ref, y]) => SLIDE_REF.test(ref) && Number.isInteger(y) && y >= 0 && y <= 100)
    )
  ) {
    throw new Error(`${ORDER_FILE}: "carouselFocus" must map slides (carousel/… or gallery/…) to whole numbers from 0 to 100`);
  }
  return order;
}

// Where a slide's picture is cut (see "carouselFocus" above).
function focusOf(order, ref) {
  return Object.hasOwn(order.carouselFocus ?? {}, ref) ? order.carouselFocus[ref] : DEFAULT_FOCUS_Y;
}

// Image files directly in dir, in byte order (directories such as small/ are
// skipped; a symlink counts if it points to a file).
function listImages(dir) {
  const isFile = (entry) => entry.isFile() || (entry.isSymbolicLink() && Boolean(fs.statSync(path.join(dir, entry.name), { throwIfNoEntry: false })?.isFile()));
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => isFile(entry) && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function warn(message) {
  console.warn(`${ORDER_FILE}: ${message}`);
}

// files: the gallery's images in byte order. listed: order.gallery.
function orderGallery(files, listed = []) {
  const available = new Set(files);
  const head = [...new Set(listed)].filter((file) => {
    if (!available.has(file)) warn(`skipping "${file}", not an image in public/gallery/`);
    return available.has(file);
  });
  const inHead = new Set(head);
  return [...head, ...files.filter((file) => !inHead.has(file))];
}

// Carousel slides as "carousel/<file>" or "gallery/<file>" references.
function orderCarousel(carouselFiles, galleryFiles, listed) {
  if (listed === undefined) return carouselFiles.map((file) => `carousel/${file}`);
  const available = new Set([
    ...carouselFiles.map((file) => `carousel/${file}`),
    ...galleryFiles.map((file) => `gallery/${file}`),
  ]);
  return [...new Set(listed)].filter((ref) => {
    if (!available.has(ref)) warn(`skipping carousel slide "${ref}", no such image`);
    return available.has(ref);
  });
}

module.exports = { ORDER_FILE, IMAGE_EXTENSIONS, DEFAULT_FOCUS_Y, FOCUS_CHOICES, splitName, isImageFile, readOrder, parseOrder, focusOf, listImages, orderGallery, orderCarousel };
