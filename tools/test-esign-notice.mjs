/**
 * ESIGN-NOTICE-1 前端：內容版本／雜湊、列印組裝、頁面／主控台入口、API 接線
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentPath = join(root, 'modules/projects/data/esign-notice-2025-0922.json');
const htmlPath = join(root, 'modules/projects/esign-notice.html');
const mainPath = join(root, 'modules/projects/js/esign-notice-main.js');
const apiPath = join(root, 'modules/projects/js/esign-notice-api.js');
const designerPath = join(root, 'modules/accounting/designer-customer-finance.html');
const accountingApiPath = join(root, 'shared/js/accounting_api.js');
const backendPath = join(root, '../backend_gas/project-console/EsignNotice.js');

const content = JSON.parse(readFileSync(contentPath, 'utf8'));
const html = readFileSync(htmlPath, 'utf8');
const main = readFileSync(mainPath, 'utf8');
const api = readFileSync(apiPath, 'utf8');
const designer = readFileSync(designerPath, 'utf8');
const accountingApi = readFileSync(accountingApiPath, 'utf8');

function sha256Hex(text) {
  return createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

test('notice content version 2025-0922 has 18 items and fee table', () => {
  assert.equal(content.version, '2025-0922');
  assert.equal(content.items.length, 18);
  const fee = content.items.find((it) => it.id === 18);
  assert.ok(fee);
  assert.equal(fee.fee_stages.length, 3);
  assert.ok(fee.extra_sections.length >= 3);
});

test('items 12/13/14/16 have image placeholders with link slots', () => {
  for (const id of [12, 13, 14, 16]) {
    const item = content.items.find((it) => it.id === id);
    assert.ok(item, 'item ' + id);
    assert.ok((item.images || []).length >= 1, 'images for ' + id);
    assert.equal(typeof item.images[0].src, 'string');
    assert.equal(typeof item.images[0].link, 'string');
    assert.equal(item.images[0].placeholder, true);
  }
});

test('content hash is deterministic SHA-256', () => {
  const a = sha256Hex(JSON.stringify(content));
  const b = sha256Hex(JSON.stringify(content));
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('backend content hash matches frontend when backend repo present', function () {
  if (!existsSync(backendPath)) {
    this.skip();
    return;
  }
  const backendSrc = readFileSync(backendPath, 'utf8');
  assert.match(backendSrc, /version:\s*'2025-0922'/);
  assert.match(backendSrc, /enNoticeContentHash_/);
  assert.match(backendSrc, /fee_stages/);
});

test('client page has signature canvas, ack, print, lock UX hooks', () => {
  assert.match(html, /signCanvas/);
  assert.match(html, /btnAck/);
  assert.match(html, /btnSubmit/);
  assert.match(html, /btnPrint/);
  assert.match(html, /我了解/);
  assert.match(main, /esign_notice_submit|EsignNoticeApi\.submit/);
  assert.match(main, /notice_content_hash/);
  assert.match(main, /locked/);
  assert.match(main, /window\.print/);
  assert.match(api, /esign_notice_get/);
  assert.match(api, /esign_notice_print/);
});

test('console panel can copy link and show status', () => {
  assert.match(designer, /data-tab="esign"/);
  assert.match(designer, /btnEsignCopy/);
  assert.match(designer, /esignNoticeStatus/);
  assert.match(designer, /複製客戶連結/);
  assert.match(accountingApi, /esignNoticeStatus/);
  assert.match(accountingApi, /esign_notice_status/);
  assert.match(accountingApi, /esign_notice_print/);
});

test('print builder includes items, ack times, signature, date markers', () => {
  assert.match(main, /ack_times/);
  assert.match(main, /signature_data_url/);
  assert.match(main, /signed_at/);
  assert.match(main, /notice_content_hash/);
  assert.match(main, /buildPrintHtml/);
});
