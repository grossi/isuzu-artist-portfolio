# isuZu admin console

A small web app, reachable only on the tailnet, for managing the site's content without a PR:

- **Gallery**: add illustrations (drag and drop or the file picker, several at once) and
  reorder them, by drag (mouse or touch) or with the ⤒ ‹ › buttons.
- **Carousel**: choose the slides and their order, from the carousel-only images in
  `public/carousel/` or any gallery image.
- **Sidebar**: the box under the profile (著書 / My Books). Add, edit, reorder and remove
  entries (an image, an optional link, a ja/en markdown description), and edit its heading.
- **Preview** the real site built from the draft, then **Save** (commit) and **Deploy**.

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
| **Draft** | Uploads, reorders, carousel and sidebar changes edit the workspace's files right away: `public/gallery/`, `public/sidebar/`, `src/image-order.json`, `src/sidebar-content.json`. **Discard draft** runs `git reset --hard` and `git clean -d` (ignored files such as `node_modules/` and the webp derivatives stay). |
| **Preview** | `yarn install`, `yarn build-images` and `vite build` of the draft into the state dir, swapped in when the build succeeds. The preview server (second port) serves that build as the real site, with the same SPA fallback as CloudFront. The tab shows a "building" page and reloads itself until the build is done. |
| **Save** | `yarn build-images` (to regenerate `src/*.json`), then a commit on `main` of the content paths only: the originals, the two source files and the generated manifests. The `small/`/`large/` derivatives are gitignored and never committed. |
| **Deploy** | Refuses while anything in the workspace is unsaved. Then `git fetch`, `git rebase origin/main` if `main` moved (and regenerates and commits the manifests if they changed), `git push origin HEAD:main` (never forced), and the deploy command (`yarn deploy`: the full `yarn build`, then `scripts/push-s3.sh`). The log streams to the page. |

Content commits go straight to `main` on GitHub, by design: no PR.

A rebase conflict aborts the rebase and stops: nothing is pushed or deployed and the saved
commits are unchanged. It only happens if a commit on `main` changed the same content files.
To recover, in the workspace: `git rebase origin/main`, resolve, `yarn build-images`,
`git add` the manifests, `git rebase --continue`, then press Deploy again. A rejected push
(someone pushed meanwhile) deploys nothing either; pressing Deploy again fetches and rebases.

**One global lock** covers every edit, build, save and deploy. A second operation while one
runs gets "Busy" (HTTP 409) instead of waiting, and the UI disables its buttons. Every edit
also carries the draft version it was based on, so a stale browser tab can't overwrite newer
changes.

The status cards show the **draft** (unsaved changes, and whether the preview is up to date),
commits **saved but not deployed** (since the last deploy from this admin; before the first
one, since `origin/main`), and what is **live**: the last commit this admin deployed. A deploy
run from another checkout isn't known to the admin.

## Data formats

**`src/image-order.json`** (gallery order and carousel slides, read by `src/utils/imageOrder.js`):

```json
{
  "gallery": ["new-piece.png", "10000.png"],
  "carousel": ["gallery/new-piece.png", "carousel/2024.png"]
}
```

Listed gallery files come first, in that order, then any unlisted ones in byte order, so a
file added by hand still shows up. `carousel` is the complete list of slides. Without the
file, the build behaves as before, and `src/gallery.json` and `src/carousel.json` are
byte-identical.

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
    { "id": "isuzubook", "image": "isuzubook.webp", "link": null, "description": { "ja": "…", "en": "…" } }
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

## Network and security

- The server binds **only to `127.0.0.1`** (the admin on 8970, the preview on 8972).
  `tailscale serve` publishes them over HTTPS to the tailnet only, never through Funnel:
  - admin: `https://rossi-linux-server-storage.tail41bd82.ts.net:8971/`
  - preview: `https://rossi-linux-server-storage.tail41bd82.ts.net:8973/`

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

The service runs the admin code from the workspace itself, so a deploy that brings a newer
`admin/` from `main` takes effect on the next restart. If `admin/package.json` changed, run
`yarn --cwd ~/isuzu-admin/workspace/admin install --frozen-lockfile` first.

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
