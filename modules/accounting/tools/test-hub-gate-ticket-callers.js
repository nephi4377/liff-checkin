/**
 * 呼叫端：主控台（Hub）只帶 user_id 的會計 GAS 呼叫要附 hub_gate_ticket（Backend_GAS #377 盤點）
 * node modules/accounting/tools/test-hub-gate-ticket-callers.js
 *
 * - 真的載入 shared/js/accounting_api.js（vm 沙盒），看送到 accounting-gas 的 body
 * - spa/app.js、SketchUp 渲染工作室：原始碼契約檢查
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var root = path.resolve(__dirname, '../../..');
var HubGateTicket = null;
try {
  HubGateTicket = require(path.join(root, 'shared/js/hub_gate_ticket.js'));
} catch (eLib) {
  console.warn('(shared/js/hub_gate_ticket.js 不存在：以下檢查會顯示目前未帶票)');
}
var apiSrc = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

var UID = 'U1234567890abcdef1234567890abcd';
var ACCOUNTING_GAS_HOST = 'AKfycbyibVTQk2eYEYXX5vb';
var CONSOLE_HOST = 'AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function liffToken(expSec) {
  return b64url({ alg: 'HS256' }) + '.' + b64url({ sub: UID, exp: expSec }) + '.sig';
}
function memStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; }
  };
}
function jsonRes(obj) {
  var text = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Promise.resolve({ status: 200, text: function () { return Promise.resolve(text); } });
}

/**
 * @param {{ parentToken?: string, consoleFails?: boolean, noLib?: boolean }} opts
 */
function loadApi(opts) {
  opts = opts || {};
  var gasCalls = [];
  var consoleCalls = [];
  var warns = [];
  var storage = memStorage();
  var nowSec = Math.floor(Date.now() / 1000);
  function fakeFetch(url, init) {
    var body = JSON.parse(init.body);
    if (String(url).indexOf(CONSOLE_HOST) >= 0) {
      consoleCalls.push(body);
      if (opts.consoleFails) return jsonRes({ success: false, message: 'LIFF 驗證失敗' });
      return jsonRes({
        success: true,
        hub_gate_ticket: b64url({ uid: UID, exp: nowSec + 120, purpose: 'hub_gate' }) + '.SIG',
        user_id: UID,
        expires_in_sec: 120
      });
    }
    if (String(url).indexOf(ACCOUNTING_GAS_HOST) >= 0) {
      gasCalls.push(body);
      return jsonRes({ success: true, user_id: UID, permission: 5, display_name: 'T', items: [] });
    }
    throw new Error('unexpected url ' + url);
  }
  var logger = {
    log: function () {},
    info: function () {},
    error: function () {},
    warn: function () { warns.push(Array.prototype.join.call(arguments, ' ')); }
  };
  var sandbox = {
    console: logger,
    fetch: fakeFetch,
    sessionStorage: storage,
    localStorage: memStorage(),
    location: { search: '', hostname: 'info.tanxin.space', href: 'https://info.tanxin.space/modules/accounting/index.html' },
    URLSearchParams: URLSearchParams,
    URL: URL,
    AbortController: AbortController,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    JSON: JSON,
    Date: Date,
    Math: Math,
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); }
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.top = sandbox;
  if (!opts.noLib && HubGateTicket) {
    var client = HubGateTicket.create({
      fetch: fakeFetch,
      storage: storage,
      logger: logger,
      getLiffToken: function () { return Promise.resolve(opts.parentToken || ''); }
    });
    sandbox.HubGateTicket = Object.assign(client, { create: HubGateTicket.create });
  }
  vm.createContext(sandbox);
  vm.runInContext(apiSrc, sandbox, { filename: 'accounting_api.js' });
  return { api: sandbox.AccountingApi, gasCalls: gasCalls, consoleCalls: consoleCalls, warns: warns };
}

function hubSession() {
  return {
    fromHub: true,
    devBypass: false,
    idToken: '',
    profile: { userId: UID, displayName: 'T' },
    auth: { user_id: UID, display_name: 'T', permission: 5 }
  };
}

function ticketOf(body) {
  return body.hub_gate_ticket || (body.auth && body.auth.hub_gate_ticket) || '';
}

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('accounting_api：Hub 模式 authMe／crud／錯誤回報／請款／存摺 OCR 都帶票', async function () {
  var t = loadApi({ parentToken: liffToken(Math.floor(Date.now() / 1000) + 3600) });
  var s = hubSession();
  await t.api.authMe(s);
  await t.api.crudList(s, 'vendor', {});
  await t.api.reportError(s, { page: 'x', message: 'boom' });
  await t.api.vendorPaymentList(s, 'pending_review');
  await t.api.employeeBankOcr(s, { kind: 'passbook' }, 'passbook', UID);
  await t.api.clientLog(s, { page: 'x', summary: 'y' });
  assert.strictEqual(t.gasCalls.length, 6, 'six GAS calls');
  t.gasCalls.forEach(function (b) {
    assert.ok(ticketOf(b), b.action + ' carries hub_gate_ticket');
  });
  var ocr = t.gasCalls.filter(function (b) { return b.action === 'employee_bank_ocr'; })[0];
  assert.strictEqual(ocr.operatorUserId, UID);
  assert.ok(ocr.hub_gate_ticket, 'employee_bank_ocr top-level ticket (hub_operator path)');
  assert.strictEqual(t.consoleCalls.length, 1, 'ticket fetched once and cached');
  assert.strictEqual(t.consoleCalls[0].action, 'accounting_hub_gate_ticket');
});

