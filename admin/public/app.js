import { lang, onLangChange, rich, setLang, t, translatePage } from "./i18n/index.js";
import { renderMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);
let state = null;
let logLines = [];
let logJobId = null;
let showLog = false;
let pendingFocus = null;

// ---- Server ----------------------------------------------------------------

// A server error ({ error, code, params }) shown in the page's language. The
// English message is the fallback for a code this page doesn't know. An answer
// without one (a proxy's error page) gets fallbackCode.
class ApiError extends Error {
  constructor(data, fallbackCode, status) {
    const coded = data.code || data.error ? data : { code: fallbackCode, params: { status } };
    super(data.error || t(`error.${fallbackCode}`, { status }));
    this.code = coded.code;
    this.params = coded.params;
  }
}

// A translated label, or fallback when this page doesn't know the key (a tab
// from before the server was updated).
const label = (key, fallback, params) => (t.has(key) ? t(key, params) : fallback);

function errorText({ code, params = {}, message }) {
  if (!code || !t.has(`error.${code}`)) return message;
  // The lock holder is a job kind: name it in this language too.
  if (params.kind && !t.has(`kind.${params.kind}`)) return message;
  const shown = params.kind ? { ...params, kind: t(`kind.${params.kind}`) } : params;
  return t(`error.${code}`, shown);
}

// Fetch's own failure (the server is down) is a TypeError in English.
const networkError = () => new ApiError({ code: "network", error: t("error.network") });

// body: an object sent as JSON, or FormData (a multipart upload).
async function api(method, url, body) {
  const headers = { "X-Isuzu-Admin": "1" };
  const form = body instanceof FormData;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined || form ? body : JSON.stringify(body) }).catch(() => {
    throw networkError();
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data, "request-failed", res.status);
  return data;
}

// Draft edits go one at a time, each with the version the previous one
// returned, so quick successive edits don't trip the stale-tab check.
let edits = Promise.resolve();
let pendingEdits = 0; // queued or in flight: refreshes wait for them
let latestVersion = 0; // the newest draft version any response has shown
function queue(send) {
  pendingEdits++;
  const next = edits.then(async () => {
    const result = await send();
    if (typeof result?.version === "number") {
      latestVersion = Math.max(latestVersion, result.version);
      // Each edit bumps the version by one: anything else means another tab
      // edited in between, and the refresh will bring its changes.
      if (state && result.version === state.version + 1) state.version = result.version;
    }
    return result;
  });
  edits = next.catch(() => {}).finally(() => {
    if (--pendingEdits === 0 && refreshAgain) {
      refreshAgain = false;
      refresh();
    }
  });
  return next;
}
// version: what the edit was based on, when that isn't simply the latest
// state (a heading typed in while another tab changed it).
const edit = (method, url, body, version) =>
  queue(async () => api(method, url, { ...body, version: version === undefined ? state.version : await version }));

// One state request at a time. A refresh asked for while one is in flight
// runs again after it: the first may predate the edit that asked.
let refreshing = null;
let refreshAgain = false;
function refresh() {
  // While edits are pending, the state on screen is ahead of the server's:
  // fetch once they are done instead.
  if (refreshing || pendingEdits > 0) {
    refreshAgain = true;
    return refreshing ?? Promise.resolve();
  }
  refreshing = api("GET", "/api/state")
    .then((next) => {
      // Sent before an edit that has since answered, or one started meanwhile.
      if (next.version < latestVersion || pendingEdits > 0) {
        refreshAgain = true;
        return;
      }
      latestVersion = next.version;
      state = next;
      render();
    })
    .catch((error) => toast(() => errorText(error), true))
    .finally(() => {
      refreshing = null;
      if (refreshAgain) {
        refreshAgain = false;
        refresh();
      }
    });
  return refreshing;
}

