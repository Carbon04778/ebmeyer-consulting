# Ebmeyer Consulting — Website

Astro static site. German + English. Zero JavaScript framework, no CMS lock-in.

Current build: **12–43 KB HTML+CSS per page, 0 KB of first-party JS bundles.**
The only external script is Plausible (cookieless analytics, ~1 KB) — see §11.
About 3 KB of that per page is JSON-LD structured data.

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
    site.json        ← Calendly link, email, phone, domain, analytics, legal
  components/        ← one file per page section
  layouts/Base.astro ← <head>, SEO, hreflang, fonts, JSON-LD, analytics
  pages/
    index.astro      ← language redirect
    de/index.astro   ← German homepage
    en/index.astro   ← English homepage
  styles/tokens.css  ← the entire design system
public/
  fonts/             ← self-hosted Fraunces + Hanken Grotesk (woff2)
  robots.txt         ← crawler policy (§11)
  llms.txt           ← plain-text site summary for AI assistants (§11)
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
- missing or unparseable JSON-LD, analytics/privacy drift, crawler-policy
  regressions — see §11 for the full list

It exits non-zero on error, so it works as a pre-deploy gate. **Run it before
every push.** The English `#about` / `#contact` bug was found by a client, not by
us — this is what stops that repeating.

---

## 9. Still outstanding

- [x] ~~**SVG logos.**~~ Done 26 Aug — all four are true vector, see §7.
- [x] ~~**A horizontal light-on-dark logo.**~~ Done 26 Aug — `horizontal-light.svg`.
- [x] ~~**Photos 6380 / 6377**~~ for the programme headers. Supplied and in use;
      each programme JSON picks one via `hero.image`.

**Resolved 25 Aug:** Einzelunternehmen · CHE-456.292.561 · not VAT-registered ·
`/deine-ki-landkarte/` dropped. All now live in the legal pages.

**Fixed Sept 2026 — hosting disclosure.** Both privacy pages used to state the
site was hosted with *Hostpoint AG in Switzerland*, "so the data remains on
Swiss servers". That was wrong: **Hostpoint is only the domain registrar.** The
site is hosted on **Vercel**, whose edge network serves from wherever is nearest
the visitor, which means processing outside Switzerland and the EU. Both pages
now say so, and the build fails if they ever drift again — see §11.

> **Registrar ≠ host.** If hosting ever moves, update
> `site.json → legal.hostName` / `hostCountry*` and the disclosure follows.
> `registrarName` is a separate field and should stay Hostpoint.

Open items for analytics and AI findability are in §11.

---

## 10. Deliberate decisions

**Calendly opens in a new tab; it is not embedded.** An embed sets third-party
cookies and would require a consent banner under GDPR/revDSG. A link does not.

**The site still sets no cookies, and still needs no consent banner.** That was
the deciding factor in choosing Plausible over Google Analytics — see §11.
Anything added later that sets a cookie or ships data to the US breaks this and
drags a banner in with it. Check before adding.

**Swiss orthography throughout** — `grösste`, `weiss`, `fliessen`, never `ß`.
Informal capitalised **Du**, matching her brochures. Do not "correct" these.

**No prices anywhere**, per her instruction while she tests the market. The
brochures contain CHF figures — do not copy them across.

---

## 11. Analytics and AI findability (Sept 2026)

Two things Nadine asked for after launch: numbers, and being findable by AI
assistants. Both are live. Neither introduces a cookie, so **the site still
needs no consent banner.**

### Plausible

Cookieless, EU-hosted, aggregate only. Configured in `src/data/site.json`:

```json
"plausible": {
  "enabled": true,
  "domain": "ebmeyer-consulting.ch",
  "src": "https://plausible.io/js/pa-5LUFSn6phmGR1ewBlcbFC.js"
}
```

`enabled: false` removes it from every page. The tag is injected by
`Base.astro` and is **production-only** (`import.meta.env.PROD`), so
`npm run dev` never reaches her dashboard.

This is Plausible's newer per-site script: the site is identified by the id in
the filename, *not* by a `data-domain` attribute. Tracking options such as
outbound-link clicks are toggled in the Plausible dashboard under Site
Settings, not by swapping the script filename as the old tracker did.

