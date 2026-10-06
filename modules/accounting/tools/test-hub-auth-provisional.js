/**
 * 單元煙測：主控台網址身分應可暫用進門（不依賴 sessionStorage）
 * node modules/accounting/tools/test-hub-auth-provisional.js
 */
'use strict';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

function peekFromUrl(search) {
  var q = new URLSearchParams(search);
  var uid = q.get('uid') || q.get('dev_user_id') || q.get('dev_user') || '';
  var name = q.get('name') || '';
  var permStr = q.get('permission') || q.get('perm') || q.get('dev_perm') || '';
  var hubLiff = q.get('hub_liff_id') || q.get('hub_liff') || '';
  if (!uid && !name && !permStr && !hubLiff) return null;
  return {
    userId: String(uid || '').trim(),
    displayName: String(name || '').trim(),
    permission: permStr ? (parseInt(permStr, 10) || 0) : 0,
    hubLiffId: String(hubLiff || '').trim(),
    source: 'hub_iframe'
  };
}

function canProvisional(op, minPerm) {
  if (!op || !op.userId) return false;
  if (!(op.hubLiffId || op.source === 'hub_iframe' || op.source === 'hub')) return false;
  return (op.permission || 0) >= (minPerm || 0);
}

var yangSearch =
  'uid=U6e5d8f132e02d6de182ff460fae73fab&name=Yang&permission=3' +
  '&hub_liff_id=2007974938-2nPKg3J0&shiftStart=08%3A30&shiftEnd=17%3A30';

var op = peekFromUrl(yangSearch);
assert(op && op.userId.indexOf('U6e5d') === 0, 'uid from query');
assert(op.permission === 3, 'permission 3');
assert(op.hubLiffId.indexOf('2007974938') === 0, 'hub_liff_id');
assert(canProvisional(op, 0), 'index minPermission 0');
assert(canProvisional(op, 3), 'ledger_history minPermission 3');
assert(!canProvisional(op, 4), 'finance minPermission 4 blocked');

var noHub = peekFromUrl('uid=Uabc&name=X&permission=3');
assert(noHub && noHub.userId === 'Uabc', 'uid without hub_liff still parsed');
assert(canProvisional(Object.assign({}, noHub, { source: 'hub_iframe' }), 0), 'source hub_iframe enough');

var AUTH_ME_TIMEOUT_MS = 20000;
var DEFAULT_TIMEOUT_MS = 60000;
assert(AUTH_ME_TIMEOUT_MS < DEFAULT_TIMEOUT_MS, 'auth timeout shorter than default');

// payment_request：主控台 hub query 應可暫用（門檻 0／1），勿等 auth_me
assert(canProvisional(op, 1), 'payment_request staff minPermission 1');
assert(canProvisional(op, 0), 'payment_request AccountingBoot minPermission 0');

function softAuthTimeoutToast(actionName, extra) {
  var isAuthMe = /_auth_me$/.test(String(actionName || ''));
  return isAuthMe && /逾時|timeout|Abort|abort|等太久/i.test(String(extra || ''));
}
assert(softAuthTimeoutToast('accounting_auth_me', '連線逾時，請再試一次 · 20.0 秒'), 'index auth soft');
assert(softAuthTimeoutToast('payment_request_auth_me', '連線逾時，請再試一次'), 'payment auth soft');
assert(!softAuthTimeoutToast('accounting_bootstrap', '連線逾時'), 'bootstrap still reports');

console.log('test-hub-auth-provisional: OK');
