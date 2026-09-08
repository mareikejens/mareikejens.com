# mareikejens.com

Personal landing page for Mareike Jens. Live at:

- https://mareikejens.com
- https://mareikejens.ai

## Stack

Static HTML + a single React component (transpiled in-browser via Babel standalone). No build step, no dependencies to install. Hosted on GitHub Pages.

## Structure

```
index.html         # the entire page (head metadata + static shell + React app)
assets/            # images
  mareike-cover.jpg
  mareike-pink.jpg
  plumAI-icon.png
imprint.html       # Impressum
privacy.html       # privacy notice
robots.txt         # allows all crawlers, points to the sitemap
sitemap.xml        # the three pages above, with lastmod dates
CNAME              # tells GitHub Pages which custom domain to serve
```

## Editing

1. Open `index.html` in your editor.
2. Reload the file in your browser to preview locally.
3. Commit and push when happy — GitHub Pages redeploys automatically within ~1 minute.

## Search engines and link previews

The React app is transpiled in the browser, so without JavaScript the page would be
empty. Three things in `index.html` keep it visible to crawlers and consistent:

- **Static shell.** The plain HTML inside `<div id="root">` is what crawlers and
  no-JS visitors see; React replaces it on mount. If you change the hero copy,
  change the shell copy too.
- **Structured data + identity links.** The `application/ld+json` block describes
  Mareike as a `Person` and lists the profiles that belong to her (`sameAs`); the
  `rel="me"` links do the same for browsers. The same URLs live in the JSX
  constants (`SUBSTACK_URL`, `LINKEDIN_URL`, `GITHUB_URL`) used by nav, hero,
  about and footer. When a profile URL changes, update all three places.
- **Production React builds.** `react.production.min.js` and
  `react-dom.production.min.js` (about 140 KB) instead of the development builds
  (about 1.2 MB). Their `integrity` hashes were computed from the npm 18.3.1
  tarballs. For readable error messages while debugging, temporarily switch to
  `react.development.js` (`sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L`)
  and `react-dom.development.js` (`sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm`).

After a deploy that changes content, bump `<lastmod>` in `sitemap.xml` and the
`dateModified` in the JSON-LD block. Search Console property and the wider
plan live in the `mareikejens-branding` repo, `SEO.md`.

## Deploy

Pushing to `main` is the deploy. GitHub Pages is configured to serve from the root of `main`.
