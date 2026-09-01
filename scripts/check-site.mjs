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

/* ---------- summary ---------- */
console.log('');
if (errors === 0 && warnings === 0) console.log(`${GRN}✓ All checks passed (${pages.size} pages).${RST}\n`);
else console.log(`${errors ? RED : GRN}${errors} error(s)${RST}, ${warnings ? YEL : GRN}${warnings} warning(s)${RST}\n`);

process.exit(errors > 0 ? 1 : 0);
