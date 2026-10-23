/**
 * Shared cache-bust (?v=) assertions for accounting HTML smoke tests.
 */
'use strict';

var RE = {
  accountingApi: /(?:^|["'\/])accounting_api\.js\?v=(\d+)(?=["'&])/g,
  accountingShell: /(?:^|["'\/])accounting_shell\.js\?v=(\d+)(?=["'&])/g,
  accountingTaxMode: /(?:^|["'\/])accounting_tax_mode\.js\?v=(\d+)(?=["'&])/g,
  hubAppJs: /(?:^|["'\/])app\.js\?v=([\w.+-]+)(?=["'&])/g
};

var HUB_APP_JS_MIN_TOKEN = '26.10.13.1';

function globalRe(assetRe) {
  if (assetRe.global) return assetRe;
  return new RegExp(assetRe.source, assetRe.flags + 'g');
}

function extractAllCacheBustVers(html, assetRe) {
  var s = String(html || '');
  var re = globalRe(assetRe);
  var vers = [];
  var m;
  re.lastIndex = 0;
  while ((m = re.exec(s)) !== null) {
    vers.push(m[1]);
  }
  return vers;
}

/** @deprecated use extractAllCacheBustVers */
function extractCacheBustVer(html, assetRe) {
  var all = extractAllCacheBustVers(html, assetRe);
  return all.length ? all[0] : null;
}

function compareDottedVersion(actual, minimum) {
  var aParts = String(actual).split('.');
  var mParts = String(minimum).split('.');
  var len = Math.max(aParts.length, mParts.length);
  for (var i = 0; i < len; i++) {
    var av = parseInt(aParts[i] || '0', 10);
    var mv = parseInt(mParts[i] || '0', 10);
    if (isNaN(av) || isNaN(mv)) return false;
    if (av > mv) return true;
    if (av < mv) return false;
  }
  return true;
}

function assertNumericCacheBust(html, assetRe, msg, minVer) {
  var vers = extractAllCacheBustVers(html, assetRe);
  if (!vers.length) {
    throw new Error((msg || 'expected numeric ?v= cache bust') + ' (no match)');
  }
  vers.forEach(function (v, i) {
    var suffix = vers.length > 1 ? ' match #' + i : '';
    if (!/^\d+$/.test(v)) {
      throw new Error((msg || 'expected numeric ?v= cache bust') + suffix + ', got ' + JSON.stringify(v));
    }
    if (minVer != null && Number(v) < minVer) {
      throw new Error(
        (msg || 'expected numeric ?v= cache bust') + suffix + ': v=' + v + ' below min ' + minVer
      );
    }
  });
  return vers[0];
}

function assertCacheBustToken(html, assetRe, msg, minToken) {
  var vers = extractAllCacheBustVers(html, assetRe);
  if (!vers.length) {
    throw new Error((msg || 'expected ?v= cache bust token') + ' (no match)');
  }
  var floor = minToken != null ? minToken : (assetRe === RE.hubAppJs ? HUB_APP_JS_MIN_TOKEN : null);
  vers.forEach(function (v, i) {
    var suffix = vers.length > 1 ? ' match #' + i : '';
    if (!/^[\w.+-]+$/.test(v)) {
      throw new Error((msg || 'expected ?v= cache bust token') + suffix + ', got ' + JSON.stringify(v));
    }
    if (floor != null && !compareDottedVersion(v, floor)) {
      throw new Error(
        (msg || 'expected ?v= cache bust token') + suffix + ': v=' + v + ' below min ' + floor
      );
    }
  });
  return vers[0];
}

function assertSameNumericCacheBust(htmls, assetRe, msg, minVer) {
  var vers = (htmls || []).map(function (h, i) {
    try {
      return assertNumericCacheBust(h, assetRe, msg, minVer);
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

function runSelfTests() {
  var threw;

  threw = false;
  try {
    assertNumericCacheBust(
      '<script src="../../shared/js/accounting_api.js?v=1"></script>',
      RE.accountingApi,
      'self v=1',
      102
    );
  } catch (e) {
    threw = true;
    if (e.message.indexOf('v=1') < 0 || e.message.indexOf('102') < 0) {
      throw new Error('self-test v=1: unexpected message: ' + e.message);
    }
  }
  if (!threw) throw new Error('self-test: v=1 should fail minVer 102');

  var oldOnly = extractAllCacheBustVers('old_accounting_api.js?v=999', RE.accountingApi);
  if (oldOnly.length !== 0) {
    throw new Error('self-test: old_accounting_api.js?v=999 must not match accounting_api RE');
  }

  threw = false;
  try {
    assertSameNumericCacheBust(
      [
        'src="accounting_api.js?v=1"',
        'src="accounting_api.js?v=1"'
      ],
      RE.accountingApi,
      'self rollback',
      108
    );
  } catch (e) {
    threw = true;
    if (e.message.indexOf('v=1') < 0) {
      throw new Error('self-test rollback: unexpected message: ' + e.message);
    }
  }
  if (!threw) throw new Error('self-test: same v=1 both pages should fail minVer 108');

  threw = false;
  try {
    assertCacheBustToken('src="./spa/app.js?v=0"', RE.hubAppJs, 'self hub v=0', HUB_APP_JS_MIN_TOKEN);
  } catch (e) {
    threw = true;
    if (e.message.indexOf('v=0') < 0 || e.message.indexOf(HUB_APP_JS_MIN_TOKEN) < 0) {
      throw new Error('self-test hub v=0: unexpected message: ' + e.message);
    }
  }
  if (!threw) throw new Error('self-test: app.js v=0 should fail min token');

  var fooApp = extractAllCacheBustVers('foo_app.js?v=99', RE.hubAppJs);
  if (fooApp.length !== 0) {
    throw new Error('self-test: foo_app.js must not match hub app.js RE');
  }

  var multi = extractAllCacheBustVers(
    'src="a/accounting_api.js?v=50" src="b/accounting_api.js?v=60"',
    RE.accountingApi
  );
  if (multi.length !== 2 || multi[0] !== '50' || multi[1] !== '60') {
    throw new Error('self-test: expected two anchored accounting_api matches');
  }
}

module.exports = {
  RE: RE,
  HUB_APP_JS_MIN_TOKEN: HUB_APP_JS_MIN_TOKEN,
  extractCacheBustVer: extractCacheBustVer,
  extractAllCacheBustVers: extractAllCacheBustVers,
  compareDottedVersion: compareDottedVersion,
  assertNumericCacheBust: assertNumericCacheBust,
  assertCacheBustToken: assertCacheBustToken,
  assertSameNumericCacheBust: assertSameNumericCacheBust,
  runSelfTests: runSelfTests
};

if (require.main === module) {
  runSelfTests();
  console.log('test-cache-bust-helper self-tests: OK');
}
