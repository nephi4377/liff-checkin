/**
 * 單元：shared/js/hub_gate_ticket.js（主控台只帶 user_id 時附 hub_gate_ticket）
 * node modules/accounting/tools/test-hub-gate-ticket.js
 *
 * 對齊 Backend_GAS accounting-gas core/HubUserIdGate.js（ticket = base64url(JSON{uid,exp,purpose}).sig、TTL 120 秒）
 * 與 project-console AccountingHubGateTicket.js（POST action=accounting_hub_gate_ticket，需 liff_id_token）。
 */
'use strict';

var path = require('path');
var assert = require('assert');

var HubGateTicket = require(path.join(__dirname, '../../../shared/js/hub_gate_ticket.js'));

var UID = 'U1234567890abcdef1234567890abcd';
var CONSOLE_URL = 'https://console.example/exec';

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeLiffToken(sub, expSec) {
  return b64url({ alg: 'HS256' }) + '.' + b64url({ sub: sub, exp: expSec }) + '.sig';
}

function makeTicket(uid, expSec) {
  return b64url({ uid: uid, exp: expSec, purpose: 'hub_gate' }) + '.SIGNATURE';
}

function memStorage() {
  var m = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem: function (k, v) { m[k] = String(v); },
    removeItem: function (k) { delete m[k]; },
    _dump: m
  };
}

function harness(opts) {
  opts = opts || {};
  var clock = { ms: opts.startMs || Date.UTC(2026, 10, 16, 9, 0, 0) };
  var calls = [];
  var warns = [];
  var tokenCalls = 0;
  var responder = opts.responder || function (body) {
    var nowSec = Math.floor(clock.ms / 1000);
    return {
      success: true,
      hub_gate_ticket: makeTicket(UID, nowSec + 120),
      user_id: UID,
      expires_in_sec: 120
    };
  };
  var fetchImpl = function (url, init) {
    var body = JSON.parse(init.body);
    calls.push({ url: url, body: body });
    if (opts.fetchDelayMs) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve(respond(body)); }, opts.fetchDelayMs);
      });
    }
    return Promise.resolve(respond(body));
  };
  function respond(body) {
    var out = responder(body);
    if (out instanceof Error) throw out;
    var text = typeof out === 'string' ? out : JSON.stringify(out);
    return { status: 200, text: function () { return Promise.resolve(text); } };
  }
  var storage = opts.storage || memStorage();
  var client = HubGateTicket.create({
    fetch: fetchImpl,
    storage: storage,
    now: function () { return clock.ms; },
    consoleApiUrl: CONSOLE_URL,
    getLiffToken: function () {
      tokenCalls += 1;
      return Promise.resolve(typeof opts.parentToken === 'function' ? opts.parentToken() : (opts.parentToken || ''));
    },
    logger: { warn: function () { warns.push(Array.prototype.join.call(arguments, ' ')); } },
    budgetMs: opts.budgetMs
  });
  return {
    client: client,
    clock: clock,
    calls: calls,
    warns: warns,
    storage: storage,
    tokenCalls: function () { return tokenCalls; }
  };
}

function freshToken(h, sub) {
  return makeLiffToken(sub || UID, Math.floor(h.clock.ms / 1000) + 3600);
}

var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('Hub 只帶 user_id：用父層 LIFF token 換票並附在 body 與 body.auth', async function () {
  var h = harness({ parentToken: function () { return freshToken(h); } });
  var body = { action: 'crud_list', entity: 'vendor', auth: { user_id: UID } };
  var out = await h.client.attach(body);
  assert.strictEqual(out, body, 'attach returns the same body');
  assert.strictEqual(h.calls.length, 1, 'one ticket request');
  assert.strictEqual(h.calls[0].url, CONSOLE_URL);
  assert.strictEqual(h.calls[0].body.action, 'accounting_hub_gate_ticket');
  assert.ok(h.calls[0].body.liff_id_token, 'sends liff_id_token');
  assert.ok(body.hub_gate_ticket, 'top-level hub_gate_ticket');
  assert.strictEqual(body.auth.hub_gate_ticket, body.hub_gate_ticket, 'auth.hub_gate_ticket');
  assert.strictEqual(h.warns.length, 0, 'no warn on success');
});

