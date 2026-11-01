'use strict';

const { execFileSync } = require('child_process');

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

/**
 * @param {string} baseRef
 * @param {string} headRef
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
function listChangedHtmlJs(baseRef, headRef, repoRoot = process.cwd()) {
  const out = git(['diff', '--name-only', `${baseRef}...${headRef}`, '--', '*.html', '*.js'], repoRoot);
  if (!out) return [];
  return out.split('\n').filter(Boolean);
}

/**
 * @param {string} ref
 * @param {string} filePath
 * @param {string} [repoRoot]
 * @returns {string|null} null if file missing at ref
 */
function readFileAtRef(ref, filePath, repoRoot = process.cwd()) {
  try {
    return git(['show', `${ref}:${filePath}`], repoRoot);
  } catch {
    return null;
  }
}

module.exports = {
  git,
  listChangedHtmlJs,
  readFileAtRef,
};
