#!/usr/bin/env node
'use strict';

/**
 * CI integration guard — cache-bust regression + optional provenance.
 * Usage:
 *   node tools/ci-integrate-guard/run.js --base origin/main --head HEAD
 *   node tools/ci-integrate-guard/run.js --event "$GITHUB_EVENT_PATH"
 */
const { readFileSync } = require('fs');
const { regressionsInFile, formatRegressionTable } = require('./lib/regression');
const { listChangedHtmlJs, readFileAtRef, git } = require('./lib/git');
const { parseIntegratesPrNumbers } = require('./lib/integrates-block');
const { checkProvenance, formatProvenanceWarnings } = require('./lib/provenance');

function parseArgs(argv) {
  const opts = {
    base: 'origin/main',
    head: 'HEAD',
    eventPath: null,
    repoRoot: process.cwd(),
    skipProvenance: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--head') opts.head = argv[++i];
    else if (a === '--event') opts.eventPath = argv[++i];
    else if (a === '--repo-root') opts.repoRoot = argv[++i];
    else if (a === '--skip-provenance') opts.skipProvenance = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node tools/ci-integrate-guard/run.js [options]
  --base <ref>       Base ref (default origin/main)
  --head <ref>       Head ref (default HEAD)
  --event <path>     GitHub event JSON (pull_request)
  --repo-root <dir>  Repository root
  --skip-provenance  Only cache-bust check`);
      process.exit(0);
    }
  }
  return opts;
}

function loadEvent(eventPath) {
  const raw = readFileSync(eventPath, 'utf8');
  return JSON.parse(raw);
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
  }

  const changedHtmlJs = listChangedHtmlJs(baseRef, headRef, opts.repoRoot);
  const allRegressions = [];

  for (const file of changedHtmlJs) {
    const baseContent = readFileAtRef(baseRef, file, opts.repoRoot);
    const headContent = readFileAtRef(headRef, file, opts.repoRoot);
    if (baseContent === null || headContent === null) continue;
    allRegressions.push(...regressionsInFile(file, baseContent, headContent));
  }

  console.log(formatRegressionTable(allRegressions));
  console.log('');
  console.log(`Checked ${changedHtmlJs.length} changed HTML/JS file(s) between ${baseRef} and ${headRef}.`);

  if (!opts.skipProvenance && prBody) {
    const sourcePrs = parseIntegratesPrNumbers(prBody);
    if (sourcePrs.length) {
      const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
      if (!token) {
        console.warn('Skipping provenance: no GITHUB_TOKEN (integrates block present).');
      } else if (owner && repo) {
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
        });
        console.log('');
        console.log(formatProvenanceWarnings(warnings));
      }
    }
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
