/**
 * liff.state 路徑轉址（報價編輯／客人報價）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const route = require(join(root, 'shared/js/liff_state_route.js'));

test('maps LIFF path suffix to quote editor with query', () => {
  const qs = '?liff.state=' + encodeURIComponent('/modules/projects/quote-editor.html?project_no=999');
  assert.equal(
    route.parseLiffStateRedirect(qs),
    '/modules/projects/quote-editor.html?project_no=999'
  );
});

test('maps short quote-editor path', () => {
  const qs = '?liff.state=' + encodeURIComponent('/quote-editor.html?project_no=999');
  assert.equal(
    route.parseLiffStateRedirect(qs),
    '/modules/projects/quote-editor.html?project_no=999'
  );
});

test('maps quote-view for customer LIFF entry', () => {
  const qs = '?liff.state=' + encodeURIComponent('/modules/projects/quote-view.html?project_no=999');
  assert.equal(
    route.parseLiffStateRedirect(qs),
    '/modules/projects/quote-view.html?project_no=999'
  );
});

test('ignores unrelated liff.state', () => {
  assert.equal(route.parseLiffStateRedirect('?liff.state=' + encodeURIComponent('?project_no=999')), '');
  assert.equal(route.parseLiffStateRedirect('?liff.state=' + encodeURIComponent('/modules/accounting/index.html')), '');
});

test('entry pages load liff_state_route before LIFF SDK', () => {
  const ingest = readFileSync(join(root, 'modules/accounting/accounting_ingest.html'), 'utf8');
  const portal = readFileSync(join(root, 'modules/accounting/customer-finance-portal.html'), 'utf8');
  assert.match(ingest, /liff_state_route\.js/);
  assert.match(portal, /liff_state_route\.js/);
  const ingestSdk = ingest.indexOf('liff/edge/2/sdk.js');
  const ingestRoute = ingest.indexOf('liff_state_route.js');
  assert.ok(ingestRoute > 0 && ingestRoute < ingestSdk);
  const portalSdk = portal.indexOf('liff/edge/2/sdk.js');
  const portalRoute = portal.indexOf('liff_state_route.js');
  assert.ok(portalRoute > 0 && portalRoute < portalSdk);
});
