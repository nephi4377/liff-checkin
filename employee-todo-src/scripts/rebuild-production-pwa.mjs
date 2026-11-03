/**
 * 依 modules/projects/employee-todo/ 檔案內容重算 Workbox precache revision，
 * 更新 sw.js／registerSW.js／index.html et-build（Mantle bundle 本身不重編）。
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const PROD = join(__dir, '../../modules/projects/employee-todo');
const BUILD = process.env.ET_BUILD || '20261103c';

const PRECACHE = [
  'registerSW.js',
  'sheet-bridge.js',
  'pwa-512.png',
  'pwa-192.png',
  'index.html',
  'icons.svg',
  'icon-512.png',
  'favicon.svg',
  'apple-touch-icon.png',
  'assets/index-CTl_-N1Z.css',
  'assets/index-B0wpJKiW.js',
  'manifest.webmanifest',
];

function md5File(rel) {
  const buf = readFileSync(join(PROD, rel));
  return createHash('md5').update(buf).digest('hex');
}

function patchSw(swText, entries) {
  const precacheBody = entries
    .map(({ url, revision }) => {
      const rev = revision == null ? 'null' : `"${revision}"`;
      return `{url:"${url}",revision:${rev}}`;
    })
    .join(',');
  return swText.replace(
    /e\.precacheAndRoute\(\[[^\]]*\],\{\}\)/,
    `e.precacheAndRoute([${precacheBody}],{})`,
  );
}

const entries = PRECACHE.map((url) => {
  const revision = url.endsWith('.css') ? null : md5File(url);
  return { url, revision };
});

const swPath = join(PROD, 'sw.js');
const sw = readFileSync(swPath, 'utf8');
const nextSw = patchSw(sw, entries);
writeFileSync(swPath, nextSw);

const registerPath = join(PROD, 'registerSW.js');
writeFileSync(
  registerPath,
  readFileSync(registerPath, 'utf8').replace(
    /register\('\.\/sw\.js\?v=[^']+'/,
    `register('./sw.js?v=${BUILD}'`,
  ),
);

const indexPath = join(PROD, 'index.html');
let indexHtml = readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(/et-build" content="[^"]+"/, `et-build" content="${BUILD}"`);
indexHtml = indexHtml.replace(/var BUILD = '[^']+'/, `var BUILD = '${BUILD}'`);
indexHtml = indexHtml.replace(/\?v=[^"']+/g, `?v=${BUILD}`);
writeFileSync(indexPath, indexHtml);

console.log(`[rebuild-production-pwa] et-build=${BUILD} sheet-bridge=${md5File('sheet-bridge.js').slice(0, 8)}…`);
