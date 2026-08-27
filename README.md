# Ebmeyer Consulting — Website

Astro static site. German + English. Zero JavaScript framework, no CMS lock-in.

Current build: **~37 KB HTML+CSS per page, 0 KB JS bundles.**

---

## 1. Getting started (VS Code)

```bash
npm install
npm run dev      # http://localhost:4321  → redirects to /de/
```

Other commands:

```bash
npm run build    # static output into dist/
npm run preview  # serve dist/ locally, exactly as production
npm run check    # TypeScript + Astro diagnostics
```

**Requires Node 20 or newer.** Check with `node -v`.

### VS Code extensions

| Extension | ID | Why |
|---|---|---|
| Astro | `astro-build.astro-vscode` | `.astro` syntax, IntelliSense, formatting |
| Prettier | `esbenp.prettier-vscode` | consistent formatting |
| Error Lens | `usernamehw.errorlens` | inline errors, catches typos fast |

Run once so Prettier understands `.astro`:

```bash
npm i -D prettier prettier-plugin-astro
```

---

## 2. Where things live

```
src/
  data/
    de.json          ← ALL German copy
    en.json          ← ALL English copy
    site.json        ← Calendly link, email, phone, domain
  components/        ← one file per page section
  layouts/Base.astro ← <head>, SEO, hreflang, fonts
  pages/
    index.astro      ← language redirect
    de/index.astro   ← German homepage
    en/index.astro   ← English homepage
  styles/tokens.css  ← the entire design system
public/fonts/        ← self-hosted Fraunces + Hanken Grotesk (woff2)
```

**To change text, edit the JSON — never the components.** This is what makes
the CMS work later: Sveltia/Decap points at these same files.

---

## 3. The design system

Everything lives in `src/styles/tokens.css`. Nothing is hard-coded in components.

```css
--ink:     #241B21   /* dark aubergine */
--magenta: #C52562   /* CTAs and eyebrows only */
--gold:    #B68A4E   /* hairlines, numerals, accents */
--paper:   #FAF6F1   /* page background */
--deep:    #1B1317   /* dark sections */
--warm:    #F2E9DD   /* alternate light band */
```

### Switching to pure white

One line in `tokens.css`:

```css
--paper: #FFFFFF;
--warm:  #F6F1E9;
```

### Two details that matter

**Fraunces optical sizes.** The display cut (`opsz 144`) is beautiful but its
flat-topped `3` reads as a `5` at small sizes — "30 Min" looked like "50 Min".
All numerals therefore use `.num`, which switches to `opsz 24`:

```css
.num { font-variation-settings: var(--fv-text); }
```

**German compound words.** `Unternehmensbeschreibung` will break a naive layout.
Headings use `hyphens: auto` + `overflow-wrap: break-word`, and every font size
is `clamp()`-based so nothing overflows at any viewport.

---

## 4. Routes (all built)

```
/                              language redirect
/de/            /en/           homepage
/de/souveraen-mit-ki/          /en/confident-with-ai/
/de/souveraen-gruenden/        /en/founding-with-confidence/
/de/impressum/                 /en/imprint/
/de/datenschutz/               /en/privacy/
```

### How the programme pages work

All four run through **one** template, `src/layouts/ProgramPage.astro`.
The content lives in `src/data/programs/`:

```
de-mit-ki.json    en-mit-ki.json
de-gruenden.json  en-gruenden.json
```

Each page file is three lines — it just picks a data file. So a third
programme later means one JSON file plus a three-line page, no new components.

Sections, in order: hero → pain → cost of inaction → approach → who it's for →
the journey → one block per phase → outcome → bio → CTA → footer.
All lifted from her brochures, **without the CHF prices**.

---

## 5. Deploying

### Vercel (recommended)

1. Push to GitHub.
2. Import the repo in Vercel — it auto-detects Astro. No configuration needed.
3. Add `ebmeyer-consulting.ch` under Project → Domains.
4. At the registrar, set the two DNS records Vercel shows you.

Every push to `main` redeploys. Every pull request gets a preview URL — useful
for showing Nadine changes before they go live.

### Hostpoint / any FTP host

```bash
npm run build
# upload the contents of dist/ to the web root
```

Works identically. You lose auto-deploy and preview URLs.

---

## 6. Adding the `/admin` panel later

