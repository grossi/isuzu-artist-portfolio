# isuZu admin console

A small web app, reachable only on the tailnet, for managing the site's content without a PR:

- **Gallery**: add illustrations (drag and drop or the file picker, several at once) and
  reorder them, by drag (mouse or touch) or with the ⤒ ‹ › buttons.
- **Carousel**: choose the slides and their order, from the carousel-only images in
  `public/carousel/` or any gallery image.
- **Sidebar**: the box under the profile (著書 / My Books). Add, edit, reorder and remove
  entries (an image, an optional link, a ja/en markdown description), and edit its heading.
  Under each entry, its **previous editions** (過去バージョン): older editions of the book,
  shown on the site as a small cover, an edition label and a title, the whole row a link.
  Add (a cover, the ja/en edition label and title, a link), edit, reorder and remove them.
  **Move the current edition here…** fills one in from the book itself; **Next** opens the
  book for the new edition's cover, link and description, and **Save to draft** there saves
  both, against the draft as it was when the move began (cancelling before that saves nothing).
- **Preview** the real site built from the draft, then **Save** (commit) and **Deploy**.
- **Update from main**: take in what was merged on GitHub (code PRs) and rebuild the preview,
  so a merged change can be seen before it goes live. The 「GitHub の main」 card says what
  main has that the admin doesn't yet.

It is a plain Node server (`server.js`, `lib/`) with a build-free frontend (`public/`). It
has its own `package.json` and is outside the site's bundle, `tsc` and lint scope.

## Languages (日本語 / EN)

The header has a "日本語 / EN" toggle, like the site's. The choice is saved in
`localStorage`; a first visit follows the browser's languages and falls back to Japanese.
Switching redraws the page in place: the draft, open dialogs and a running job are untouched.

- Every string lives in `public/i18n/ja.js` and `public/i18n/en.js`, with the same keys and
  `{placeholders}` (`yarn test` checks, and that every key the page and the server use
  exists). Static markup names its key in `data-i18n` (or `data-i18n-title`,
  `-aria-label`, `-placeholder`); `` `text` `` in a string is shown as code.
- The server never sends prose the page has to show: errors are a stable code and its
  parameters (`{ error, code, params }`, `error.<code>` in the tables; `error` is the
  English text, the fallback for an unknown code). A job's failure (`errorCode`,
  `errorParams`) and its current step (`step`) work the same way.
- The live-site links (header, and after a successful deploy) open `ADMIN_SITE_URL` in a new
  tab with `rel="noopener noreferrer"`; the admin's address is never sent as a referrer. The
  CSP needs no change: it restricts what the page loads, not where links go.
- The preview port's "building" page follows the admin's choice through a cookie (cookies
  are shared across the ports of one host), else the browser's `Accept-Language`.
- Not translated: the raw build and deploy log, and the commit messages Save writes (the
  git history stays in English).

## How it works

The admin edits its **own clone** of the repo (the *workspace*, `~/isuzu-admin/workspace`),
always on `main`. It never touches another checkout.

| Step | What happens |
| --- | --- |
| **Draft** | Uploads, reorders, carousel and sidebar changes (previous editions included) edit the workspace's files right away: `public/gallery/`, `public/sidebar/`, `src/image-order.json`, `src/sidebar-content.json`. **Discard draft** runs `git reset --hard` and `git clean -d` (ignored files such as `node_modules/` and the webp derivatives stay). |
| **Preview** | `yarn install`, `yarn build-images` and `vite build` of the draft into the state dir, swapped in when the build succeeds. The preview server (second port) serves that build as the real site, with the same SPA fallback as CloudFront. The tab shows a "building" page and reloads itself until the build is done. |
| **Save** | `yarn build-images` (to regenerate `src/*.json`), then a commit on `main` of the content paths only: the originals, the two source files and the generated manifests. The `small/`/`large/` derivatives are gitignored and never committed. |
| **Deploy** | Refuses while anything in the workspace is unsaved. Then `git fetch`, `git rebase origin/main` if `main` moved (and regenerates and commits the manifests if they changed), `git push origin HEAD:main` (never forced), and the deploy command (`yarn deploy`: the full `yarn build`, then `scripts/push-s3.sh`). The log streams to the page. |
| **Update from main** | Refuses while anything in the workspace is unsaved. Then `git fetch`, `git rebase origin/main` (the saved, unpushed commits stay on top), regenerates and commits the manifests as Deploy does, and rebuilds the preview. It **never pushes**: only Deploy does. With nothing new on main it does nothing. |

