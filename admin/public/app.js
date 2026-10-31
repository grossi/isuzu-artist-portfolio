import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);
let state = null;
let logLines = [];
let logJobId = null;
let showLog = false;
let pendingFocus = null;

// ---- Server ----------------------------------------------------------------

async function api(method, url, body) {
  const headers = { "X-Isuzu-Admin": "1" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${res.statusText}`);
  return data;
}

let refreshing = null;
function refresh() {
  refreshing ??= api("GET", "/api/state")
    .then((next) => {
      state = next;
      render();
    })
    .catch((error) => toast(error.message, true))
    .finally(() => (refreshing = null));
  return refreshing;
}

async function act(promise, done) {
  try {
    const result = await promise;
    if (done) toast(done);
    return result;
  } catch (error) {
    toast(error.message, true);
  } finally {
    await refresh();
  }
}

function events() {
  const source = new EventSource("/api/events");
  source.addEventListener("snapshot", (e) => {
    const { job, log } = JSON.parse(e.data);
    logJobId = job?.id ?? null;
    logLines = log;
    renderLog();
  });
  source.addEventListener("job", (e) => {
    const job = JSON.parse(e.data);
    if (job.id !== logJobId) {
      logJobId = job.id;
      logLines = [];
      showLog = true;
      renderLog();
    }
    if (state) state.job = job;
    renderJob();
    if (job.status !== "running") refresh();
  });
  source.addEventListener("log", (e) => {
    const { id, line } = JSON.parse(e.data);
    if (id !== logJobId) return;
    logLines.push(line);
    appendLog(line);
  });
  source.addEventListener("state", () => refresh());
  source.onerror = () => {}; // EventSource reconnects by itself
  source.onopen = () => refresh();
}

// ---- Helpers ---------------------------------------------------------------

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false || value === null) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

let toastTimer;
function toast(message, bad = false) {
  const node = $("toast");
  node.textContent = message;
  node.className = `toast${bad ? " bad" : ""}`;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), bad ? 7000 : 3000);
}

const busy = () => Boolean(state?.busy) || Boolean(state?.error);
const thumb = (ref) => `/thumb/${ref.split("/").map(encodeURIComponent).join("/")}`;
const image = (ref) => `/image/${ref.split("/").map(encodeURIComponent).join("/")}`;
const short = (sha) => sha.slice(0, 7);

function ago(iso) {
  const seconds = (Date.now() - new Date(iso)) / 1000;
  if (seconds < 90) return "just now";
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 129600) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function previewUrl() {
  return state?.previewUrl || `${location.protocol}//${location.hostname}:${state?.previewPort ?? 8972}/`;
}

// ---- Edits -----------------------------------------------------------------

function move(list, item, to) {
  const next = list.filter((x) => x !== item);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

async function saveOrder(gallery, carousel, focus) {
  pendingFocus = focus;
  // Optimistic: show the new order at once, the server confirms it.
  Object.assign(state, { gallery, carousel });
  render();
  await act(api("PUT", "/api/order", { version: state.version, gallery, carousel }));
}

function toggleSlide(ref) {
  const carousel = state.carousel.includes(ref) ? state.carousel.filter((r) => r !== ref) : [...state.carousel, ref];
  saveOrder(state.gallery, carousel, `${ref}:star`);
}

function upload(fileList) {
  const files = [...fileList].filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
  if (!files.length) return toast("Only JPEG, PNG and WebP images can be added", true);
  if (files.length < fileList.length) toast(`Skipping ${fileList.length - files.length} non-image file(s)`, true);
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  // XHR for the upload progress, which fetch doesn't report.
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");
  xhr.setRequestHeader("X-Isuzu-Admin", "1");
  xhr.upload.onprogress = (e) => e.lengthComputable && toast(`Uploading ${files.length} file(s)… ${Math.round((e.loaded / e.total) * 100)}%`);
  xhr.onload = () => {
    const data = JSON.parse(xhr.responseText || "{}");
    if (xhr.status === 200) toast(`Added ${data.added.join(", ")}`);
    else toast(data.error || `Upload failed (${xhr.status})`, true);
    refresh();
  };
  xhr.onerror = () => toast("Upload failed: network error", true);
  xhr.send(form);
}

// ---- Rendering -------------------------------------------------------------

function render() {
  renderStatus();
  renderJob();
  renderGrid();
  const locked = busy();
  for (const id of ["preview", "save", "deploy", "discard", "add-entry", "heading-ja", "heading-en"]) $(id).disabled = locked;
  $("add").classList.toggle("disabled", locked);
  $("save").disabled ||= !state.draft?.dirty;
  $("discard").disabled ||= !state.draft?.dirty;
  $("error").hidden = !state.error;
  $("error").textContent = state.error ?? "";
  document.body.classList.toggle("locked", locked);
  for (const sortable of sortables) sortable.option("disabled", locked);
}

function renderStatus() {
  const { draft, history, preview } = state;
  if (!draft) return $("status").replaceChildren();
  const changes = [
    draft.added.length && `${draft.added.length} added: ${draft.added.join(", ")}`,
    draft.removed.length && `${draft.removed.length} removed: ${draft.removed.join(", ")}`,
    draft.reordered && "gallery reordered",
    draft.slidesAdded.length && `carousel +${draft.slidesAdded.join(", +")}`,
    draft.slidesRemoved.length && `carousel −${draft.slidesRemoved.join(", −")}`,
    draft.carouselReordered && "carousel reordered",
    draft.entriesAdded.length && `sidebar +${draft.entriesAdded.join(", +")}`,
    draft.entriesEdited.length && `sidebar edited: ${draft.entriesEdited.join(", ")}`,
    draft.entriesRemoved.length && `sidebar −${draft.entriesRemoved.join(", −")}`,
    draft.entriesReordered && "sidebar reordered",
    draft.headingChanged && "sidebar heading changed",
  ].filter(Boolean);
  const previewText = !preview
    ? "No preview built yet."
    : preview.stale
      ? `Preview is older than the draft (built ${ago(preview.builtAt)}).`
      : `Preview is up to date (built ${ago(preview.builtAt)}).`;

  const cards = [
    el("div", { class: `card ${draft.dirty ? "draft" : "idle"}` },
      el("h3", {}, draft.dirty ? "Draft · not saved" : "Draft"),
      draft.dirty
        ? el("ul", {}, (changes.length ? changes : ["manifests regenerated"]).map((c) => el("li", {}, c)))
        : el("div", { class: "muted" }, "No unsaved changes."),
      draft.other.length ? el("div", { class: "muted" }, `Other workspace changes: ${draft.other.join(", ")}`) : null,
      el("div", { class: "muted" }, previewText, " ", el("a", { href: previewUrl(), target: "isuzu-preview" }, "Open preview ↗"))),
    el("div", { class: `card ${history.notDeployed.length ? "saved" : "idle"}` },
      el("h3", {}, "Saved · not deployed"),
      history.notDeployed.length
        ? el("ul", {}, history.notDeployed.slice(0, 6).map((c) => el("li", {}, `${short(c.sha)} ${c.subject}`)),
            history.notDeployed.length > 6 ? el("li", {}, `… ${history.notDeployed.length - 6} more`) : null)
        : el("div", { class: "muted" }, `Nothing saved since ${history.notDeployedBase}.`),
      history.notPushed ? el("div", { class: "muted" }, `${history.notPushed} commit(s) not on GitHub yet.`) : null),
    el("div", { class: `card ${history.deployed ? "live" : "idle"}` },
      el("h3", {}, "Live on isuzu.work"),
      history.deployed
        ? el("div", {}, `${short(history.deployed.sha)} ${history.deployed.subject}`, el("div", { class: "muted" }, `deployed ${ago(history.deployed.at)} from this admin`))
        : el("div", { class: "muted" }, "Not deployed from this admin yet."),
      history.deployed?.diverged ? el("div", { class: "muted" }, "That commit is no longer in main's history.") : null),
  ];
  $("status").replaceChildren(...cards);
}

const TITLES = { preview: "Preview build", save: "Save", deploy: "Deploy" };
function renderJob() {
  const job = state?.job;
  $("job").hidden = !job;
  if (!job) return;
  $("job").className = `job ${job.status}`;
  const name = TITLES[job.kind] ?? job.kind;
  $("job-title").textContent =
    job.status === "running" ? `${name} running…` : job.status === "succeeded" ? `✓ ${name} finished ${ago(job.finishedAt)}` : `✗ ${name} failed: ${job.error}`;
  const links = [];
  if (job.kind === "preview" && job.status === "succeeded") links.push(el("a", { href: previewUrl(), target: "isuzu-preview" }, "Open preview ↗"));
  $("job-links").replaceChildren(...links);
  if (job.status === "failed") showLog = true;
  $("job-log").hidden = !showLog;
  $("job-toggle").textContent = showLog ? "Hide log" : "Show log";
}

function renderLog() {
  $("job-log").textContent = logLines.length ? `${logLines.join("\n")}\n` : "";
  $("job-log").scrollTop = $("job-log").scrollHeight;
}

function appendLog(line) {
  const log = $("job-log");
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  log.append(`${line}\n`);
  if (atBottom) log.scrollTop = log.scrollHeight;
}

function controlButton(label, title, onclick, disabled, key) {
  return el("button", { type: "button", title, "aria-label": title, onclick, disabled, "data-key": key }, label);
}

function galleryTile(file, index) {
  const ref = `gallery/${file}`;
  const { gallery, carousel, draft } = state;
  const inCarousel = carousel.includes(ref);
  const isNew = draft.untracked.includes(file);
  const last = gallery.length - 1;
  const moveTo = (to, key) => () => saveOrder(move(gallery, file, to), carousel, `${ref}:${key}`);
  return el("div", { class: `tile${isNew ? " new" : ""}${inCarousel ? " in-carousel" : ""}`, "data-id": file },
    el("img", { class: "thumb", src: thumb(ref), alt: file, loading: "lazy", draggable: "false" }),
    isNew ? el("span", { class: "badge" }, "new") : null,
    isNew ? el("button", { type: "button", class: "remove", title: `Remove ${file}`, "aria-label": `Remove ${file}`, onclick: () => remove(file) }, "×") : null,
    el("div", { class: "meta" }, el("span", { class: "index" }, `${index + 1}`), el("a", { class: "name", href: image(ref), target: "_blank", title: file }, file)),
    el("div", { class: "controls" },
      el("button", { type: "button", class: "star", "aria-pressed": String(inCarousel), title: inCarousel ? "Remove from the carousel" : "Add to the carousel", "aria-label": `${inCarousel ? "Remove from" : "Add to"} the carousel: ${file}`, onclick: () => toggleSlide(ref), "data-key": `${ref}:star` }, inCarousel ? "★" : "☆"),
      controlButton("⤒", `Move ${file} to the top`, moveTo(0, "top"), index === 0, `${ref}:top`),
      controlButton("‹", `Move ${file} earlier`, moveTo(index - 1, "up"), index === 0, `${ref}:up`),
      controlButton("›", `Move ${file} later`, moveTo(index + 1, "down"), index === last, `${ref}:down`)));
}

function slideTile(ref, index) {
  const { gallery, carousel } = state;
  const last = carousel.length - 1;
  const moveTo = (to, key) => () => saveOrder(gallery, move(carousel, ref, to), `slide:${ref}:${key}`);
  return el("div", { class: "tile", "data-id": ref },
    el("img", { class: "thumb", src: thumb(ref), alt: ref, loading: "lazy", draggable: "false" }),
    el("div", { class: "meta" }, el("span", { class: "index" }, `${index + 1}`), el("span", { class: "name", title: ref }, ref)),
    el("div", { class: "controls" },
      controlButton("‹", `Move slide ${ref} earlier`, moveTo(index - 1, "up"), index === 0, `slide:${ref}:up`),
      controlButton("›", `Move slide ${ref} later`, moveTo(index + 1, "down"), index === last, `slide:${ref}:down`),
      controlButton("✕", `Remove slide ${ref}`, () => toggleSlide(ref), false, `slide:${ref}:remove`)));
}

function extraTile(file) {
  const ref = `carousel/${file}`;
  const inCarousel = state.carousel.includes(ref);
  return el("div", { class: `tile${inCarousel ? " in-carousel" : ""}` },
    el("img", { class: "thumb", src: thumb(ref), alt: file, loading: "lazy" }),
    el("div", { class: "meta" }, el("a", { class: "name", href: image(ref), target: "_blank", title: file }, file)),
    el("div", { class: "controls" },
      el("button", { type: "button", class: "star", "aria-pressed": String(inCarousel), title: inCarousel ? "Remove from the carousel" : "Add to the carousel", "aria-label": `${inCarousel ? "Remove from" : "Add to"} the carousel: ${file}`, onclick: () => toggleSlide(ref), "data-key": `${ref}:star` }, inCarousel ? "★ in carousel" : "☆ add to carousel")));
}

function renderGrid() {
  if (!state.gallery) return;
  renderSidebar();
  $("gallery").replaceChildren(...state.gallery.map(galleryTile));
  $("carousel").replaceChildren(...state.carousel.map(slideTile));
  $("carousel-empty").hidden = state.carousel.length > 0;
  $("extras").replaceChildren(...state.carouselFiles.map(extraTile));
  if (pendingFocus) {
    // Keep keyboard focus on the button that was used (or its neighbour).
    const target = document.querySelector(`[data-key="${CSS.escape(pendingFocus)}"]:not(:disabled)`);
    target?.focus({ preventScroll: false });
    pendingFocus = null;
  }
}

// ---- Sidebar entries -------------------------------------------------------

const LANGS = { ja: "日本語", en: "English" };

async function saveSidebar(heading, order, focus) {
  pendingFocus = focus;
  const byId = new Map(state.sidebar.entries.map((entry) => [entry.id, entry]));
  state.sidebar = { heading, entries: order.map((id) => byId.get(id)) };
  render();
  await act(api("PUT", "/api/sidebar", { version: state.version, heading, order }));
}

const sidebarOrder = () => state.sidebar.entries.map((entry) => entry.id);
const headingInputs = () => ({ ja: $("heading-ja").value, en: $("heading-en").value });

function description(entry, lang) {
  const other = lang === "ja" ? "en" : "ja";
  const text = entry.description[lang];
  return el("div", { class: "md-preview small" },
    el("span", { class: "lang" }, LANGS[lang]),
    text.trim() ? renderMarkdown(text) : el("p", { class: "muted" }, `(empty: the site shows the ${LANGS[other]} text)`));
}

function entryCard(entry, index) {
  const order = sidebarOrder();
  const moveTo = (to, key) => () => saveSidebar(state.sidebar.heading, move(order, entry.id, to), `entry:${entry.id}:${key}`);
  return el("div", { class: "entry", "data-id": entry.id },
    el("img", { class: "entry-thumb", src: `/thumb/sidebar/${entry.id}?v=${encodeURIComponent(entry.image)}`, alt: "", draggable: "false" }),
    el("div", { class: "entry-body" },
      el("div", { class: "entry-meta" },
        el("span", { class: "index" }, `${index + 1}`),
        el("strong", {}, entry.id),
        entry.link
          ? el("a", { href: entry.link, target: "_blank", rel: "noopener noreferrer" }, entry.link)
          : el("span", { class: "muted" }, "no link")),
      el("div", { class: "entry-langs" }, description(entry, "ja"), description(entry, "en"))),
    el("div", { class: "entry-controls" },
      controlButton("⤒", `Move ${entry.id} to the top`, moveTo(0, "top"), index === 0, `entry:${entry.id}:top`),
      controlButton("↑", `Move ${entry.id} up`, moveTo(index - 1, "up"), index === 0, `entry:${entry.id}:up`),
      controlButton("↓", `Move ${entry.id} down`, moveTo(index + 1, "down"), index === order.length - 1, `entry:${entry.id}:down`),
      el("button", { type: "button", onclick: () => openEntry(entry), disabled: busy() }, "Edit"),
      el("button", { type: "button", class: "danger", onclick: () => removeEntry(entry), disabled: busy() }, "Remove")));
}

function renderSidebar() {
  const { heading, entries } = state.sidebar;
  for (const lang of Object.keys(LANGS)) {
    const input = $(`heading-${lang}`);
    if (document.activeElement !== input) input.value = heading[lang];
  }
  $("entries").replaceChildren(...entries.map(entryCard));
  $("entries-empty").hidden = entries.length > 0;
}

async function removeEntry(entry) {
  if (!confirm(`Remove "${entry.id}" from the sidebar?\n\nIt disappears from the site once saved and deployed; the git history keeps its files.`)) return;
  await act(api("POST", "/api/sidebar/remove", { id: entry.id }), `Removed ${entry.id}`);
}

// The add / edit dialog. entryImage: a newly chosen File, if any.
let editing = null;
let entryImage = null;

function setEntryImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Choose a JPEG, PNG or WebP image", true);
  entryImage = file;
  showEntryImage(URL.createObjectURL(file));
}

function showEntryImage(src) {
  const img = $("entry-image-preview");
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  img.hidden = !src;
  if (src) img.src = src;
  else img.removeAttribute("src");
  $("entry-image-hint").textContent = src ? "Drop or click to replace" : "";
  if (!src) $("entry-image-hint").append("Drop an image here", el("br"), "or click to choose");
}

function updateEntryPreview() {
  const texts = { ja: $("entry-ja").value, en: $("entry-en").value };
  for (const lang of Object.keys(LANGS)) {
    const other = lang === "ja" ? "en" : "ja";
    const shown = texts[lang].trim() ? texts[lang] : texts[other];
    $(`entry-${lang}-preview`).replaceChildren(
      el("span", { class: "lang" }, `${LANGS[lang]} site`),
      shown.trim()
        ? [texts[lang].trim() ? null : el("p", { class: "muted" }, `(empty: showing the ${LANGS[other]} text)`), renderMarkdown(shown)]
        : el("p", { class: "muted" }, "(no description)"));
  }
  const link = $("entry-link").value.trim();
  const error = link && !validLink(link) ? "Enter a full link starting with https:// (or http://)." : "";
  $("entry-link-error").textContent = error;
  $("entry-link-error").hidden = !error;
}

function validLink(link) {
  try {
    const url = new URL(link);
    return (url.protocol === "https:" || url.protocol === "http:") && !/\s/.test(link);
  } catch {
    return false;
  }
}

function openEntry(entry = null) {
  editing = entry;
  entryImage = null;
  $("entry-title").textContent = entry ? `Edit sidebar entry: ${entry.id}` : "Add a sidebar entry";
  $("entry-link").value = entry?.link ?? "";
  $("entry-ja").value = entry?.description.ja ?? "";
  $("entry-en").value = entry?.description.en ?? "";
  $("entry-error").hidden = true;
  showEntryImage(entry ? `/thumb/sidebar/${entry.id}?v=${encodeURIComponent(entry.image)}` : null);
  updateEntryPreview();
  $("entry-dialog").showModal();
}

async function submitEntry(event) {
  event.preventDefault();
  const link = $("entry-link").value.trim();
  const fail = (message) => {
    $("entry-error").textContent = message;
    $("entry-error").hidden = false;
  };
  if (link && !validLink(link)) return fail("The link must start with https:// or http://.");
  if (!editing && !entryImage) return fail("Choose an image for the new entry.");
  const form = new FormData();
  form.append("entry", JSON.stringify({ id: editing?.id, link, description: { ja: $("entry-ja").value, en: $("entry-en").value } }));
  if (entryImage) form.append("image", entryImage, entryImage.name);
  $("entry-submit").disabled = true;
  try {
    const res = await fetch("/api/sidebar/entry", { method: "POST", headers: { "X-Isuzu-Admin": "1" }, body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return fail(data.error || `Saving failed (${res.status})`);
    $("entry-dialog").close();
    toast(editing ? `Updated ${data.saved.id}` : `Added ${data.saved.id} at the top of the sidebar`);
    await refresh();
  } catch (error) {
    fail(error.message);
  } finally {
    $("entry-submit").disabled = false;
  }
}

$("add-entry").addEventListener("click", () => openEntry());
$("entry-form").addEventListener("submit", submitEntry);
$("entry-cancel").addEventListener("click", () => $("entry-dialog").close());
$("entry-picker").addEventListener("change", (e) => {
  setEntryImage(e.target.files[0]);
  e.target.value = "";
});
for (const id of ["entry-ja", "entry-en", "entry-link"]) $(id).addEventListener("input", updateEntryPreview);
for (const lang of Object.keys(LANGS)) {
  $(`heading-${lang}`).addEventListener("change", () => saveSidebar(headingInputs(), sidebarOrder()));
}

// ---- Actions ---------------------------------------------------------------

async function remove(file) {
  if (!confirm(`Remove the unsaved upload ${file}?`)) return;
  await act(api("POST", "/api/remove", { file }), `Removed ${file}`);
}

async function preview() {
  if (state.preview && !state.preview.stale) return window.open(previewUrl(), "isuzu-preview");
  // Opened in the click so pop-up blockers allow it, pointed at the preview
  // once the build has started: it shows a "building" page until it is done.
  const tab = window.open("", "isuzu-preview");
  const started = await act(api("POST", "/api/preview"));
  if (started && tab) tab.location = previewUrl();
  else tab?.close();
}

function save() {
  $("save-message").value = state.draft.message;
  $("save-dialog").showModal();
}

$("save-dialog").addEventListener("close", () => {
  if ($("save-dialog").returnValue !== "save") return;
  act(api("POST", "/api/save", { message: $("save-message").value }));
});

function deploy() {
  const { draft, history, deployCommand } = state;
  const commits = history.notDeployed;
  $("deploy-body").replaceChildren(
    ...(draft.dirty ? [el("p", { class: "banner error" }, "The draft has unsaved changes. Save or discard them first.")] : []),
    commits.length
      ? el("div", {}, el("p", {}, "These saved commits will go live:"), el("ul", {}, commits.map((c) => el("li", {}, `${short(c.sha)} ${c.subject}`))))
      : el("p", {}, "Nothing new is saved; this re-deploys the current main."),
    el("p", { class: "muted" }, "Fetches GitHub, rebases onto origin/main, pushes main, then runs ", el("code", {}, deployCommand), ".")
  );
  $("deploy-confirm").disabled = draft.dirty;
  $("deploy-dialog").showModal();
}

$("deploy-dialog").addEventListener("close", () => {
  if ($("deploy-dialog").returnValue === "deploy") act(api("POST", "/api/deploy"));
});

function discard() {
  if (!confirm("Discard every unsaved change (uploads, order, carousel)? Saved commits are kept.")) return;
  act(api("POST", "/api/discard"), "Draft discarded");
}

$("preview").addEventListener("click", preview);
$("save").addEventListener("click", save);
$("deploy").addEventListener("click", deploy);
$("discard").addEventListener("click", discard);
$("picker").addEventListener("change", (e) => {
  upload(e.target.files);
  e.target.value = "";
});
$("job-toggle").addEventListener("click", () => {
  showLog = !showLog;
  renderJob();
  renderLog();
});

// Dropping files anywhere on the page uploads them. Drags that start in the
// page (reordering) never show the drop zone.
let dragDepth = 0;
let internalDrag = false;
const hasFiles = (e) => !internalDrag && [...(e.dataTransfer?.types ?? [])].includes("Files");
window.addEventListener("dragstart", () => (internalDrag = true));
window.addEventListener("dragend", () => {
  internalDrag = false;
  dragDepth = 0;
  $("drop").hidden = true;
});
window.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  dragDepth++;
  $("drop").hidden = busy() || $("entry-dialog").open;
});
window.addEventListener("dragleave", (e) => {
  if (hasFiles(e) && --dragDepth <= 0) {
    dragDepth = 0;
    $("drop").hidden = true;
  }
});
window.addEventListener("dragover", (e) => hasFiles(e) && e.preventDefault());
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $("drop").hidden = true;
  if ($("entry-dialog").open) return setEntryImage(e.dataTransfer.files[0]);
  if (busy()) return toast(`Busy: ${state.busy || "workspace unavailable"}`, true);
  upload(e.dataTransfer.files);
});

// Drag to reorder, with touch: a short press starts a drag so the page still scrolls.
const sortables = [];
function sortable(container, onSort) {
  sortables.push(
    window.Sortable.create(container, {
      animation: 150,
      delay: 180,
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      filter: "button, a",
      preventOnFilter: false,
      onEnd: (e) => {
        if (e.oldIndex === e.newIndex) return;
        onSort([...container.children].map((node) => node.dataset.id));
      },
    })
  );
}

window.addEventListener("DOMContentLoaded", () => {
  sortable($("gallery"), (gallery) => saveOrder(gallery, state.carousel));
  sortable($("carousel"), (carousel) => saveOrder(state.gallery, carousel));
  sortable($("entries"), (order) => saveSidebar(state.sidebar.heading, order));
  refresh();
  events();
  setInterval(() => state && renderStatus(), 60000); // keep the "… ago" labels fresh
});