// done: the toast for a success (see toast()).
async function act(promise, done) {
  try {
    const result = await promise;
    if (done) toast(done);
    return result;
  } catch (error) {
    toast(() => errorText(error), true);
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

// message: a function returning the text, so a language switch can redraw it.
let toastTimer;
let toastMessage = null;
function toast(message, bad = false) {
  const node = $("toast");
  toastMessage = message;
  node.textContent = message();
  node.className = `toast${bad ? " bad" : ""}`;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), bad ? 7000 : 3000);
}

function renderToast() {
  if (!$("toast").hidden && toastMessage) $("toast").textContent = toastMessage();
}

const busy = () => Boolean(state?.busy) || Boolean(state?.error);
const thumb = (ref) => `/thumb/${ref.split("/").map(encodeURIComponent).join("/")}`;
const image = (ref) => `/image/${ref.split("/").map(encodeURIComponent).join("/")}`;
const short = (sha) => sha.slice(0, 7);

function ago(iso) {
  const seconds = (Date.now() - new Date(iso)) / 1000;
  const relative = new Intl.RelativeTimeFormat(lang, { style: "short" });
  if (seconds < 90) return t("time.justNow");
  if (seconds < 5400) return relative.format(-Math.round(seconds / 60), "minute");
  if (seconds < 129600) return relative.format(-Math.round(seconds / 3600), "hour");
  return new Date(iso).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
}

const list = (items) => items.join(t("common.listSeparator"));

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
  await act(edit("PUT", "/api/order", { gallery, carousel }));
}

function toggleSlide(ref) {
  const carousel = state.carousel.includes(ref) ? state.carousel.filter((r) => r !== ref) : [...state.carousel, ref];
  saveOrder(state.gallery, carousel, `${ref}:star`);
}

function upload(fileList) {
  const files = [...fileList].filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
  if (!files.length) return toast(() => t("toast.onlyImages"), true);
  const skipped = fileList.length - files.length;
  if (skipped) toast(() => t("toast.skipping", { n: skipped }), true);
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  // XHR for the upload progress, which fetch doesn't report.
  const send = () => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("X-Isuzu-Admin", "1");
    xhr.upload.onprogress = (e) => {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (e.lengthComputable) toast(() => t("toast.uploading", { n: files.length, percent }));
    };
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || "{}");
      } catch {
        // not JSON (a proxy error page)
      }
      if (xhr.status === 200) resolve(data);
      else reject(new ApiError(data, "upload-failed", xhr.status));
    };
    xhr.onerror = () => reject(networkError());
    xhr.send(form);
  });
  queue(send).then((data) => toast(() => t("toast.added", { list: list(data.added) })), (error) => toast(() => errorText(error), true)).finally(refresh);
}

// ---- Rendering -------------------------------------------------------------

function render() {
  $("live-link").href = state.siteUrl;
  $("live-link").hidden = false;
  renderStatus();
  renderJob();
  renderGrid();
  const locked = busy();
  for (const id of ["preview", "save", "deploy", "discard", "add-entry", "heading-ja", "heading-en"]) $(id).disabled = locked;
  $("add").classList.toggle("disabled", locked);
  $("save").disabled ||= !state.draft?.dirty;
  // Discard stays available when the workspace can't be read (say a
  // hand-edited content file): resetting it is the way out.
  $("discard").disabled = Boolean(state.busy) || !(state.draft?.dirty || state.error);
  const banner = state.error
    ? [errorText({ code: state.errorCode, params: state.errorParams, message: state.error })]
    : state.restartNeeded ? rich("banner.restart") : null;
  $("error").hidden = !banner;
  $("error").replaceChildren(...(banner ?? []));
  document.body.classList.toggle("locked", locked);
  for (const sortable of sortables) sortable.option("disabled", locked);
}