Content commits go straight to `main` on GitHub, by design: no PR.

A rebase conflict aborts the rebase and stops: nothing is pushed or deployed and the saved
commits are unchanged. It only happens if a commit on `main` changed the same content files.
To recover, in the workspace: `git rebase origin/main`, resolve, `yarn build-images`,
`git add` the manifests, `git rebase --continue`, then press Deploy again. A rejected push
(someone pushed meanwhile) deploys nothing either; pressing Deploy again fetches and rebases.

Update from main handles conflicts the same way (manifest-only conflicts take main's version
and are regenerated; any other conflict aborts), and goes further when something fails: a
failed regeneration after the rebase resets the workspace to where it was, so a failed update
leaves the saved commits and files as they were (ignored files such as `node_modules/` may be
newer; every job redoes them) and nothing is pushed. If even the abort or the reset fails, the
page says so: a rebase left in progress shows the usual banner (Discard or a restart aborts it),
and a failed reset names the commit the workspace was at: in the workspace,
`git reset --hard <that commit>` then `git clean -d --force` puts it back (Discard draft would
only reset to the rebased commit). Only a
failed preview build keeps the update (the message says so): the workspace is updated and the
old preview stays, marked out of date. A conflict that keeps coming back is resolved by hand
as above, then Update again.

**One global lock** covers every edit, build, save and deploy. A second operation while one
runs gets "Busy" (HTTP 409) instead of waiting, and the UI disables its buttons. Every edit
also carries the draft version it was based on, so a stale browser tab can't overwrite newer
changes.

