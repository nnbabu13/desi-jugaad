#!/usr/bin/env node
/**
 * ============================================================================
 * prepare.mjs - post-export preparation of `dist/` for GitHub Pages project
 * site deployment at https://nnbabu13.github.io/desi-jugaad/
 * ============================================================================
 *
 * Why this exists (verified against a real SDK 58 export):
 *   - `EXPO_BASE_URL` is inlined into the JS bundles (expo-router's
 *     appendBaseUrl / getStateFromPath), so client-side navigation is already
 *     prefixed correctly.
 *   - The exported HTML templates and Metro asset registry strings are NOT
 *     prefixed: they still point at `/_expo/...`, `/assets/...`, `/favicon.ico`
 *     on the domain root, which 404s under a project sub-path.
 *   - `src/app/chat/[id].tsx` is dynamic; no HTML exists for arbitrary chat
 *     URLs, so GitHub Pages serves its 404 page. We generate that 404.html
 *     from the prepared index.html so the router boots and recovers the route
 *     from `location.pathname`.
 *
 * The rewrites are idempotent: each pattern only matches un-prefixed strings,
 * so re-running never double-prefixes.
 *
 * Usage (after `npx expo export --platform web`):
 *   node scripts/pages/prepare.mjs [distDir]
 * Env:
 *   EXPO_BASE_URL  base path without trailing slash (default "/desi-jugaad")
 * ============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';

const rawBase = process.env.EXPO_BASE_URL || '/desi-jugaad';
const BASE = `/${rawBase.replace(/^\/+|\/+$/g, '')}/`; // "/desi-jugaad/"
const DIST = path.resolve(process.cwd(), process.argv[2] || 'dist');

const fail = (msg) => {
  console.error(`::error::prepare.mjs: ${msg}`);
  process.exit(1);
};

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  fail(`no index.html in ${DIST} - run the export first`);
}

/** All rewrites applied to a source string. Quote-anchored, so external
 *  URLs (https://...) are never touched. */
const rewrite = (src) => {
  let out = src;
  for (const q of ['"', "'"]) {
    out = out.split(`${q}/_expo/`).join(`${q}${BASE}_expo/`);
    out = out.split(`${q}/assets/`).join(`${q}${BASE}assets/`);
    out = out.split(`${q}/favicon.`).join(`${q}${BASE}favicon.`);
  }
  return out;
};

const walk = (dir, ext) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (entry.name.endsWith(ext)) out.push(full);
  }
  return out;
};

/* 1 ------------------------------------------------ HTML rewrite ---------- */
const htmlFiles = walk(DIST, '.html');
let htmlChanged = 0;
let htmlReplacements = 0;
for (const file of htmlFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const before = src.split(`${BASE}`).length - 1; // already-prefixed occurrences
  const out = rewrite(src);
  const after = out.split(`${BASE}`).length - 1;
  if (out !== src) {
    htmlReplacements += after - before;
    htmlChanged += 1;
    fs.writeFileSync(file, out);
  }
}

/* 2 ------------------------------------------- web JS bundle rewrite ------ */
const jsDir = path.join(DIST, '_expo', 'static', 'js', 'web');
const jsFiles = fs.existsSync(jsDir) ? walk(jsDir, '.js') : [];
let jsChanged = 0;
let jsReplacements = 0;
for (const file of jsFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const before = src.split(`${BASE}`).length - 1;
  const out = rewrite(src);
  const after = out.split(`${BASE}`).length - 1;
  if (out !== src) {
    jsReplacements += after - before;
    jsChanged += 1;
    fs.writeFileSync(file, out);
  }
}

/* 3 ------------------------------------- 404.html SPA/dynamic-route fallback */
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
fs.writeFileSync(path.join(DIST, '404.html'), indexHtml);

/* 4 ---------------------------------------------------- verification ------- */
const problems = [];
for (const file of htmlFiles) {
  const c = fs.readFileSync(file, 'utf8');
  for (const needle of ['"/_expo/', '"/assets/', "'/_expo/", "'/assets/"]) {
    if (c.includes(needle)) problems.push(`${path.basename(file)} still has ${needle}`);
  }
}
for (const file of jsFiles) {
  const c = fs.readFileSync(file, 'utf8');
  for (const needle of ['"/_expo/', '"/assets/']) {
    if (c.includes(needle)) problems.push(`${path.basename(file)} still has ${needle}`);
  }
}
if (!fs.existsSync(path.join(DIST, '404.html'))) problems.push('404.html missing');

const commonJs = jsFiles.filter((f) => path.basename(f).startsWith('__common'));
const hasRouterBase =
  commonJs.length > 0 &&
  commonJs.some((f) => fs.readFileSync(f, 'utf8').includes(rawBase.replace(/^\//, '')));
if (!hasRouterBase) {
  problems.push('router base not found inlined in __common bundle (EXPO_BASE_URL missing at export time?)');
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}

console.log(`prepare.mjs OK`);
console.log(`  base            : ${BASE}`);
console.log(`  html rewritten  : ${htmlChanged}/${htmlFiles.length} files, ${htmlReplacements} refs`);
console.log(`  js  rewritten   : ${jsChanged}/${jsFiles.length} files, ${jsReplacements} refs`);
console.log(`  fallback        : 404.html generated from index.html`);
console.log(`  router base     : inlined in __common bundle`);
