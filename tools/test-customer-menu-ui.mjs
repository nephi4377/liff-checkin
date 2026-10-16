/** 本地瀏覽器驗證：LINE／GAS 全部攔截為測試回應，不改正式客戶資料。
 * PLAYWRIGHT_MODULE_PATH 可指定已安裝的 playwright；瀏覽器依標準 PLAYWRIGHT_BROWSERS_PATH。
 */
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const server = createServer(async (req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://local').pathname);
  if (!file.startsWith(root)) {res.writeHead(403).end(); return;}
  try {
    const content = await readFile(file);
    const ext = path.extname(file);
    res.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html');
    res.end(content);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  for (const authFail of [false, true]) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}});
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__logins = 0;
      window.liff = {init: async () => {}, isLoggedIn: () => true, getIDToken: () => '',
        getAccessToken: () => 'test-access-only', logout() {}, login() {window.__logins++;}};
    });
    await page.route('https://static.line-scdn.net/**', route => route.fulfill({contentType: 'text/javascript', body: ''}));
    await page.route('https://script.google.com/**', route => {
      const body = route.request().postDataJSON();
      assert.equal(body.auth.liff_access_token, 'test-access-only');
      const result = authFail ? {success: false, message: 'LIFF 驗證失敗'} : body.action === 'client_portal_self_bind'
        ? {success: true, rich_menu_sync: {success: true, verified: true, richMenuId: 'member'}}
        : {success: true, user_id: 'test-user', display_name: '測試客戶', projects: []};
      return route.fulfill({contentType: 'application/json', body: JSON.stringify(result)});
    });
    await page.goto(base + '/modules/accounting/customer-finance-portal.html?bind=1');
    if (authFail) {
      await page.waitForFunction(() => window.__logins === 1);
      await page.reload();
      await page.waitForFunction(() => document.getElementById('bindStatus').textContent.includes('尚未確認'));
      assert.equal(await page.locator('#btnBindSubmit').isDisabled(), true);
      assert.equal(await page.locator('#btnLiffRelogin').isVisible(), true);
      console.log('PASS: mobile auth failure shows recovery and disables binding');
    } else {
      await page.waitForFunction(() => !document.getElementById('btnBindSubmit').disabled);
      await page.locator('#bindProjectNo').fill('123');
      await page.locator('#bindAddress').fill('測試路123號');
      await page.locator('#bindOwnerName').fill('測試客戶');
      await page.locator('#btnBindSubmit').click();
      await page.waitForFunction(() => !document.getElementById('bindDoneCard').classList.contains('hidden'));
      console.log('PASS: access-token login completes verified six-menu binding in mobile page');
    }
    await context.close();
  }

  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  await page.goto(base + '/modules/accounting/designer-customer-finance.html');
  // 獨立掛載實際共用綁定元件，避開員工登入；管理 API 全為本地 stub。
  await page.setContent('<div id="mount"></div><div id="message"></div>');
  await page.addScriptTag({path: path.join(root, 'shared/js/customer_finance_bind.js')});
  await page.evaluate(() => {
    window.__synced = 0;
    window.AccountingApi = {
      cfPortalMenuStatus: async () => ({success: true, verified: true, variant: 'guest', richMenuId: 'guest',
        active_binding_count: 0, history: [{timestamp: 'test-time', stage: 'guest_after_revoke',
          previous_menu_id: 'member', target_menu_id: 'guest', outcome: 'verified'}]}),
      cfPortalMenuSync: async () => {window.__synced++; return {success: true, verified: true};},
      cfPortalRevoke: async () => ({success: true, rich_menu_sync: {success: false}})
    };
    window.confirm = () => true;
    CustomerFinanceBind.render(document.getElementById('mount'), {
      session: {}, projectNo: '123',
      detail: {portal_bindings: [{binding_id: 'active', customer_line_user_id: 'test-user'}],
        revoked_portal_bindings: [{binding_id: 'revoked', customer_line_user_id: 'test-user'}]},
      onRefresh: async () => {document.getElementById('message').textContent = '';},
      onMsg: message => {document.getElementById('message').textContent = message;}
    });
  });
  await page.locator('[data-menu-status="active"]').click();
  await page.waitForFunction(() => document.querySelector('[data-menu-result="active"]').textContent.includes('目前選單：四格'));
  await page.locator('summary').filter({hasText: '最近解除的綁定'}).click();
  await page.locator('[data-menu-sync="revoked"]').click();
  await page.waitForFunction(() => window.__synced === 1 && document.querySelector('[data-menu-result="revoked"]').textContent.includes('本次同步已確認'));
  await page.locator('[data-revoke="active"]').click();
  await page.waitForFunction(() => document.getElementById('message').textContent.includes('選單尚未同步'));
  assert.equal(await page.locator('[data-menu-result="active"]').evaluate(el => el.scrollWidth <= el.clientWidth), true);
  console.log('PASS: management shows history, retries revoked menu and preserves partial-failure notice');
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
