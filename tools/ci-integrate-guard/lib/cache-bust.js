'use strict';

const { parseVersionToken } = require('./version');

/** Chars allowed in asset path immediately before `?v=` */
const ASSET_CHAR = /[A-Za-z0-9_./@~-]/;

/**
 * Extract cache-bust asset → version from HTML/JS source.
 * Scans every `?v=` and walks backward for the asset path suffix.
 * @param {string} content
 * @returns {Map<string, string>} asset path (no query) → version
 */
function extractCacheBustRefs(content) {
  const refs = new Map();
  if (!content || typeof content !== 'string') return refs;

  const marker = '?v=';
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const idx = content.indexOf(marker, searchFrom);
    if (idx < 0) break;

    const versionStart = idx + marker.length;
    const version = parseVersionToken(content.slice(versionStart));
    if (!version) {
      searchFrom = idx + marker.length;
      continue;
    }

    let j = idx - 1;
    while (j >= 0 && ASSET_CHAR.test(content[j])) j--;
    const asset = content.slice(j + 1, idx);
    if (asset) {
      refs.set(asset, version);
    }

    searchFrom = versionStart + version.length;
  }

  return refs;
}

module.exports = {
  extractCacheBustRefs,
  ASSET_CHAR,
};