test('有效期內重用快取，不重複取票；接近到期才換新票', async function () {
  var h = harness({ parentToken: function () { return freshToken(h); } });
  await h.client.attach({ action: 'a1', user_id: UID });
  h.clock.ms += 60 * 1000;
  var b2 = await h.client.attach({ action: 'a2', user_id: UID });
  assert.strictEqual(h.calls.length, 1, 'cached within validity');
  assert.ok(b2.hub_gate_ticket);
  // 票 120 秒；剩不到 20 秒就換新
  h.clock.ms += 45 * 1000;
  var b3 = await h.client.attach({ action: 'a3', user_id: UID });
  assert.strictEqual(h.calls.length, 2, 'refetch near expiry');
  assert.notStrictEqual(b3.hub_gate_ticket, b2.hub_gate_ticket, 'new ticket');
});

test('快取存 sessionStorage：同分頁其他 iframe（新 client）可直接用', async function () {
  var storage = memStorage();
  var h1 = harness({ storage: storage, parentToken: function () { return freshToken(h1); } });
  await h1.client.attach({ action: 'a', user_id: UID });
  var h2 = harness({ storage: storage, startMs: h1.clock.ms + 5000, parentToken: '' });
  var b = await h2.client.attach({ action: 'b', user_id: UID });
  assert.ok(b.hub_gate_ticket, 'reused from storage');
  assert.strictEqual(h2.calls.length, 0, 'no fetch in second client');
  assert.strictEqual(h2.tokenCalls(), 0, 'no token lookup needed');
});

test('同時多個請求只取一次票', async function () {
  var h = harness({ fetchDelayMs: 20, parentToken: function () { return freshToken(h); } });
  var bodies = [1, 2, 3, 4].map(function (i) { return { action: 'x' + i, user_id: UID }; });
  await Promise.all(bodies.map(function (b) { return h.client.attach(b); }));
  assert.strictEqual(h.calls.length, 1, 'single in-flight fetch');
  bodies.forEach(function (b) { assert.ok(b.hub_gate_ticket, 'all bodies get ticket'); });
});

test('存摺 OCR：只有 operatorUserId 也要帶票', async function () {
  var h = harness({ parentToken: function () { return freshToken(h); } });
  var body = { action: 'employee_bank_ocr', operatorUserId: UID, photo: {} };
  await h.client.attach(body);
  assert.ok(body.hub_gate_ticket, 'operatorUserId path');
});

test('body 自帶新鮮 liff_id_token 時直接用它換票，不問父層', async function () {
  var h = harness({ parentToken: 'should-not-be-used' });
  var tok = freshToken(h);
  var body = { action: 'sketchup_render_ping', user_id: UID, liff_id_token: tok };
  await h.client.attach(body);
  assert.strictEqual(h.tokenCalls(), 0, 'no parent lookup');
  assert.strictEqual(h.calls[0].body.liff_id_token, tok);
  assert.ok(body.hub_gate_ticket);
});

test('沒有 user_id（例如 accounting_policy）不取票也不警告', async function () {
  var h = harness({ parentToken: function () { return freshToken(h); } });
  var body = { action: 'accounting_policy' };
  await h.client.attach(body);
  assert.strictEqual(h.calls.length, 0);
  assert.strictEqual(h.tokenCalls(), 0);
  assert.strictEqual(body.hub_gate_ticket, undefined);
  assert.strictEqual(h.warns.length, 0);
});

test('取不到 LIFF token：照常送出（不帶票）、console 留 [HubGateTicket][WARN]、退避期間不重問', async function () {
  var h = harness({ parentToken: '' });
  var body = { action: 'vendor_payment_list', auth: { user_id: UID } };
  await h.client.attach(body);
  assert.strictEqual(body.hub_gate_ticket, undefined, 'no ticket');
  assert.strictEqual(h.calls.length, 0, 'no console call without token');
  assert.strictEqual(h.warns.length, 1, 'one warn');
  assert.ok(/\[HubGateTicket\]\[WARN\]/.test(h.warns[0]), 'warn tag');
  assert.ok(/no_liff_token/.test(h.warns[0]), 'reason in warn');
  assert.ok(/vendor_payment_list/.test(h.warns[0]), 'action in warn');
  assert.ok(h.warns[0].indexOf(UID) < 0, 'full uid not printed');
  h.clock.ms += 10 * 1000;
  await h.client.attach({ action: 'vendor_payment_list', auth: { user_id: UID } });
  assert.strictEqual(h.tokenCalls(), 1, 'backoff: no second token lookup');
  assert.strictEqual(h.warns.length, 1, 'same reason+action warn throttled');
  h.clock.ms += 61 * 1000;
  await h.client.attach({ action: 'vendor_payment_list', auth: { user_id: UID } });
  assert.strictEqual(h.tokenCalls(), 2, 'retry after backoff');
});

