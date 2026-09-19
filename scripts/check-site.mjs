/**
 * Site checker — run after `npm run build`.
 *
 * Catches the things that are invisible until a client finds them:
 *   • internal links pointing at routes that don't exist
 *   • #anchors pointing at IDs that don't exist on the target page
 *   • <img>/asset references that 404
 *   • hreflang pairs that don't resolve
 *   • duplicate IDs, images without alt text
 *   • missing title / description / canonical / og:image
 *   • pages that accidentally ship an empty section
 *
 * Usage:  node scripts/check-site.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', RST = '\x1b[0m';

let errors = 0, warnings = 0;
const err = (page, msg) => { errors++; console.log(`${RED}  ✗${RST} ${DIM}${page}${RST} ${msg}`); };
const warn = (page, msg) => { warnings++; console.log(`${YEL}  !${RST} ${DIM}${page}${RST} ${msg}`); };

/* ---------- collect built pages ---------- */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!existsSync(DIST)) {
  console.log(`${RED}dist/ not found — run "npm run build" first.${RST}`);
  process.exit(1);
}

const files = walk(DIST);
const pages = new Map(); // route -> { html, ids }

for (const f of files) {
  const route = '/' + relative(DIST, f).replace(/\\/g, '/').replace(/index\.html$/, '');
  const html = readFileSync(f, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  pages.set(route, { html, ids, file: f });
}

const routes = new Set(pages.keys());
console.log(`\n${DIM}Checking ${pages.size} pages…${RST}\n`);

/* ---------- per-page checks ---------- */
for (const [route, { html, ids }] of pages) {
  const isRedirect = /http-equiv="refresh"/.test(html);
  // 404 and other noindex pages: links and assets must still resolve, but
  // they carry no canonical, OG image or structured data by design.
  const isNoindex = /name="robots" content="noindex"/.test(html);

  // --- internal links + anchors ---
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(href) === false && href.startsWith('/')) {
      const [path, frag] = href.split('#');
      const target = path === '' ? route : path;

      // asset files (fonts, images, css) — check on disk
      if (/\.[a-z0-9]{2,5}$/i.test(target)) {
        if (!existsSync(join(DIST, target))) err(route, `dead asset link → ${target}`);
        continue;
      }
      if (!routes.has(target)) {
        err(route, `dead link → ${href}`);
        continue;
      }
      if (frag && !pages.get(target).ids.has(frag)) {
        err(route, `anchor #${frag} does not exist on ${target}`);
      }
    }
    // same-page fragment
    if (href.startsWith('#') && href.length > 1 && !ids.has(href.slice(1))) {
      err(route, `anchor ${href} does not exist on this page`);
    }
  }

  if (isRedirect) continue; // redirect stub needs no further checks

  // --- assets referenced by src / srcset ---
  const srcs = [
    ...[...html.matchAll(/\ssrc="(\/[^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/srcset="([^"]+)"/g)].flatMap((m) =>
      m[1].split(',').map((s) => s.trim().split(/\s+/)[0])
    ),
  ].filter((s) => s.startsWith('/'));
  for (const s of new Set(srcs)) {
    if (!existsSync(join(DIST, s))) err(route, `missing asset → ${s}`);
  }

  // --- duplicated blocks (a patch applied twice) ---
  for (const cls of ['bio__social', 'bio__badges', 'bio__photo', 'hdr__nav', 'stats__list']) {
    const n = (html.match(new RegExp(`class="${cls}[ "]`, 'g')) || []).length;
    if (n > 1) err(route, `.${cls} appears ${n} times — duplicated block`);
  }

  // --- duplicate IDs ---
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = all.filter((v, i) => all.indexOf(v) !== i);
  for (const d of new Set(dupes)) err(route, `duplicate id="${d}"`);

  // --- images without alt ---
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) {
    const decorative = /aria-hidden="true"/.test(m[1]);
    if (!/\salt=/.test(m[1]) && !decorative) err(route, `<img> without alt attribute`);
  }

  // --- SEO essentials ---
  const need = {
    '<title>': /<title>[^<]{10,}<\/title>/,
    'meta description': /name="description" content="[^"]{40,}"/,
    'canonical': /rel="canonical"/,
    'og:image': /property="og:image"/,
    'lang attribute': /<html lang="(de|en)"/,
    'h1': /<h1[\s>]/,
  };
  for (const [label, re] of Object.entries(need)) {
    if (isNoindex && ['meta description', 'canonical', 'og:image'].includes(label)) continue;
    if (!re.test(html)) err(route, `missing ${label}`);
  }

  // exactly one h1
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  if (h1s > 1) warn(route, `${h1s} <h1> tags (should be 1)`);

  // --- hreflang pairs resolve ---
  for (const m of html.matchAll(/hreflang="(?:de|en)" href="[^"]*?(\/(?:de|en)\/[^"]*)"/g)) {
    if (!routes.has(m[1])) err(route, `hreflang points at missing route → ${m[1]}`);
  }

  // --- untranslated leftovers on EN pages ---
  if (route.startsWith('/en/')) {
    for (const w of ['Wochen', 'Kostenlos', 'Für wen', 'Wo stehst Du']) {
      if (html.includes(w)) warn(route, `possible untranslated text: "${w}"`);
    }
  }

  // --- empty sections ---
  for (const m of html.matchAll(/<section[^>]*class="([^"]*)"[^>]*>([\s\S]{0,80})<\/section>/g)) {
    warn(route, `section appears empty: .${m[1].split(' ')[0]}`);
  }
}