Sveltia CMS is git-backed — no database, no monthly cost. It reads and writes
the same `src/data/*.json` files.

The one wrinkle: it needs a GitHub OAuth handler. Vercel doesn't provide one
out of the box; a small serverless function or Cloudflare Worker covers it
(about 30 minutes, once).

**Give Nadine structured fields, not a free-text editor.** Field-by-field with
character hints means she can't paste 400 words into a 40-word slot and break
the layout.

---

## 7. Client revision round — 24 Aug (all applied)

| Nadine asked | Done |
|---|---|
| Hero: portrait large in the background (Option B) | Full-bleed dark hero; header floats over it, solidifies on scroll |
| Programme headers look empty — add photo 6380 / 6377 | Portrait added. **Placeholder** — swap in 6380/6377 when supplied |
| "Rechnung" was split across lines | Auto-hyphenation removed site-wide (`hyphens: manual`) |
| "Künstliche Intelligenz" must not split | Wrapped in `.nowrap` |
| Stats numbers looked left-aligned | Value and label both hard-centred |
| Footer logo needs the EC monogram, as in the header | New light-on-dark horizontal lockup |
| Photo cuts off the top of her head | Re-cropped with headroom + focal point at 22% |
| Favicon hard to read | Rebuilt from her real EC monogram, bolder strokes |

### Logos — now true vector (26 Aug)

Nadine supplied `Asset_21.svg` and `Asset_25.svg`. All raster logos are gone.

```
public/logo/horizontal.svg        header on light backgrounds
public/logo/horizontal-light.svg  footer + header over the dark hero
public/logo/mark.svg              EC monogram alone, gold
public/logo/mark-light.svg        EC monogram alone, cream
```

`horizontal-light.svg` is her own file with the ink fill swapped to cream —
sanctioned by the brandbook (*"light color type on a dark background"*).
`mark.svg` is the same brand stamp with the wordmark paths removed.

**Note:** her `Asset_21.svg` ships `width="1.49"`, which is corrupt. Stripped so the
`viewBox` governs. If a future file renders 1px wide, that's the cause.

### Favicon

Generated from `mark-light.svg`. The strokes are dilated at small sizes — the raw
vector hairlines disappear below about 48px, which was the client's original
complaint. Regenerate with the snippet in section 10 if the mark ever changes.

---

## 8. Automated checks

```bash
npm run test          # build, then check everything
npm run check:site    # check the existing dist/ only
```

`scripts/check-site.mjs` walks every built page and fails the build on:

- internal links pointing at routes that don't exist
- `#anchors` pointing at IDs that aren't on the target page
- images or assets that 404
- `hreflang` pairs that don't resolve
- duplicate IDs, images without `alt`
- missing `<title>`, meta description, canonical, `og:image`, `<h1>`
- German text left on English pages (warning)

It exits non-zero on error, so it works as a pre-deploy gate. **Run it before
every push.** The English `#about` / `#contact` bug was found by a client, not by
us — this is what stops that repeating.

---

## 9. Still outstanding

- [ ] **SVG logos.** Currently using 3× PNGs — soft on retina.
- [ ] **A horizontal light-on-dark logo.** The stacked mark's monogram swallows
      the "B" at nav size (reads "ERMEYER"). The footer uses the cream wordmark
      as a workaround.
- [ ] **Photos 6380 / 6377** for the two programme page headers (placeholder in use).
**Resolved 25 Aug:** Einzelunternehmen · CHE-456.292.561 · not VAT-registered ·
Hostpoint.ch · `/deine-ki-landkarte/` to be dropped. All now live in the legal pages.

---

## 10. Deliberate decisions

**Calendly opens in a new tab; it is not embedded.** An embed sets third-party
cookies and would require a consent banner under GDPR/revDSG. A link does not.
The site currently ships **no cookies and no tracking at all**, so it needs no
banner — worth selling to Nadine as a feature, given she advises on AI
sovereignty.

**No analytics installed.** If she wants numbers, use a cookieless tool
(Plausible or Umami) to keep the no-banner status.

**Swiss orthography throughout** — `grösste`, `weiss`, `fliessen`, never `ß`.
Informal capitalised **Du**, matching her brochures. Do not "correct" these.

**No prices anywhere**, per her instruction while she tests the market. The
brochures contain CHF figures — do not copy them across.
