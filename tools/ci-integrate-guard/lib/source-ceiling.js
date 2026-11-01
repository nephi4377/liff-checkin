'use strict';

const { extractCacheBustRefs } = require('./cache-bust');
const { compareVersions, isVersionLower } = require('./version');
const { fetchBlobUtf8, loadSourcePrIndex } = require('./github-api');
const { regressionsWithSourceCeiling } = require('./regression');

/**
 * @param {object} opts
 * @param {string} opts.owner
 * @param {string} opts.repo
 * @param {string} opts.token
 * @param {number[]} opts.sourcePrNumbers
 * @param {string[]} opts.changedHtmlJs
 * @param {string} opts.baseRef
 * @param {string} opts.headRef
 * @param {function(string, string, string): string|null} opts.readFileAtRef
 * @param {string} opts.repoRoot
 */
async function fetchIntegratesCacheBustRegressions(opts) {
  const {
    owner,
    repo,
    token,
    sourcePrNumbers,
    changedHtmlJs,
    baseRef,
    headRef,
    readFileAtRef,
    repoRoot,
  } = opts;

  if (!sourcePrNumbers.length) return [];

  const { fileToSourcePrs, headShaByPr } = await loadSourcePrIndex(
    owner,
    repo,
    sourcePrNumbers,
    token,
  );

  const allRows = [];

  for (const file of changedHtmlJs) {
    const headContent = readFileAtRef(headRef, file, repoRoot);
    const mainContent = readFileAtRef(baseRef, file, repoRoot);
    if (headContent === null || mainContent === null) continue;

    const sourcePrsForFile = fileToSourcePrs.get(file) || [];
    const sourceSnapshots = [];
    for (const prNum of sourcePrsForFile) {
      const sha = headShaByPr.get(prNum);
      const content = await fetchBlobUtf8(owner, repo, file, sha, token);
      if (content !== null) {
        sourceSnapshots.push({ label: `#${prNum}`, content });
      }
    }

    allRows.push(
      ...regressionsWithSourceCeiling(file, mainContent, headContent, sourceSnapshots),
    );
  }

  return allRows;
}

module.exports = {
  fetchIntegratesCacheBustRegressions,
};