/* ---------- structured data, analytics, crawler policy ---------- */

// Expected values come from the same source the build reads, so the checker
// can never drift from the config.
const siteCfg = JSON.parse(readFileSync('src/data/site.json', 'utf8'));
const PLAUSIBLE_SRC = siteCfg.plausible?.src;

let analyticsLive = false;

for (const [route, { html }] of pages) {
  if (/http-equiv="refresh"/.test(html)) continue; // redirect stub is exempt
  if (/name="robots" content="noindex"/.test(html)) continue; // 404 page: no schema, no analytics

  // --- JSON-LD present, parseable, and describing the business ---
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ld) {
    err(route, 'missing JSON-LD structured data');
  } else {
    try {
      const graph = JSON.parse(ld[1])['@graph'] || [];
      const types = graph.flatMap((n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]));
      for (const required of ['Organization', 'Person', 'WebSite', 'WebPage']) {
        if (!types.includes(required)) err(route, `JSON-LD missing a ${required} node`);
      }
    } catch (e) {
      err(route, `JSON-LD is not valid JSON — ${e.message}`);
    }
  }

  // --- Plausible must be on every page, or on none of them ---
  if (/plausible\.io\/js\//.test(html)) {
    analyticsLive = true;
    const src = (html.match(/src="(https:\/\/plausible\.io\/js\/[^"]+)"/) || [])[1];
    if (src !== PLAUSIBLE_SRC) {
      err(route, `Plausible script is "${src}" — site.json expects ${PLAUSIBLE_SRC}`);
    }
    // the loader alone records nothing; the init call must ship with it
    if (!/plausible\.init\(\)/.test(html)) {
      err(route, 'Plausible script present but plausible.init() is missing — no pageviews will be sent');
    }
  } else {
    warn(route, 'no Plausible tag on this page');
  }
}

// --- if analytics ships, both privacy pages must disclose it ---
if (analyticsLive) {
  for (const route of ['/de/datenschutz/', '/en/privacy/']) {
    const page = pages.get(route);
    if (!page) { err(route, 'privacy page missing'); continue; }
    if (!/Plausible/.test(page.html)) {
      err(route, 'analytics is live but this privacy page never mentions Plausible');
    }
    if (/no analytics or tracking|keine\s*Analyse-\s*oder\s*Tracking-Dienste/i.test(page.html)) {
      err(route, 'privacy page still claims there is no analytics, but Plausible is live');
    }
  }
}

// --- the hosting disclosure must match reality ---
// This shipped wrong once: the pages claimed Hostpoint/Swiss servers while the
// site was actually served from Vercel. Registrar is not the host.
const host = siteCfg.legal?.hostName ?? '';
const hostIsSwiss = /schweiz|switzerland/i.test(
  `${siteCfg.legal?.hostCountryDe} ${siteCfg.legal?.hostCountryEn}`
);
for (const route of ['/de/datenschutz/', '/en/privacy/']) {
  const page = pages.get(route);
  if (!page) continue;
  const name = host.replace(/\s+(Inc\.|AG)$/, '');
  if (name && !page.html.includes(name)) {
    err(route, `privacy page does not name the host from site.json ("${host}")`);
  }
  if (!hostIsSwiss && /Schweizer Servern|Swiss servers/i.test(page.html)) {
    err(route, `privacy page claims Swiss servers, but the host is ${host}`);
  }
}

// --- crawler policy survives future edits ---
const robotsPath = join(DIST, 'robots.txt');
if (!existsSync(robotsPath)) err('/robots.txt', 'file is missing');
else {
  const robots = readFileSync(robotsPath, 'utf8');
  for (const bot of ['GPTBot', 'CCBot', 'ClaudeBot', 'Bytespider', 'Applebot-Extended']) {
    if (!new RegExp(`User-agent:\\s*${bot}\\b`, 'i').test(robots)) {
      err('/robots.txt', `training crawler "${bot}" is no longer blocked`);
    }
  }
  for (const bot of ['OAI-SearchBot', 'PerplexityBot', 'Bingbot', 'Googlebot']) {
    if (!new RegExp(`User-agent:\\s*${bot}\\b`, 'i').test(robots)) {
      err('/robots.txt', `citing crawler "${bot}" is no longer listed`);
    }
  }
  if (!/^Sitemap:\s*https:\/\//m.test(robots)) err('/robots.txt', 'missing Sitemap directive');
  if (!/Disallow:\s*\/\s*$/m.test(robots)) err('/robots.txt', 'no Disallow rule found at all');
}

// --- llms.txt ---
const llmsPath = join(DIST, 'llms.txt');
if (!existsSync(llmsPath)) err('/llms.txt', 'file is missing');
else if (readFileSync(llmsPath, 'utf8').length < 500) err('/llms.txt', 'looks truncated');

/* ---------- summary ---------- */
console.log('');
if (errors === 0 && warnings === 0) console.log(`${GRN}✓ All checks passed (${pages.size} pages).${RST}\n`);
else console.log(`${errors ? RED : GRN}${errors} error(s)${RST}, ${warnings ? YEL : GRN}${warnings} warning(s)${RST}\n`);

process.exit(errors > 0 ? 1 : 0);
