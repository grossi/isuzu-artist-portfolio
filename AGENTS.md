# AGENTS.md

This is isuZu's personal website, [isuzu.work](https://isuzu.work). isuZu is an illustrator. The site shows her artwork and her books and links to her social accounts. It's what she shows potential clients, so it should look polished on phones and desktops.

The site is bilingual. Japanese comes first, and English is a faithful copy: the Japanese CV and profile text is the source.

## How changes reach the site

Most changes are content: new artwork, the gallery and carousel order, and the 著書 / My Books sidebar. These are made in the admin dashboard (`admin/`, see `admin/README.md`), which commits straight to `main` and deploys the site to S3 and CloudFront. That's why `main` gets `content: …` commits on its own.

Everything else (design, layout, text, code) comes as a pull request against `main`. grossi reviews and merges it, then deploys, usually with the admin dashboard's Deploy button. A pull request doesn't need to deploy anything: Vercel builds a preview for each one.

## Worth knowing

- The project uses Yarn classic (1.x) and Node 22.13+ or 24. `CI=true yarn build` is the check (tsc, ESLint with zero warnings, Vite). There are no tests.
- When images change, run `yarn build-images` and commit the regenerated `src/*.json`. The WebP folders are build output. If those files conflict with an admin commit on `main`, rebase and rerun `yarn build-images` rather than merging them by hand.
- The Work and CV pages aren't finished, so `showSectionLinks` in the header keeps their links hidden. Leave it that way unless asked.
- Sidebar text is written in the admin dashboard, so the Markdown component deliberately never renders raw HTML. It only allows http(s), mailto and relative links.
- Deep links such as `/work` work because CloudFront, and `vercel.json` on previews, serve `index.html` for unknown paths.
