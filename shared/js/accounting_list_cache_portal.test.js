'use strict';

var mem = { store: {} };
function makeStorage() {
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem.store, k) ? mem.store[k] : null; },
    setItem: function (k, v) { mem.store[k] = String(v); },
    removeItem: function (k) { delete mem.store[k]; },
    key: function (i) { return Object.keys(mem.store)[i] || null; },
    get length() { return Object.keys(mem.store).length; }
  };
}
global.localStorage = makeStorage();
global.sessionStorage = makeStorage();

var Cache = require('./accounting_list_cache.js');
var session = { auth: { user_id: 'test-guest' } };

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(Cache.isUsablePortalPayload({ success: true, receipts: [] }) === true, 'empty success is usable');
assert(Cache.isUsablePortalPayload({ success: false, message: 'x' }) === false, 'fail is not usable');
assert(Cache.isUsablePortalPayload(null) === false, 'null is not usable');

(async function () {
  mem.store = {};
  var wroteFail = false;
  var origSet = global.localStorage.setItem;
  global.localStorage.setItem = function (k, v) {
    if (String(v).indexOf('"success":false') >= 0) wroteFail = true;
    return origSet.call(global.localStorage, k, v);
  };

  var failRes = await Cache.loadPortalData(session, '999', function () {
    return Promise.resolve({ success: false, message: 'boom' });
  });
  assert(failRes && failRes.success === false, 'returns fail payload');
  assert(wroteFail === false, 'must not persist fail payload');

  var okRes = await Cache.loadPortalData(session, '999', function () {
    return Promise.resolve({ success: true, receipts: [{ receipt_id: 'r1' }] });
  }, { force: true });
  assert(okRes && okRes.success === true && okRes.receipts.length === 1, 'success payload returned');

  var cached = await Cache.loadPortalData(session, '999', function () {
    throw new Error('should not refetch fresh success');
  });
  assert(cached.receipts[0].receipt_id === 'r1', 'fresh success is reused');

  mem.store = {};
  global.localStorage.setItem('tanxin_acct_master_list_v1:test-guest:portal:888', JSON.stringify({
    ts: Date.now(),
    data: { success: false, message: 'stale fail' }
  }));
  var refetched = await Cache.loadPortalData(session, '888', function () {
    return Promise.resolve({ success: true, receipts: [] });
  });
  assert(refetched.success === true && Array.isArray(refetched.receipts), 'stale fail cache is skipped');

  console.log('accounting_list_cache portal persist: ok');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