The status cards show the **draft** (unsaved changes, and whether the preview is up to date),
commits **saved but not deployed** (since the last deploy from this admin; before the first
one, since `origin/main`), what is **live**: the last commit this admin deployed (a deploy
run from another checkout isn't known to the admin), and **GitHub's main**: the commits on
`origin/main` the workspace doesn't have, one line per merged PR (its title) or other commit
(its subject), with the Update button and when main was last checked. The admin fetches main
every 10 minutes, when a page loads and on 「今すぐ確認 / Check now」, in the background and
outside the lock (one fetch at a time, none while a job runs), so it never holds up an edit.

## Data formats

**`src/image-order.json`** (gallery order and carousel slides, read by `src/utils/imageOrder.js`):

```json
{
  "gallery": ["new-piece.png", "10000.png"],
  "carousel": ["gallery/new-piece.png", "carousel/2024.png"],
  "carouselFocus": { "carousel/2024.png": 50 }
}
```

Listed gallery files come first, in that order, then any unlisted ones in byte order, so a
file added by hand still shows up. `carousel` is the complete list of slides. Without the
file, the build behaves as before, and `src/gallery.json` and `src/carousel.json` are
byte-identical.

`carouselFocus` (optional) is where each slide's picture is cut when a wide screen cuts its
top and bottom: a whole number from 0 (keep the top) to 100 (keep the bottom). The admin's
「位置 / Position」 menu offers 15, 30 and 50, and only stores slides set away from the
default, 30 (`DEFAULT_FOCUS_Y`). A slide taken out of the carousel forgets its position.
The build writes each slide's value into `src/carousel.json` as `focusY`. A key that isn't
`carousel/<file>` or `gallery/<file>`, or a value that isn't a whole number from 0 to 100,
stops the build and the admin with an error.

Gallery images used as slides are **referenced** (`gallery/<file>`), not copied. The
carousel then uses the gallery's own `large/` derivative: no duplicate originals in git, no
duplicate uploads to S3, and no second copy to keep in sync or forget when a slide is removed.

**`src/sidebar-content.json`** (read by `src/utils/sidebar.js`; the build generates
`src/sidebar.json`):

```json
{
  "heading": { "ja": "著書", "en": "My Books" },
  "entries": [
    { "id": "new-book", "image": "sidebar/new-book.png", "link": "https://…", "description": { "ja": "…", "en": "" } },
    {
      "id": "isuzubook", "image": "isuzubook.webp", "link": null, "description": { "ja": "…", "en": "…" },
      "previousEditions": [
        {
          "id": "clip-studio-paint-pro-2018", "image": "isuzubook-2018.jpg", "link": "https://…",
          "title": { "ja": "…", "en": "…" }, "edition": { "ja": "2018年版", "en": "2018 edition" }
        }
      ]
    }
  ]
}
```

Images uploaded in the admin go to `public/sidebar/`. The build ships a webp of at most
800 px wide (`public/sidebar/large/`), never the source file. The three original covers are
hand-made 600 px webps directly in `public/`, so they are referenced in place and shipped as
they are (`isuzubook.webp` is also used by the History page). `link: null` means the image
is not a link. An empty language falls back to the other one, and an entry with no text at
all shows only its image. Removing an entry deletes its `public/sidebar/` image, which stays
in the git history.

The home page styles a description in three parts, so write it in this shape: a one-line
lead-in (shown small and grey), the book title in bold (`**…**`, shown as the heading; two
bold parts side by side, `**first line** **second line**`, put the title on two lines), and
the shop links as a list (shown in a row, each with ↗):

```markdown
私が書いた色塗りの本です。

**色塗りワークショップ～塗りながら、楽しく学べる知識・コツ・考え方**

- [Amazon](https://…)
- [その他の購入先](https://…)
```

`previousEditions` (optional, left out when empty) belong to their entry, so removing the
entry removes them too and none can be left pointing at a book that is gone. New ones go
first; their ids are unique in the whole file. The link is required (http(s), checked by the
server and the build), and the title and the edition label each need one language, the other
one falling back to it like the descriptions. Their covers are uploaded like entry images
(same checks, same metadata stripping, into `public/sidebar/`), and the build ships a webp
that fits 120×168 px (`public/sidebar/small/`; the site draws the cover 52 px wide, so this is over twice that).
The 2018 cover (`isuzubook-2018.jpg`) is, like the book covers, a web-ready file directly in
`public/`, shipped as it is. An edition's image is deleted with it only when nothing else
uses it.

## Network and security

- The server binds **only to `127.0.0.1`** (the admin on 8970, the preview on 8972).
  `tailscale serve` publishes them over HTTPS to the tailnet only, never through Funnel:
  - admin: `https://<machine>.<tailnet>.ts.net:8971/`
  - preview: `https://<machine>.<tailnet>.ts.net:8973/`

  (`tailscale status --json | jq -r .Self.DNSName` prints this machine's name.)

  `tailscale serve` was chosen over binding to the tailnet IP because it gives HTTPS with a
  real certificate, and the server stays off every network interface. The tailscale
  operator on this machine is already `rossi`, so no `sudo` is needed. `ADMIN_HOST` refuses
  anything but loopback or a Tailscale address (100.64.0.0/10, fd7a:115c:a1e0::/48), so a
  typo can't expose it on `0.0.0.0` or the LAN.
- Requests with an unknown `Host` header are refused (a DNS-rebinding guard). Every
  state-changing request needs an `X-Isuzu-Admin: 1` header and a same-origin `Origin`, so
  a web page on another site can't trigger an edit or a deploy.
- Uploads: JPEG/PNG/WebP only, detected from the content by sharp, not from the name or the
  MIME type. At most 40 MB per file and 20 files per upload. Names become ASCII slugs with an
  extension from the detected format, made unique, so there are no path separators, dot
  files or overwrites. Image URLs only serve files listed in their folder.
- Uploads lose their metadata before they reach the workspace (`lib/metadata.js`). The
  originals are committed to a public repo and shipped next to their webp derivatives, so
  only what draws the image stays: the image data, its colour profile and a WebP's
  animation (an animated PNG keeps its still image). EXIF (a phone photo's location, the
  camera, dates), XMP, IPTC/Photoshop blocks, thumbnails, comments, text chunks, content
  credentials and unknown blocks go. They are cut out of the file, so the pixels are
  untouched; only a still image that EXIF rotates is re-encoded with the rotation applied
  (an animation keeps its frames and loses the tag). What can't go without a re-encode is
  free-form text inside the colour profile or bytes hidden in the compressed image data:
  no camera or editor writes metadata there.
- The site's build refuses any symlink in `public/`, `src/` or `index.html`
  (`src/utils/symlinks.js`): it would copy the target, wherever it points, and the deploy
  would publish it.
- Git and the deploy run without a shell (`execFile`/`spawn` with argument lists). Commit
  messages and file names are passed as arguments, and git never prompts.
- Markdown (sidebar descriptions) is rendered with raw HTML disabled and an allowlist of
  URL schemes (http, https, mailto, relative), on the site (`components/molecules/Markdown`)
  and in the admin's live preview (`public/markdown.js`, the same markdown-to-jsx parser
  with an inert DOM builder). Sidebar links must be full http(s) URLs.

## Install (systemd user service)

After the admin is merged into `main`:

```bash
git clone https://github.com/grossi/isuzu-artist-portfolio.git ~/isuzu-admin/workspace
~/isuzu-admin/workspace/admin/install-service.sh
```

The script (safe to re-run) clones the workspace if it's missing, runs `yarn install` for the
site and the admin, writes `~/.config/isuzu-admin/env` (kept if it exists), installs and
starts `~/.config/systemd/user/isuzu-admin.service`, and runs the two `tailscale serve`
commands (`--no-serve` skips them). Lingering is already enabled for `rossi`
(`loginctl show-user rossi -p Linger`), so the service runs without a login session.

The workspace clone uses HTTPS. Pushes authenticate through the `gh auth git-credential`
helper in `~/.gitconfig`, and the deploy uses the AWS credentials in `~/.aws`.

```bash
systemctl --user status isuzu-admin      # state
journalctl --user -u isuzu-admin -f      # logs
systemctl --user restart isuzu-admin     # after editing the env file or pulling admin changes
```

The service runs the admin code from the workspace itself, so a deploy or an Update from main
that brings a newer `admin/` takes effect on the next restart; the page then shows a banner
(the admin never restarts itself). If `admin/package.json` or `admin/yarn.lock` changed too,
the banner says so: run `yarn --cwd ~/isuzu-admin/workspace/admin install --frozen-lockfile`
first.

### Settings (`~/.config/isuzu-admin/env`)

| Variable | Default | |
| --- | --- | --- |
| `ADMIN_WORKSPACE` | `~/isuzu-admin/workspace` | the clone the admin edits |
| `ADMIN_STATE_DIR` | `~/isuzu-admin/state` | preview build, thumbnails, upload spool, `deployed.json` |
| `ADMIN_HOST` | `127.0.0.1` | loopback or a tailnet address only |
| `ADMIN_PORT` / `ADMIN_PREVIEW_PORT` | `8970` / `8972` | |
| `ADMIN_PREVIEW_URL` | same host, preview port | where the browser opens the preview |
| `ADMIN_TAILNET_NAME`, `ADMIN_ALLOWED_HOSTS` | | extra accepted `Host` names |
| `ADMIN_SITE_URL` | `https://isuzu.work/` | the public site: the header's "View live site" link and the one after a deploy. `http(s)` only (the server refuses to start otherwise). An existing env file needs no change |
| `ADMIN_DEPLOY_CMD` | `yarn deploy` | split on spaces, run without a shell in the workspace |

## Development and tests

```bash
cd admin && yarn install --frozen-lockfile
yarn test   # unit tests, plus git flows against temporary repos with a bare "GitHub" origin
```

To try it end to end without touching GitHub or S3, use a throwaway workspace whose origin is a
local bare repo, and a stub deploy:

```bash
git init --bare /tmp/admin-test/origin.git
git push /tmp/admin-test/origin.git HEAD:refs/heads/main
git clone /tmp/admin-test/origin.git /tmp/admin-test/workspace
(cd /tmp/admin-test/workspace && yarn install --frozen-lockfile)
printf 'set -e\nyarn build\nbash scripts/push-s3.sh --dryrun\n' > /tmp/admin-test/deploy.sh
ADMIN_WORKSPACE=/tmp/admin-test/workspace ADMIN_STATE_DIR=/tmp/admin-test/state \
  ADMIN_DEPLOY_CMD="bash /tmp/admin-test/deploy.sh" node server.js
```