function renderStatus() {
  const { draft, history, preview } = state;
  if (!draft) return $("status").replaceChildren();
  const changes = [
    draft.added.length && t("change.added", { n: draft.added.length, list: list(draft.added) }),
    draft.removed.length && t("change.removed", { n: draft.removed.length, list: list(draft.removed) }),
    draft.reordered && t("change.reordered"),
    draft.slidesAdded.length && t("change.slidesAdded", { list: list(draft.slidesAdded) }),
    draft.slidesRemoved.length && t("change.slidesRemoved", { list: list(draft.slidesRemoved) }),
    draft.carouselReordered && t("change.carouselReordered"),
    draft.entriesAdded.length && t("change.entriesAdded", { list: list(draft.entriesAdded) }),
    draft.entriesEdited.length && t("change.entriesEdited", { list: list(draft.entriesEdited) }),
    draft.entriesRemoved.length && t("change.entriesRemoved", { list: list(draft.entriesRemoved) }),
    draft.entriesReordered && t("change.entriesReordered"),
    draft.headingChanged && t("change.headingChanged"),
  ].filter(Boolean);
  const previewText = !preview
    ? t("status.noPreview")
    : t(preview.stale ? "status.previewStale" : "status.previewFresh", { ago: ago(preview.builtAt) });

  const cards = [
    el("div", { class: `card ${draft.dirty ? "draft" : "idle"}` },
      el("h3", {}, t(draft.dirty ? "status.draftDirty" : "status.draft")),
      draft.dirty
        ? el("ul", {}, (changes.length ? changes : [t("status.manifestsOnly")]).map((c) => el("li", {}, c)))
        : el("div", { class: "muted" }, t("status.noChanges")),
      draft.other.length ? el("div", { class: "muted" }, t("status.otherChanges", { list: list(draft.other) })) : null,
      el("div", { class: "muted" }, previewText, " ", el("a", { href: previewUrl(), target: "isuzu-preview" }, t("common.openPreview")))),
    el("div", { class: `card ${history.notDeployed.length ? "saved" : "idle"}` },
      el("h3", {}, t("status.saved")),
      history.notDeployed.length
        ? el("ul", {}, history.notDeployed.slice(0, 6).map((c) => el("li", {}, `${short(c.sha)} ${c.subject}`)),
            history.notDeployed.length > 6 ? el("li", {}, t("status.more", { n: history.notDeployed.length - 6 })) : null)
        : el("div", { class: "muted" }, history.notDeployedBase ? t("status.nothingSavedSince", { base: history.notDeployedBase }) : t("status.nothingSavedSinceDeploy")),
      history.notPushed ? el("div", { class: "muted" }, t("status.notPushed", { n: history.notPushed })) : null),
    el("div", { class: `card ${history.deployed ? "live" : "idle"}` },
      el("h3", {}, t("status.live")),
      history.deployed
        ? el("div", {}, `${short(history.deployed.sha)} ${history.deployed.subject}`, el("div", { class: "muted" }, t("status.deployedAt", { ago: ago(history.deployed.at) })))
        : el("div", { class: "muted" }, t("status.notDeployedYet")),
      history.deployed?.diverged ? el("div", { class: "muted" }, t("status.diverged")) : null),
  ];
  $("status").replaceChildren(...cards);
}

// The public site (ADMIN_SITE_URL), in a new tab.
function liveLink(key) {
  return el("a", { href: state.siteUrl, target: "_blank", rel: "noopener noreferrer" }, t(key));
}