Both privacy pages document it. The build **fails** if analytics ships while a
privacy page fails to mention Plausible — the two can't drift apart.

### Structured data

`Base.astro` emits one JSON-LD `@graph` per page. Stable `@id`s
(`/#organization`, `/#nadine`, `/#website`) mean crawlers resolve one business
and one person across all ten pages rather than ten unrelated copies.

- every page: `ProfessionalService` + `Person` + `WebSite` + `WebPage`
- programme pages: also a `Service` node, via `ProgramPage.astro`
- non-homepage: a `BreadcrumbList`, driven by the `pageName` prop

To add nodes from a page, pass `schema={[...]}` to `Base`. To add a breadcrumb,
pass `pageName`.

**No prices in any of it**, per §10. If she starts publishing figures, `Offer`
nodes go on the `Service` entries.

### Crawler policy

`public/robots.txt` splits crawlers in two: those that **cite** her are allowed,
those that only **train** on her are blocked.

Allowed: Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, PerplexityBot,
Claude-SearchBot, Applebot and friends. Blocked: GPTBot, ClaudeBot, CCBot,
Bytespider, Applebot-Extended, meta-externalagent and similar.

Two traps for whoever edits this next:

- `GPTBot` and `OAI-SearchBot` are different crawlers. So are `ClaudeBot` and
  `Claude-SearchBot`, and `Applebot-Extended` and `Applebot`. Blocking the
  citation half deletes her from AI answers. That is the opposite of the goal.
- `Google-Extended` is deliberately **allowed**. It gates Gemini grounding as
  well as training, and losing a citation surface costs more than the training
  use is worth. Her call, reversible in one line.

robots.txt is honoured voluntarily. For enforcement, block at the edge in
Vercel.

### llms.txt

`public/llms.txt` — a plain-text summary of who she is, both programmes and
where the canonical pages live, for assistants that look for it. Keep it in
sync when programme copy changes. It contains no prices.

### What the checker now enforces

`npm run test` fails on top of the existing rules if:

- any page is missing JSON-LD, or its JSON-LD does not parse
- a required node type (`Organization`, `Person`, `WebSite`, `WebPage`) is absent
- the Plausible script id drifts from `site.json`, or `plausible.init()` is missing
- analytics is live but a privacy page doesn't disclose it
- a privacy page doesn't name the host in `site.json`, or claims Swiss servers
  while the host is not Swiss
- a training crawler is no longer blocked, or a citing crawler is no longer listed
- `llms.txt` is missing or truncated

### Still to do — needs Nadine

- [ ] **FAQ section, DE + EN**, plus `FAQPage` JSON-LD. Drafted questions need
      her approval first: these are the sentences an AI will quote verbatim.
- [ ] **Google Search Console + Bing Webmaster Tools.** Verify, submit
      `sitemap-index.xml`. Bing matters more than its market share suggests —
      ChatGPT and Perplexity lean on its index.
- [ ] Confirm outbound-link tracking is switched on in the Plausible dashboard,
      so Calendly clicks are counted. Pageviews alone won't show bookings.

The largest factor in whether an AI cites her is **off-site mentions** —
LinkedIn, articles, podcasts. The work above removes every technical obstacle.
It cannot manufacture authority.

### Deployment topology (so this isn't confused again)

| Thing | Who | Where |
|---|---|---|
| Domain registration + DNS | Hostpoint AG | Switzerland |
| Web hosting / serving | Vercel | global edge, US company |
| Analytics | Plausible Insights OÜ | EU servers |
| Booking | Calendly LLC | USA — linked, never embedded |

The DNS records at Hostpoint point `ebmeyer-consulting.ch` at Vercel. Hostpoint
serves no page content, so it is **not** the host for privacy purposes.

**Two things Nadine should confirm on the Vercel side:**

1. That the **Data Processing Agreement** is accepted on her Vercel account.
   The privacy pages now state that a DPA is in place and that the US transfer
   rests on Standard Contractual Clauses. That is Vercel's standard offering,
   but the statement should not stand unverified.
2. Static pages are served from Vercel's global edge and **cannot be pinned to
   the EU** — region settings govern functions, and this site has none. So
   "processed outside Switzerland and the EU" is the honest wording and should
   stay. If she ever wants EU-only delivery, that is a change of host, not a
   setting.
