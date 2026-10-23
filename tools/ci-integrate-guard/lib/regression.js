'use strict';

const { extractCacheBustRefs } = require('./cache-bust');
const { compareVersions, isVersionLower } = require('./version');

/**
 * @typedef {{ file: string, asset: string, baseVersion: string, headVersion: string, ceilingSource?: string }} RegressionRow
 */

/**
 * Max ?v= per asset across main and source PR file heads (only sources that touched this file).
 * @param {string} mainContent
 * @param {{ label: string, content: string }[]} sourceSnapshots
 * @returns {Map<string, { version: string, source: string }>}
 */
function buildVersionCeiling(mainContent, sourceSnapshots) {
  const ceiling = new Map();
  const mainRefs = extractCacheBustRefs(mainContent);
  for (const [asset, ver] of mainRefs) {
    ceiling.set(asset, { version: ver, source: 'main' });
  }
  for (const snap of sourceSnapshots) {
    const refs = extractCacheBustRefs(snap.content);
    for (const [asset, ver] of refs) {
      const cur = ceiling.get(asset);
      if (!cur || compareVersions(ver, cur.version) > 0) {
        ceiling.set(asset, { version: ver, source: snap.label });
      }
    }
  }
  return ceiling;
}

/**
 * Integration integrates-block check: head must be >= max(main, source PRs) per asset.
 * @param {string} filePath
 * @param {string} mainContent
 * @param {string} headContent
 * @param {{ label: string, content: string }[]} sourceSnapshots
 * @returns {RegressionRow[]}
 */
function regressionsWithSourceCeiling(filePath, mainContent, headContent, sourceSnapshots) {
  const ceiling = buildVersionCeiling(mainContent, sourceSnapshots);
  const headRefs = extractCacheBustRefs(headContent);
  const rows = [];

  for (const [asset, headVer] of headRefs) {
    const ceil = ceiling.get(asset);
    if (!ceil) continue;
    if (isVersionLower(headVer, ceil.version)) {
      rows.push({
        file: filePath,
        asset,
        baseVersion: ceil.version,
        headVersion: headVer,
        ceilingSource: ceil.source,
      });
    }
  }

  return rows;
}

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
function formatRegressionTable(rows, opts = {}) {
  if (!rows.length) {
    const msg = opts.integratesMode
      ? 'No cache-bust version regressions (PR head >= main and source PR ceilings).'
      : 'No cache-bust version regressions (PR head >= base for every shared asset).';
    return msg;
  }
  const hasCeiling = rows.some((r) => r.ceilingSource);
  const header = hasCeiling
    ? ['File', 'Asset', 'Required ?v=', 'Head ?v=', 'Ceiling from']
    : ['File', 'Asset', 'Base ?v=', 'Head ?v='];
  const colWidths = header.map((h, i) => {
    const maxCell = rows.reduce((m, r) => {
      const vals = hasCeiling
        ? [r.file, r.asset, r.baseVersion, r.headVersion, r.ceilingSource || '']
        : [r.file, r.asset, r.baseVersion, r.headVersion];
      return Math.max(m, String(vals[i]).length);
    }, h.length);
    return maxCell;
  });

  const pad = (s, w) => String(s).padEnd(w);
  const line = (cells) => cells.map((c, i) => pad(c, colWidths[i])).join('  ');

  const title = hasCeiling
    ? 'CACHE-BUST VERSION REGRESSIONS (head lower than max of main / source PRs):'
    : 'CACHE-BUST VERSION REGRESSIONS (head lower than base):';

  const out = [
    title,
    line(header),
    line(colWidths.map((w) => '-'.repeat(w))),
    ...rows.map((r) =>
      line(
        hasCeiling
          ? [r.file, r.asset, r.baseVersion, r.headVersion, r.ceilingSource || '']
          : [r.file, r.asset, r.baseVersion, r.headVersion],
      ),
    ),
  ];
  return out.join('\n');
}

function dedupeRegressionRows(rows) {
  const key = (r) => `${r.file}\0${r.asset}\0${r.headVersion}`;
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

module.exports = {
  regressionsInFile,
  regressionsFromRefMaps,
  regressionsWithSourceCeiling,
  buildVersionCeiling,
  formatRegressionTable,
  dedupeRegressionRows,
};
