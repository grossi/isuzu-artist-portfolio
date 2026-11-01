# Security

This repository is the source of [isuzu.work](https://isuzu.work), a static portfolio site,
and of a small admin console that is only reachable on a private network (`admin/`).

## Reporting a vulnerability

Please report it privately: open the repository's **Security** tab and choose
**Report a vulnerability**. Don't open a public issue or pull request for it.

## What not to commit

The repository is public, and so is everything in its history.

- No credentials: AWS keys, GitHub, Vercel or other tokens, `.env` files. Deploys read
  them from the deploying machine (`~/.aws`), never from the repo.
- No private hostnames or addresses (tailnet names, `100.x` IPs); docs use placeholders.
- No personal data beyond what the site itself shows.
- No symlinks in `public/`, `src/` or `index.html`: the build would copy their target into
  the published site, so `yarn build-images` refuses them (`src/utils/symlinks.js`).
- Images: the admin console strips EXIF/XMP/IPTC from uploads (`admin/lib/metadata.js`).
  An image added by hand under `public/` is committed and shipped exactly as it is, so
  check a photo for location data first (`exiftool -gps:all <file>`).
