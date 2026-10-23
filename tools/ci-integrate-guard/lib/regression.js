'use strict';

const { extractCacheBustRefs } = require('./cache-bust');
const { isVersionLower } = require('./version');

/**
 * @typedef {{ file: string, asset: string, baseVersion: string, headVersion: string }} RegressionRow
 */

/**
 * Compare cache-bust versions between base and head file contents.
 * @param {string} filePath
 * @param {string} baseContent
 * @param {string} headContent
 * @returns {RegressionRow[]}
 */
function regressionsInFile(filePath, baseContent, headContent) {
  const baseRefs = extractCacheBustRefs(baseContent);
  const headRefs = extractCacheBustRefs(headContent);
  const rows = [];

  for (const [asset, headVer] of headRefs) {
    const baseVer = baseRefs.get(asset);
    if (baseVer === undefined) continue;
    if (isVersionLower(headVer, baseVer)) {
      rows.push({
        file: filePath,
        asset,
        baseVersion: baseVer,
        headVersion: headVer,
      });
    }
  }

  return rows;
}

/**
 * @param {string} filePath
 * @param {Map<string, string>} baseRefs
 * @param {Map<string, string>} headRefs
 * @returns {RegressionRow[]}
 */
function regressionsFromRefMaps(filePath, baseRefs, headRefs) {
  const rows = [];
  for (const [asset, headVer] of headRefs) {
    const baseVer = baseRefs.get(asset);
    if (baseVer === undefined) continue;
    if (isVersionLower(headVer, baseVer)) {
      rows.push({
        file: filePath,
        asset,
        baseVersion: baseVer,
        headVersion: headVer,
      });
    }
  }
  return rows;
}

/**
 * @param {RegressionRow[]} rows
 * @returns {string}
 */
function formatRegressionTable(rows) {
  if (!rows.length) {
    return 'No cache-bust version regressions (PR head >= base for every shared asset).';
  }
  const header = ['File', 'Asset', 'Base ?v=', 'Head ?v='];
  const colWidths = header.map((h, i) => {
    const maxCell = rows.reduce((m, r) => {
      const vals = [r.file, r.asset, r.baseVersion, r.headVersion];
      return Math.max(m, String(vals[i]).length);
    }, h.length);
    return maxCell;
  });

  const pad = (s, w) => String(s).padEnd(w);
  const line = (cells) => cells.map((c, i) => pad(c, colWidths[i])).join('  ');

  const out = [
    'CACHE-BUST VERSION REGRESSIONS (head lower than base):',
    line(header),
    line(colWidths.map((w) => '-'.repeat(w))),
    ...rows.map((r) => line([r.file, r.asset, r.baseVersion, r.headVersion])),
  ];
  return out.join('\n');
}

module.exports = {
  regressionsInFile,
  regressionsFromRefMaps,
  formatRegressionTable,
};
