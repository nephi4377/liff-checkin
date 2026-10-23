'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, parseVersionToken, isVersionLower } = require('../lib/version');
const { extractCacheBustRefs } = require('../lib/cache-bust');
const { regressionsInFile } = require('../lib/regression');
const fs = require('fs');
const path = require('path');

describe('version', () => {
  it('parses dotted versions', () => {
    assert.equal(parseVersionToken('26.10.13.1'), '26.10.13.1');
    assert.equal(parseVersionToken('22extra'), '22');
    assert.equal(parseVersionToken(''), null);
  });

  it('compares segment-wise numerically', () => {
    assert.ok(compareVersions('22', '20') > 0);
    assert.ok(compareVersions('20', '22') < 0);
    assert.equal(compareVersions('26.10.13.1', '26.10.13.1'), 0);
    assert.ok(compareVersions('26.10.14', '26.10.13.1') > 0);
    assert.ok(compareVersions('9', '10') < 0);
  });

  it('isVersionLower', () => {
    assert.equal(isVersionLower('20', '22'), true);
    assert.equal(isVersionLower('22', '20'), false);
    assert.equal(isVersionLower('22', '22'), false);
  });
});

describe('extractCacheBustRefs', () => {
  it('handles quotes, ampersand, hash, backtick', () => {
    const html = [
      '<script src="../../shared/js/a.js?v=1"></script>',
      "<link href='b.css?v=2&x=1'>",
      'x = `c.js?v=3`',
      'd.js?v=4#frag',
      'e.js?v=5 ',
    ].join('\n');
    const refs = extractCacheBustRefs(html);
    assert.equal(refs.get('../../shared/js/a.js'), '1');
    assert.equal(refs.get('b.css'), '2');
    assert.equal(refs.get('c.js'), '3');
    assert.equal(refs.get('d.js'), '4');
    assert.equal(refs.get('e.js'), '5');
  });
});

describe('regression detector', () => {
  it('flags v=22 -> v=20 on same asset', () => {
    const base = '<script src="../../shared/js/accounting_lightbox.js?v=22"></script>';
    const head = '<script src="../../shared/js/accounting_lightbox.js?v=20"></script>';
    const rows = regressionsInFile('modules/accounting/ledger_history.html', base, head);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].asset, '../../shared/js/accounting_lightbox.js');
    assert.equal(rows[0].baseVersion, '22');
    assert.equal(rows[0].headVersion, '20');
  });

  it('allows equal or higher head version', () => {
    const base = 'a.js?v=20';
    const headHigh = 'a.js?v=22';
    const headEq = 'a.js?v=20';
    assert.equal(regressionsInFile('f.html', base, headHigh).length, 0);
    assert.equal(regressionsInFile('f.html', base, headEq).length, 0);
  });

  it('ignores new assets only on head', () => {
    const base = 'a.js?v=1';
    const head = 'a.js?v=1\nb.js?v=99';
    assert.equal(regressionsInFile('f.html', base, head).length, 0);
  });

  it('fixture ledger v22 -> v20', () => {
    const dir = path.join(__dirname, 'fixtures');
    const base = fs.readFileSync(path.join(dir, 'ledger-base-v22.html'), 'utf8');
    const head = fs.readFileSync(path.join(dir, 'ledger-head-v20.html'), 'utf8');
    assert.equal(regressionsInFile('ledger_history.html', base, head).length, 1);
  });
});

describe('integrates block', () => {
  const { parseIntegratesPrNumbers } = require('../lib/integrates-block');

  it('parses integrates fence', () => {
    const body = 'Hi\n```integrates\n#182 #185\n```\n';
    assert.deepEqual(parseIntegratesPrNumbers(body), [182, 185]);
  });

  it('parses integrates: line in generic fence', () => {
    const body = '```text\nintegrates: #209 #210\n```';
    assert.deepEqual(parseIntegratesPrNumbers(body), [209, 210]);
  });
});