test('過期的 LIFF token 視同沒有', async function () {
  var h = harness({ parentToken: function () { return makeLiffToken(UID, Math.floor(h.clock.ms / 1000) - 10); } });
  var body = { action: 'a', user_id: UID };
  await h.client.attach(body);
  assert.strictEqual(h.calls.length, 0, 'expired token not sent');
  assert.strictEqual(body.hub_gate_ticket, undefined);
  assert.ok(/no_liff_token/.test(h.warns[0] || ''));
});

test('主控台取票失敗（success:false／HTML／網路錯）都不擋請求', async function () {
  var cases = [
    { name: 'rejected', responder: function () { return { success: false, message: 'LIFF 驗證失敗' }; }, reason: /console_rejected/ },
    { name: 'html', responder: function () { return '<html>error</html>'; }, reason: /console_bad_response/ },
    { name: 'network', responder: function () { return new Error('Failed to fetch'); }, reason: /console_error/ }
  ];
  for (var i = 0; i < cases.length; i++) {
    var c = cases[i];
    var h = harness({ responder: c.responder, parentToken: function () { return makeLiffToken(UID, 4102444800); } });
    var body = { action: 'accounting_auth_me', user_id: UID };
    var out = await h.client.attach(body);
    assert.strictEqual(out, body, c.name + ': body returned');
    assert.strictEqual(body.hub_gate_ticket, undefined, c.name + ': no ticket');
    assert.ok(c.reason.test(h.warns[0] || ''), c.name + ': reason ' + (h.warns[0] || '(none)'));
    await h.client.attach({ action: 'accounting_auth_me', user_id: UID });
    assert.strictEqual(h.calls.length, 1, c.name + ': backoff after failure');
  }
});

test('票的 uid 跟聲稱的 user_id 不同：不附（避免送無效票）', async function () {
  var h = harness({
    parentToken: function () { return freshToken(h, 'Uother'); },
    responder: function () {
      return { success: true, hub_gate_ticket: makeTicket('Uother', Math.floor(h.clock.ms / 1000) + 120), user_id: 'Uother' };
    }
  });
  var body = { action: 'a', user_id: UID };
  await h.client.attach(body);
  assert.strictEqual(body.hub_gate_ticket, undefined);
  assert.ok(/uid_mismatch/.test(h.warns[0] || ''));
});

test('取票太慢：超過等待上限就先送出，票取回後下一個請求再用', async function () {
  var h = harness({ fetchDelayMs: 80, budgetMs: 20, parentToken: function () { return freshToken(h); } });
  var body = { action: 'slow', user_id: UID };
  await h.client.attach(body);
  assert.strictEqual(body.hub_gate_ticket, undefined, 'not waited');
  assert.ok(/timeout/.test(h.warns[0] || ''));
  await new Promise(function (r) { setTimeout(r, 120); });
  var b2 = { action: 'next', user_id: UID };
  await h.client.attach(b2);
  assert.ok(b2.hub_gate_ticket, 'background fetch populated cache');
  assert.strictEqual(h.calls.length, 1);
});

test('不信任回應裡過長的有效期：快取最多到票本身 exp', async function () {
  var h = harness({
    parentToken: function () { return freshToken(h); },
    responder: function () {
      return { success: true, hub_gate_ticket: makeTicket(UID, Math.floor(h.clock.ms / 1000) + 60), user_id: UID, expires_in_sec: 9999 };
    }
  });
  await h.client.attach({ action: 'a', user_id: UID });
  h.clock.ms += 45 * 1000;
  await h.client.attach({ action: 'b', user_id: UID });
  assert.strictEqual(h.calls.length, 2, 'ticket exp (60s) wins over expires_in_sec');
});

test('peek：同步讀快取、不發請求', async function () {
  var h = harness({ parentToken: function () { return freshToken(h); } });
  assert.strictEqual(h.client.peek(UID), '');
  await h.client.attach({ action: 'a', user_id: UID });
  assert.ok(h.client.peek(UID));
  assert.strictEqual(h.client.peek('Uother'), '');
});

(async function () {
  var failed = 0;
  for (var i = 0; i < tests.length; i++) {
    try {
      await tests[i].fn();
      console.log('OK:', tests[i].name);
    } catch (e) {
      failed += 1;
      console.error('FAIL:', tests[i].name, '\n  ', e && e.stack || e);
    }
  }
  if (failed) {
    console.error('\n' + failed + ' failed');
    process.exit(1);
  }
  console.log('\ntest-hub-gate-ticket: all ' + tests.length + ' passed');
})();