test('accounting_api：Hub 驗證核心（initStaffSession forceAuth）帶票', async function () {
  var t = loadApi({ parentToken: liffToken(Math.floor(Date.now() / 1000) + 3600) });
  var body = { action: 'payment_request_auth_me', user_id: UID, auth: { user_id: UID } };
  await t.api.post(body);
  assert.ok(ticketOf(t.gasCalls[0]), 'post() attaches');
  assert.strictEqual(body.hub_gate_ticket, undefined, 'caller body not mutated');
  assert.strictEqual(body.auth.hub_gate_ticket, undefined, 'caller auth not mutated');
});

test('accounting_api：沒有 user_id 的呼叫（accounting_policy）不取票', async function () {
  var t = loadApi({ parentToken: liffToken(Math.floor(Date.now() / 1000) + 3600) });
  await t.api.post({ action: 'accounting_policy' });
  assert.strictEqual(t.consoleCalls.length, 0);
  assert.strictEqual(ticketOf(t.gasCalls[0]), '');
});

test('accounting_api：取不到 token 時照常送出、console 有 [HubGateTicket][WARN]', async function () {
  var t = loadApi({ parentToken: '' });
  var res = await t.api.authMe(hubSession());
  assert.ok(res && res.success, 'request still succeeds');
  assert.strictEqual(t.gasCalls.length, 1);
  assert.strictEqual(ticketOf(t.gasCalls[0]), '');
  assert.ok(t.warns.some(function (w) { return /\[HubGateTicket\]\[WARN\]/.test(w); }), 'warn logged');
});

test('accounting_api：主控台拒絕發票時照常送出', async function () {
  var t = loadApi({ parentToken: liffToken(Math.floor(Date.now() / 1000) + 3600), consoleFails: true });
  var res = await t.api.crudList(hubSession(), 'vendor', {});
  assert.ok(res && res.success);
  assert.strictEqual(ticketOf(t.gasCalls[0]), '');
});

test('accounting_api：hub_gate_ticket.js 載不到時照常送出並警告', async function () {
  var t = loadApi({ noLib: true });
  var res = await t.api.authMe(hubSession());
  assert.ok(res && res.success);
  assert.strictEqual(t.gasCalls.length, 1);
  assert.ok(t.warns.some(function (w) { return /\[HubGateTicket\]\[WARN\]/.test(w); }), 'lib-missing warn');
});

test('accounting_ingest.html：所有 user_id 呼叫都走 AccountingApi.post（自動帶票）', function () {
  var html = fs.readFileSync(path.join(root, 'modules/accounting/accounting_ingest.html'), 'utf8');
  assert.ok(/shared\/js\/accounting_api\.js/.test(html), 'loads accounting_api.js');
  assert.ok(!/\bfetch\s*\(/.test(html), 'no direct fetch to GAS');
  assert.ok(/AccountingApi\.post\(body\)/.test(html), 'uses AccountingApi.post');
});

test('主控台首頁 index.html 先載 hub_gate_ticket.js 再載 spa/app.js', function () {
  var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  var iLib = html.indexOf('shared/js/hub_gate_ticket.js');
  var iApp = html.indexOf('spa/app.js');
  assert.ok(iLib > 0, 'index loads hub_gate_ticket.js');
  assert.ok(iLib < iApp, 'before app.js');
});

test('spa/app.js 款項待辦：送 vendor_payment_list 前附票', function () {
  var src = fs.readFileSync(path.join(root, 'spa/app.js'), 'utf8');
  var start = src.indexOf('const fetchPaymentTodos');
  var end = src.indexOf('const refreshPaymentTodosInBackground');
  assert.ok(start > 0 && end > start, 'find fetchPaymentTodos');
  var fn = src.slice(start, end);
  var iAttach = fn.indexOf('HubGateTicket');
  var iList = fn.indexOf("action: 'vendor_payment_list'");
  assert.ok(iAttach > 0, 'uses HubGateTicket');
  assert.ok(/\.attach\(auth/.test(fn), 'attaches to auth');
  assert.ok(iAttach < iList, 'attach before list requests');
});

test('SketchUp 渲染工作室：載入 hub_gate_ticket.js，apiPost 有 user_id 時附票', function () {
  var html = fs.readFileSync(path.join(root, 'tools/sketchup-render-studio/index.html'), 'utf8');
  var iLib = html.indexOf('shared/js/hub_gate_ticket.js');
  assert.ok(iLib > 0 && iLib < html.indexOf('src="app.js"'), 'lib before app.js');
  var src = fs.readFileSync(path.join(root, 'tools/sketchup-render-studio/app.js'), 'utf8');
  var start = src.indexOf('function apiPost(');
  var fn = src.slice(start, src.indexOf('\n  }\n', start));
  assert.ok(/HubGateTicket/.test(fn) && /\.attach\(payload/.test(fn), 'apiPost attaches ticket');
});

(async function () {
  var failed = 0;
  for (var i = 0; i < tests.length; i++) {
    try {
      await tests[i].fn();
      console.log('OK:', tests[i].name);
    } catch (e) {
      failed += 1;
      console.error('FAIL:', tests[i].name, '\n  ', (e && e.message) || e);
    }
  }
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\ntest-hub-gate-ticket-callers: all ' + tests.length + ' passed');
})();
