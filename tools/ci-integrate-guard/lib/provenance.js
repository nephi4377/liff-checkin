'use strict';

const { fetchBlobUtf8, loadSourcePrIndex } = require('./github-api');

/**
 * @typedef {{ file: string, reason: string }} ProvenanceWarning
 */

/**
 * @param {object} opts
 * @param {string} opts.owner
 * @param {string} opts.repo
 * @param {number[]} opts.sourcePrNumbers
 * @param {string[]} opts.changedFiles integration PR changed paths (any extension)
 * @param {Map<string, string>} opts.headContents path → utf8 content on integration head
 * @param {string} opts.token GitHub token
 * @param {{ fileToSourcePrs: Map, headShaByPr: Map }} [opts.sourceIndex] preloaded index
 * @returns {Promise<ProvenanceWarning[]>}
 */
async function checkProvenance(opts) {
  const { owner, repo, sourcePrNumbers, changedFiles, headContents, token } = opts;
  if (!sourcePrNumbers.length) return [];

  const { fileToSourcePrs, headShaByPr } =
    opts.sourceIndex ||
    (await loadSourcePrIndex(owner, repo, sourcePrNumbers, token));

  const warnings = [];

  for (const file of changedFiles) {
    const integrationContent = headContents.get(file);
    if (integrationContent === undefined) continue;

    const sources = fileToSourcePrs.get(file) || [];
    if (!sources.length) {
      warnings.push({
        file,
        reason: 'Changed in integration PR but not listed in any source PR file list',
      });
      continue;
    }

    let matched = false;
    for (const prNum of sources) {
      const sha = headShaByPr.get(prNum);
      const sourceContent = await fetchBlobUtf8(owner, repo, file, sha, token);
      if (sourceContent === null) continue;
      if (normalizeEol(sourceContent) === normalizeEol(integrationContent)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      warnings.push({
        file,
        reason: `Content differs from head of source PR(s): ${sources.map((n) => '#' + n).join(', ')}`,
      });
    }
  }

  return warnings;
}

function normalizeEol(s) {
  return s.replace(/\r\n/g, '\n');
}

/**
 * @param {ProvenanceWarning[]} warnings
 * @returns {string}
 */
function formatProvenanceWarnings(warnings) {
  if (!warnings.length) {
    return 'Integration provenance: all changed files match a listed source PR head (or no integrates block).';
  }
  const lines = ['INTEGRATION PROVENANCE WARNINGS (non-fatal):'];
  for (const w of warnings) {
    lines.push(`- ${w.file}: ${w.reason}`);
  }
  lines.push(
    '',
    'Limitations: binary files, rename-only paths, manual merges, and edits after cherry-pick may differ without indicating a bug.',
  );
  return lines.join('\n');
}

module.exports = {
  checkProvenance,
  formatProvenanceWarnings,
};
