/**
 * Read ?v= cache-bust from HTML (or any text) for smoke tests.
 */
function readCacheBustVersion(text, assetSubstring) {
  if (!text || !assetSubstring) return null;
  var escaped = String(assetSubstring).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var re = new RegExp(escaped + '\\?v=([^"\'\\s>]+)');
  var m = String(text).match(re);
  return m ? m[1] : null;
}

function assertApiCacheBust(html, minNumeric) {
  var v = readCacheBustVersion(html, 'accounting_api.js');
  if (!v) return { ok: false, reason: 'missing accounting_api.js?v=' };
  var n = parseInt(String(v).replace(/[^0-9].*$/, ''), 10);
  if (minNumeric != null && (!isFinite(n) || n < minNumeric)) {
    return { ok: false, reason: 'accounting_api.js?v=' + v + ' < ' + minNumeric };
  }
  return { ok: true, version: v };
}

module.exports = {
  readCacheBustVersion: readCacheBustVersion,
  assertApiCacheBust: assertApiCacheBust
};
