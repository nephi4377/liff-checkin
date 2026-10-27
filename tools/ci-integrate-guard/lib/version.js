'use strict';

/**
 * Parse leading numeric/dotted version after ?v= (caller positions at version start).
 * @param {string} text from version start
 * @returns {string|null}
 */
function parseVersionToken(text) {
  const m = /^([\d]+(?:\.[\d]+)*)/.exec(text);
  return m ? m[1] : null;
}

/**
 * Compare dotted versions segment-wise (numeric). Returns negative if a<b, 0 if equal, positive if a>b.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions(a, b) {
  if (a === b) return 0;
  const pa = a.split('.').map((s) => parseInt(s, 10));
  const pb = b.split('.').map((s) => parseInt(s, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = Number.isFinite(pa[i]) ? pa[i] : 0;
    const db = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

function isVersionLower(headVer, baseVer) {
  return compareVersions(headVer, baseVer) < 0;
}

module.exports = {
  parseVersionToken,
  compareVersions,
  isVersionLower,
};