function renderJob() {
  const job = state?.job;
  $("job").hidden = !job;
  if (!job) return;
  $("job").className = `job ${job.status}`;
  const name = label(`job.${job.kind}`, job.kind);
  $("job-title").textContent =
    job.status === "running" ? t("job.running", { name })
    : job.status === "succeeded" ? t("job.succeeded", { name, ago: ago(job.finishedAt) })
    : t("job.failed", { name, error: errorText({ code: job.errorCode, params: job.errorParams, message: job.error }) });
  $("job-step").textContent = job.status === "running" && job.step ? label(`step.${job.step.code}`, job.step.code, job.step.params) : "";
  const links = [];
  if (job.kind === "preview" && job.status === "succeeded") links.push(el("a", { href: previewUrl(), target: "isuzu-preview" }, t("common.openPreview")));
  if (job.kind === "deploy" && job.status === "succeeded") {
    links.push(liveLink("common.openLiveSite"), el("span", { class: "muted" }, t("job.liveDelay")));
  }
  $("job-links").replaceChildren(...links);
  if (job.status === "failed") showLog = true;
  $("job-log").hidden = !showLog;
  $("job-toggle").textContent = t(showLog ? "job.hideLog" : "job.showLog");
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
  const isNew = draft.added.includes(file);
  const last = gallery.length - 1;
  const moveTo = (to, key) => () => saveOrder(move(gallery, file, to), carousel, `${ref}:${key}`);
  return el("div", { class: `tile${isNew ? " new" : ""}${inCarousel ? " in-carousel" : ""}`, "data-id": file },
    el("img", { class: "thumb", src: thumb(ref), alt: file, loading: "lazy", draggable: "false" }),
    isNew ? el("span", { class: "badge" }, t("tile.new")) : null,
    isNew ? el("button", { type: "button", class: "remove", title: t("tile.remove", { file }), "aria-label": t("tile.remove", { file }), onclick: () => remove(file) }, "×") : null,
    el("div", { class: "meta" }, el("span", { class: "index" }, `${index + 1}`), el("a", { class: "name", href: image(ref), target: "_blank", title: file }, file)),
    el("div", { class: "controls" },
      starButton(ref, file, inCarousel ? "★" : "☆"),
      controlButton("⤒", t("tile.moveTop", { file }), moveTo(0, "top"), index === 0, `${ref}:top`),
      controlButton("‹", t("tile.moveEarlier", { file }), moveTo(index - 1, "up"), index === 0, `${ref}:up`),
      controlButton("›", t("tile.moveLater", { file }), moveTo(index + 1, "down"), index === last, `${ref}:down`)));
}

function slideTile(ref, index) {
  const { gallery, carousel } = state;
  const last = carousel.length - 1;
  const moveTo = (to, key) => () => saveOrder(gallery, move(carousel, ref, to), `slide:${ref}:${key}`);
  return el("div", { class: "tile", "data-id": ref },
    el("img", { class: "thumb", src: thumb(ref), alt: ref, loading: "lazy", draggable: "false" }),
    el("div", { class: "meta" }, el("span", { class: "index" }, `${index + 1}`), el("span", { class: "name", title: ref }, ref)),
    el("div", { class: "controls" },
      controlButton("‹", t("slide.moveEarlier", { ref }), moveTo(index - 1, "up"), index === 0, `slide:${ref}:up`),
      controlButton("›", t("slide.moveLater", { ref }), moveTo(index + 1, "down"), index === last, `slide:${ref}:down`),
      controlButton("✕", t("slide.remove", { ref }), () => toggleSlide(ref), false, `slide:${ref}:remove`)));
}

// ☆ / ★: adds the image to the carousel, or takes it out.
function starButton(ref, file, label) {
  const inCarousel = state.carousel.includes(ref);
  return el("button", {
    type: "button",
    class: "star",
    "aria-pressed": String(inCarousel),
    title: t(inCarousel ? "tile.removeFromCarousel" : "tile.addToCarousel"),
    "aria-label": t(inCarousel ? "tile.removeFromCarouselNamed" : "tile.addToCarouselNamed", { file }),
    onclick: () => toggleSlide(ref),
    "data-key": `${ref}:star`,
  }, label);
}

