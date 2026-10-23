/**
 * Shared cache-bust (?v=) assertions for accounting HTML smoke tests.
 */
'use strict';

var RE = {
  accountingApi: /accounting_api\.js\?v=(\d+)/,
  accountingShell: /accounting_shell\.js\?v=(\d+)/,
  accountingTaxMode: /accounting_tax_mode\.js\?v=(\d+)/,
  hubAppJs: /app\.js\?v=([\w.+-]+)/
};

function extractCacheBustVer(html, assetRe) {
  var m = String(html || '').match(assetRe);
  return m ? m[1] : null;
}

function assertNumericCacheBust(html, assetRe, msg) {
  var v = extractCacheBustVer(html, assetRe);
  if (!v || !/^\d+$/.test(v)) {
    throw new Error(msg || 'expected numeric ?v= cache bust');
  }
  return v;
}

function assertCacheBustToken(html, assetRe, msg) {
  var v = extractCacheBustVer(html, assetRe);
  if (!v || !/^[\w.+-]+$/.test(v)) {
    throw new Error(msg || 'expected ?v= cache bust token');
  }
  return v;
}

function assertSameNumericCacheBust(htmls, assetRe, msg) {
  var vers = (htmls || []).map(function (h, i) {
    try {
      return assertNumericCacheBust(h, assetRe, msg);
    } catch (e) {
      throw new Error((msg || 'asset') + ' page ' + i + ': ' + e.message);
    }
  });
  if (!vers.length) throw new Error(msg || 'no pages to compare');
  if (new Set(vers).size !== 1) {
    throw new Error((msg || 'asset') + ' version mismatch: ' + vers.join(', '));
  }
  return vers[0];
}

module.exports = {
  RE: RE,
  extractCacheBustVer: extractCacheBustVer,
  assertNumericCacheBust: assertNumericCacheBust,
  assertCacheBustToken: assertCacheBustToken,
  assertSameNumericCacheBust: assertSameNumericCacheBust
};
