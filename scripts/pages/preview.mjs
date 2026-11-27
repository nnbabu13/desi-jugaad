#!/usr/bin/env node
/**
 * ============================================================================
 * preview.mjs - local preview of the exported site EXACTLY as a GitHub Pages
 * project site would serve it, so base-path and fallback behaviour can be
 * verified before deploying.
 * ============================================================================
 *
 * Faithful to GitHub Pages' worst case:
 *   - everything lives under the base path (/desi-jugaad/)
 *   - extensionless URLs do NOT auto-map to .html (if GitHub happens to map
 *     them, that only makes the real deployment friendlier than this preview)
 *   - unknown paths return the prepared 404.html WITH status 404 - which is
 *     the mechanism the chat/[id] deep-link recovery relies on
 *
 * Usage:  node scripts/pages/preview.mjs [distDir] [port]
 *         (defaults: dist, 8090)
 * ============================================================================
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const rawBase = process.env.EXPO_BASE_URL || '/desi-jugaad';
const BASE = `/${rawBase.replace(/^\/+|\/+$/g, '')}/`;
const DIST = path.resolve(process.cwd(), process.argv[2] || 'dist');
const PORT = Number(process.argv[3] || 8090);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const send = (res, status, file) => {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
};

if (!fs.existsSync(path.join(DIST, '404.html'))) {
  console.error('404.html missing - run scripts/pages/prepare.mjs first');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);

    // Root of the site redirects into the base path (like Pages does).
    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { Location: BASE });
      res.end();
      return;
    }

    // Anything outside the base path cannot exist on a project site.
    if (!pathname.startsWith(BASE)) {
      send(res, 404, path.join(DIST, '404.html'));
      return;
    }

    let rel = pathname.slice(BASE.length);
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';

    const file = path.join(DIST, ...rel.split('/').filter(Boolean));
    // Path-traversal guard.
    if (!file.startsWith(DIST)) {
      send(res, 404, path.join(DIST, '404.html'));
      return;
    }

    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      send(res, 200, file);
      return;
    }

    // No extensionless -> .html mapping on purpose: worst-case Pages
    // behaviour. The 404 fallback must recover the route client-side.
    send(res, 404, path.join(DIST, '404.html'));
  })
  .listen(PORT, () => {
    console.log(`preview: http://localhost:${PORT}${BASE}`);
    console.log(`serving: ${DIST}`);
    console.log('unknown paths -> 404.html with HTTP 404 (GitHub Pages behaviour)');
  });
