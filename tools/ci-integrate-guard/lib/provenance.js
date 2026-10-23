'use strict';

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
 * @returns {Promise<ProvenanceWarning[]>}
 */
async function checkProvenance(opts) {
  const { owner, repo, sourcePrNumbers, changedFiles, headContents, token } = opts;
  if (!sourcePrNumbers.length) return [];

  const warnings = [];
  const fileToSourcePrs = new Map();

  for (const prNum of sourcePrNumbers) {
    const files = await listPullFiles(owner, repo, prNum, token);
    for (const f of files) {
      if (!fileToSourcePrs.has(f.filename)) fileToSourcePrs.set(f.filename, []);
      fileToSourcePrs.get(f.filename).push(prNum);
    }
  }

  const headShaByPr = new Map();
  for (const prNum of sourcePrNumbers) {
    const pr = await getPull(owner, repo, prNum, token);
    headShaByPr.set(prNum, pr.head.sha);
  }

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

async function githubGet(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ci-integrate-guard',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${path}: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function listPullFiles(owner, repo, pullNumber, token) {
  const files = [];
  let page = 1;
  for (;;) {
    const batch = await githubGet(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100&page=${page}`,
      token,
    );
    if (!Array.isArray(batch) || !batch.length) break;
    files.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return files;
}

async function getPull(owner, repo, pullNumber, token) {
  return githubGet(`/repos/${owner}/${repo}/pulls/${pullNumber}`, token);
}

async function fetchBlobUtf8(owner, repo, path, ref, token) {
  try {
    const data = await githubGet(
      `/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
      token,
    );
    if (!data || data.type !== 'file' || !data.content) return null;
    return Buffer.from(data.content, data.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
  } catch (e) {
    if (String(e.message).includes('404')) return null;
    throw e;
  }
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
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
