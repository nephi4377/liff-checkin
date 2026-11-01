#!/usr/bin/env node
'use strict';

/**
 * CI integration guard — cache-bust regression + optional provenance.
 * Usage:
 *   node tools/ci-integrate-guard/run.js --base origin/main --head HEAD
 *   node tools/ci-integrate-guard/run.js --event "$GITHUB_EVENT_PATH"
 */
const { readFileSync } = require('fs');
const {
  regressionsInFile,
  formatRegressionTable,
  dedupeRegressionRows,
} = require('./lib/regression');
const { listChangedHtmlJs, readFileAtRef, git } = require('./lib/git');
const { parseIntegratesPrNumbers, parseIntegratesList } = require('./lib/integrates-block');
const { checkProvenance, formatProvenanceWarnings } = require('./lib/provenance');
const { fetchIntegratesCacheBustRegressions } = require('./lib/source-ceiling');
const { loadSourcePrIndex } = require('./lib/github-api');

function parseArgs(argv) {
  const opts = {
    base: 'origin/main',
    head: 'HEAD',
    eventPath: null,
    repoRoot: process.cwd(),
    skipProvenance: false,
    integratesText: null,
    owner: null,
    repo: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--head') opts.head = argv[++i];
    else if (a === '--event') opts.eventPath = argv[++i];
    else if (a === '--repo-root') opts.repoRoot = argv[++i];
    else if (a === '--skip-provenance') opts.skipProvenance = true;
    else if (a === '--integrates') opts.integratesText = argv[++i];
    else if (a === '--owner') opts.owner = argv[++i];
    else if (a === '--repo') opts.repo = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node tools/ci-integrate-guard/run.js [options]
  --base <ref>       Base ref (default origin/main)
  --head <ref>       Head ref (default HEAD)
  --event <path>     GitHub event JSON (pull_request)
  --integrates <s>   Source PR list (e.g. "#188 #182") for integration ceiling check
  --owner / --repo   GitHub repo (default from GITHUB_REPOSITORY)
  --repo-root <dir>  Repository root
  --skip-provenance  Only cache-bust checks`);
      process.exit(0);
    }
  }
  return opts;
}

function loadEvent(eventPath) {
  const raw = readFileSync(eventPath, 'utf8');
  return JSON.parse(raw);
}

function resolveRepo(opts) {
  if (opts.owner && opts.repo) return { owner: opts.owner, repo: opts.repo };
  const envRepo = process.env.GITHUB_REPOSITORY;
  if (envRepo && envRepo.includes('/')) {
    const [owner, repo] = envRepo.split('/');
    return { owner, repo };
  }
  return { owner: 'nephi4377', repo: 'liff-checkin' };
}

async function main() {
  const opts = parseArgs(process.argv);
  let baseRef = opts.base;
  let headRef = opts.head;
  let prBody = '';
  let owner = null;
  let repo = null;

  if (opts.eventPath) {
    const event = loadEvent(opts.eventPath);
    const pr = event.pull_request;
    if (!pr) {
      console.error('Event is not a pull_request; nothing to do.');
      process.exit(1);
    }
    baseRef = pr.base.sha;
    headRef = pr.head.sha;
    prBody = pr.body || '';
    const parts = pr.base.repo.full_name.split('/');
    owner = parts[0];
    repo = parts[1];
  } else {
    const resolved = resolveRepo(opts);
    owner = resolved.owner;
    repo = resolved.repo;
  }

  const sourcePrsFromBody = prBody ? parseIntegratesPrNumbers(prBody) : [];
  const sourcePrsFromCli = opts.integratesText ? parseIntegratesList(opts.integratesText) : [];
  const sourcePrs = sourcePrsFromBody.length ? sourcePrsFromBody : sourcePrsFromCli;
  const integratesMode = sourcePrs.length > 0;

  const changedHtmlJs = listChangedHtmlJs(baseRef, headRef, opts.repoRoot);
  let allRegressions = [];

  for (const file of changedHtmlJs) {
    const baseContent = readFileAtRef(baseRef, file, opts.repoRoot);
    const headContent = readFileAtRef(headRef, file, opts.repoRoot);
    if (baseContent === null || headContent === null) continue;
    allRegressions.push(...regressionsInFile(file, baseContent, headContent));
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  let sourceIndex = null;

  if (integratesMode) {
    if (!token) {
      console.error(
        'integrates block requires GITHUB_TOKEN (or GH_TOKEN) to compare source PR cache-bust ceilings.',
      );
      process.exit(1);
    }
    const integratesRows = await fetchIntegratesCacheBustRegressions({
      owner,
      repo,
      token,
      sourcePrNumbers: sourcePrs,
      changedHtmlJs,
      baseRef,
      headRef,
      readFileAtRef,
      repoRoot: opts.repoRoot,
    });
    allRegressions = dedupeRegressionRows([...allRegressions, ...integratesRows]);
    sourceIndex = await loadSourcePrIndex(owner, repo, sourcePrs, token);
    console.log(
      formatRegressionTable(allRegressions, { integratesMode: true }),
    );
    console.log('');
    console.log(
      `Checked ${changedHtmlJs.length} changed HTML/JS file(s) (main + ${sourcePrs.length} source PR ceiling).`,
    );
  } else {
    console.log(formatRegressionTable(allRegressions));
    console.log('');
    console.log(`Checked ${changedHtmlJs.length} changed HTML/JS file(s) between ${baseRef} and ${headRef}.`);
  }

  if (!opts.skipProvenance && integratesMode && token) {
    const integrationChangedFiles = git(
      ['diff', '--name-only', `${baseRef}...${headRef}`],
      opts.repoRoot,
    )
      .split('\n')
      .filter(Boolean);
    const headContents = new Map();
    for (const f of integrationChangedFiles) {
      const c = readFileAtRef(headRef, f, opts.repoRoot);
      if (c !== null) headContents.set(f, c);
    }
    const warnings = await checkProvenance({
      owner,
      repo,
      sourcePrNumbers: sourcePrs,
      changedFiles: integrationChangedFiles,
      headContents,
      token,
      sourceIndex,
    });
    console.log('');
    console.log(formatProvenanceWarnings(warnings));
  }

  if (allRegressions.length) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
