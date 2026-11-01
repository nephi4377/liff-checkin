'use strict';

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
 * @param {string} owner
 * @param {string} repo
 * @param {number[]} sourcePrNumbers
 * @param {string} token
 */
async function loadSourcePrIndex(owner, repo, sourcePrNumbers, token) {
  const fileToSourcePrs = new Map();
  const headShaByPr = new Map();

  for (const prNum of sourcePrNumbers) {
    const pr = await getPull(owner, repo, prNum, token);
    headShaByPr.set(prNum, pr.head.sha);
    const files = await listPullFiles(owner, repo, prNum, token);
    for (const f of files) {
      if (!fileToSourcePrs.has(f.filename)) fileToSourcePrs.set(f.filename, []);
      fileToSourcePrs.get(f.filename).push(prNum);
    }
  }

  return { fileToSourcePrs, headShaByPr };
}

module.exports = {
  listPullFiles,
  getPull,
  fetchBlobUtf8,
  loadSourcePrIndex,
};
