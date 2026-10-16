import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../shared/js/accounting_api.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../modules/accounting/customer-finance-portal.html', import.meta.url), 'utf8');

function fixture(options = {}) {
  const requests = [];
  const logins = [];
  const storage = new Map();
  const context = vm.createContext({
    window: {location: {href: 'https://info.tanxin.space/modules/accounting/customer-finance-portal.html?bind=1', search: '?bind=1', hash: ''}},
    OperatorContext: {}, URLSearchParams, AbortController, setTimeout, clearTimeout,
    sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
    liff: {init: async () => {}, isLoggedIn: () => true, getIDToken: () => '',
      getAccessToken: () => options.noToken ? '' : 'access-test', logout() {}, login: args => logins.push(args)},
    fetch: async (url, args) => {
      const body = JSON.parse(args.body);
      requests.push(body);
      return {status: 200, text: async () => JSON.stringify(options.authFail
        ? {success: false, message: 'LIFF 驗證失敗'} : {success: true, user_id: 'verified-user', display_name: '客戶', projects: []})};
    }
  });
  vm.runInContext(source, context);
  return {api: context.AccountingApi, requests, logins, storage};
}

test('missing ID token can use LINE access token for auth and later self bind', async () => {
  const f = fixture();
  const session = await f.api.initCustomerPortalSession({liffId: 'customer-liff'});
  assert.equal(session.profile.userId, 'verified-user');
  assert.equal(f.logins.length, 0);
  assert.equal(f.requests[0].auth.liff_access_token, 'access-test');
  await f.api.cfPortalSelfBind(session, {project_no: '123'});
  assert.equal(f.requests[1].auth.liff_access_token, 'access-test');
  assert.ok([...f.storage.values()].every(value => !String(value).includes('access-test')));
});

test('failed auth retries login once, then gives actionable failure instead of looping', async () => {
  const f = fixture({authFail: true});
  assert.equal(await f.api.initCustomerPortalSession({liffId: 'customer-liff'}), null);
  await assert.rejects(f.api.initCustomerPortalSession({liffId: 'customer-liff'}), /LIFF 驗證失敗/);
  assert.equal(f.logins.length, 1);
});

test('missing both tokens retries only once and never sends an unauthenticated request', async () => {
  const f = fixture({noToken: true});
  assert.equal(await f.api.initCustomerPortalSession({liffId: 'customer-liff'}), null);
  await assert.rejects(f.api.initCustomerPortalSession({liffId: 'customer-liff'}), /登入憑證未取得/);
  assert.equal(f.logins.length, 1);
  assert.equal(f.requests.length, 0);
});

test('boot waits during login redirect, and failed boot replaces checking status', async () => {
  const start = html.indexOf('    (async function boot() {');
  const end = html.indexOf('    })();', start) + '    })();'.length;
  const boot = html.slice(start, end);
  for (const fail of [false, true]) {
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, {classList: {add() {}, remove() {}}, textContent: ''});
      return elements.get(id);
    };
    const errors = [];
    const context = vm.createContext({
      $: element, deepLink: {bind: true}, staffPreview: false,
      portalMockMode: () => '', showBindView() {}, CUSTOMER_FINANCE_LIFF_ID: 'customer-liff',
      showBindMsg: message => errors.push(message),
      AccountingApi: {initCustomerPortalSession: async () => {
        if (fail) throw new Error('LIFF 驗證失敗');
        return null;
      }}
    });
    await vm.runInContext(boot, context);
    assert.equal(element('btnBindSubmit').disabled, true);
    if (fail) {
      assert.match(element('bindStatus').textContent, /尚未確認/);
      assert.equal(errors.length, 1);
    } else assert.equal(errors.length, 0);
  }
});