function extraTile(file) {
  const ref = `carousel/${file}`;
  const inCarousel = state.carousel.includes(ref);
  return el("div", { class: `tile${inCarousel ? " in-carousel" : ""}` },
    el("img", { class: "thumb", src: thumb(ref), alt: file, loading: "lazy" }),
    el("div", { class: "meta" }, el("a", { class: "name", href: image(ref), target: "_blank", title: file }, file)),
    el("div", { class: "controls" }, starButton(ref, file, t(inCarousel ? "tile.inCarousel" : "tile.notInCarousel"))));
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

const LANGS = ["ja", "en"];
const otherLang = (code) => (code === "ja" ? "en" : "ja");

async function saveSidebar(heading, order, focus, version) {
  pendingFocus = focus;
  const byId = new Map(state.sidebar.entries.map((entry) => [entry.id, entry]));
  state.sidebar = { heading, entries: order.map((id) => byId.get(id)) };
  render();
  await act(edit("PUT", "/api/sidebar", { heading, order }, version));
}

const sidebarOrder = () => state.sidebar.entries.map((entry) => entry.id);
const headingInputs = () => ({ ja: $("heading-ja").value, en: $("heading-en").value });

// code: the description's language, not the page's.
function description(entry, code) {
  const text = entry.description[code];
  return el("div", { class: "md-preview small" },
    el("span", { class: "lang" }, t(`lang.${code}`)),
    text.trim() ? renderMarkdown(text) : el("p", { class: "muted" }, t("entry.emptyLang", { other: t(`lang.${otherLang(code)}`) })));
}

function entryCard(entry, index) {
  const order = sidebarOrder();
  const moveTo = (to, key) => () => saveSidebar(state.sidebar.heading, move(order, entry.id, to), `entry:${entry.id}:${key}`);
  return el("div", { class: "entry", "data-id": entry.id },
    el("div", { class: "entry-handle", title: t("entry.dragToReorder") },
      el("img", { class: "entry-thumb", src: `/thumb/sidebar/${entry.id}?v=${encodeURIComponent(entry.image)}`, alt: "", draggable: "false" })),
    el("div", { class: "entry-body" },
      el("div", { class: "entry-meta" },
        el("span", { class: "index" }, `${index + 1}`),
        el("strong", {}, entry.id),
        entry.link
          ? el("a", { href: entry.link, target: "_blank", rel: "noopener noreferrer" }, entry.link)
          : el("span", { class: "muted" }, t("entry.noLink"))),
      el("div", { class: "entry-langs" }, description(entry, "ja"), description(entry, "en"))),
    el("div", { class: "entry-controls" },
      controlButton("⤒", t("entry.moveTop", { id: entry.id }), moveTo(0, "top"), index === 0, `entry:${entry.id}:top`),
      controlButton("↑", t("entry.moveUp", { id: entry.id }), moveTo(index - 1, "up"), index === 0, `entry:${entry.id}:up`),
      controlButton("↓", t("entry.moveDown", { id: entry.id }), moveTo(index + 1, "down"), index === order.length - 1, `entry:${entry.id}:down`),
      el("button", { type: "button", onclick: () => openEntry(entry), disabled: busy() }, t("entry.edit")),
      el("button", { type: "button", class: "danger", onclick: () => removeEntry(entry), disabled: busy() }, t("entry.remove"))));
}

function renderSidebar() {
  const { heading, entries } = state.sidebar;
  for (const code of LANGS) {
    const input = $(`heading-${code}`);
    if (document.activeElement !== input) input.value = heading[code];
  }
  $("entries").replaceChildren(...entries.map(entryCard));
  $("entries-empty").hidden = entries.length > 0;
}

async function removeEntry(entry) {
  if (!confirm(t("entry.confirmRemove", { id: entry.id }))) return;
  await act(edit("POST", "/api/sidebar/remove", { id: entry.id }), () => t("toast.removed", { name: entry.id }));
}

// The add / edit dialog. entryImage: a newly chosen File, if any.
let editing = null;
let editingVersion = null; // the draft version the edited entry was read at
let entryImage = null;

function setEntryImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return toast(() => t("toast.chooseImage"), true);
  entryImage = file;
  showEntryImage(URL.createObjectURL(file));
}

function showEntryImage(src) {
  const img = $("entry-image-preview");
  if (img.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
  img.hidden = !src;
  if (src) img.src = src;
  else img.removeAttribute("src");
  renderEntryImageHint();
}

function renderEntryImageHint() {
  $("entry-image-hint").replaceChildren(...rich($("entry-image-preview").hidden ? "entryDialog.imageHint" : "entryDialog.replaceHint"));
}

function updateEntryPreview() {
  const texts = { ja: $("entry-ja").value, en: $("entry-en").value };
  for (const code of LANGS) {
    const other = otherLang(code);
    const shown = texts[code].trim() ? texts[code] : texts[other];
    const note = !shown.trim() ? t("entryDialog.noDescription") : !texts[code].trim() ? t("entryDialog.showingOther", { other: t(`lang.${other}`) }) : null;
    $(`entry-${code}-preview`).replaceChildren(
      el("span", { class: "lang" }, t("entryDialog.sitePreview", { lang: t(`lang.${code}`) })),
      ...(note ? [el("p", { class: "muted" }, note)] : []),
      ...(shown.trim() ? [renderMarkdown(shown)] : []));
  }
  const link = $("entry-link").value.trim();
  const error = link && !validLink(link) ? t("entryDialog.linkInvalid") : "";
  $("entry-link-error").textContent = error;
  $("entry-link-error").hidden = !error;
  $("entry-link").setAttribute("aria-invalid", String(Boolean(error)));
}

function validLink(link) {
  try {
    const url = new URL(link);
    return (url.protocol === "https:" || url.protocol === "http:") && !/\s/.test(link);
  } catch {
    return false;
  }
}

function renderEntryTitle() {
  $("entry-title").textContent = editing ? t("entryDialog.editTitle", { id: editing.id }) : t("entryDialog.addTitle");
}

// error: an ApiError or a { code } of the client's own checks; null hides it.
let entryError = null;
function showEntryError(error) {
  entryError = error;
  $("entry-error").textContent = error ? errorText(error) : "";
  $("entry-error").hidden = !error;
}

function openEntry(entry = null) {
  editing = entry;
  // After the edits already queued: the entry shown includes them.
  editingVersion = edits.then(() => state.version);
  entryImage = null;
  renderEntryTitle();
  $("entry-link").value = entry?.link ?? "";
  $("entry-ja").value = entry?.description.ja ?? "";
  $("entry-en").value = entry?.description.en ?? "";
  showEntryError(null);
  showEntryImage(entry ? `/thumb/sidebar/${entry.id}?v=${encodeURIComponent(entry.image)}` : null);
  updateEntryPreview();
  showModal($("entry-dialog"));
}

let submitting = false;
async function submitEntry(event) {
  event.preventDefault();
  if (submitting) return;
  const link = $("entry-link").value.trim();
  const fail = (error) => showEntryError(error);
  showEntryError(null);
  // The field's own message already says what is wrong.
  if (link && !validLink(link)) return $("entry-link").focus();
  if (!editing && !entryImage) return fail({ code: "entry-needs-image" });
  // Everything is read before waiting for queued edits: the dialog may be
  // closed and reopened on another entry meanwhile.
  submitting = true;
  $("entry-submit").disabled = true;
  const entry = { id: editing?.id, link, description: { ja: $("entry-ja").value, en: $("entry-en").value } };
  const image = entryImage;
  const isEdit = Boolean(editing);
  try {
    entry.version = await editingVersion;
    const form = new FormData();
    form.append("entry", JSON.stringify(entry));
    if (image) form.append("image", image, image.name);
    const data = await queue(() => api("POST", "/api/sidebar/entry", form));
    $("entry-dialog").close();
    toast(() => t(isEdit ? "toast.entryUpdated" : "toast.entryAdded", { id: data.saved.id }));
    await refresh();
  } catch (error) {
    fail(error);
  } finally {
    submitting = false;
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
// A heading is based on the version it was focused at (after this tab's
// queued edits): a refresh while typing keeps the typed text on screen, and
// must not let it overwrite another tab's newer heading.
let headingVersion;
for (const code of LANGS) {
  $(`heading-${code}`).addEventListener("focus", () => (headingVersion = edits.then(() => state.version)));
  $(`heading-${code}`).addEventListener("change", () => saveSidebar(headingInputs(), sidebarOrder(), undefined, headingVersion));
}

// ---- Actions ---------------------------------------------------------------

async function remove(file) {
  if (!confirm(t("confirm.removeUpload", { file }))) return;
  await act(edit("POST", "/api/remove", { file }), () => t("toast.removed", { name: file }));
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
  // A reopened dialog keeps its last returnValue, and Esc doesn't reset it
  // everywhere (Firefox): without this, Esc could save.
  $("save-dialog").returnValue = "";
  showModal($("save-dialog"));
}

$("save-dialog").addEventListener("close", () => {
  if ($("save-dialog").returnValue !== "save") return;
  act(api("POST", "/api/save", { message: $("save-message").value }));
});

function deploy() {
  renderDeploy();
  $("deploy-confirm").disabled = state.draft.dirty;
  $("deploy-dialog").returnValue = ""; // see save()
  showModal($("deploy-dialog"));
}

// What the dialog shows is fixed when it opens (the state may refresh behind
// it); a language switch only redraws the same content.
let deployShown = null;
function renderDeploy(again = false) {
  if (!again) deployShown = { dirty: state.draft.dirty, commits: state.history.notDeployed, command: state.deployCommand };
  const { dirty, commits, command } = deployShown;
  $("deploy-body").replaceChildren(
    ...(dirty ? [el("p", { class: "banner error" }, t("deployDialog.unsaved"))] : []),
    commits.length
      ? el("div", {}, el("p", {}, t("deployDialog.commits")), el("ul", {}, commits.map((c) => el("li", {}, `${short(c.sha)} ${c.subject}`))))
      : el("p", {}, t("deployDialog.nothingNew")),
    el("p", { class: "muted" }, ...rich("deployDialog.steps", { command }))
  );
}

$("deploy-dialog").addEventListener("close", () => {
  if ($("deploy-dialog").returnValue === "deploy") act(api("POST", "/api/deploy"));
});

function discard() {
  if (!confirm(t("confirm.discard"))) return;
  act(edit("POST", "/api/discard", {}), () => t("toast.discarded"));
}

// ---- Language --------------------------------------------------------------

// A modal dialog makes the rest of the page inert: the 日本語 / EN toggle
// goes along into it (last, so the dialog still focuses its own first
// field), and back to the header when it closes.
const langToggle = document.querySelector(".lang-toggle");
function showModal(dialog) {
  dialog.append(langToggle);
  dialog.showModal();
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("close", () => document.querySelector(".top").append(langToggle));
}

// Redraws every text in place: the draft, dialogs and a running job are
// untouched (the log is raw output and stays as it is).
function renderLang() {
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  translatePage();
  renderToast();
  renderEntryImageHint();
  if ($("entry-dialog").open) {
    renderEntryTitle();
    updateEntryPreview();
    showEntryError(entryError);
  }
  if ($("deploy-dialog").open) renderDeploy(true);
  if (state) render();
  else renderJob();
}

for (const button of document.querySelectorAll("[data-lang]")) button.addEventListener("click", () => setLang(button.dataset.lang));
onLangChange(renderLang);
renderLang();

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
  if (busy()) return toast(() => (state.busy ? errorText({ code: "busy", params: { kind: state.busy }, message: state.busy }) : t("toast.workspaceUnavailable")), true);
  upload(e.dataTransfer.files);
});

// Drag to reorder, with touch: a short press starts a drag so the page still scrolls.
const sortables = [];
function sortable(container, onSort, options = {}) {
  sortables.push(
    window.Sortable.create(container, {
      ...options,
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
  // Entries are mostly text and links: drag them by the image.
  sortable($("entries"), (order) => saveSidebar(state.sidebar.heading, order), { handle: ".entry-handle" });
  refresh();
  events();
  setInterval(() => state && renderStatus(), 60000); // keep the "… ago" labels fresh
});
