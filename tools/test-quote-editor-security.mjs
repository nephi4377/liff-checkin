/**
 * 線上報價安全修補（前端）：淨化、API、狀態、列印浮水印
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sanitize = require(join(root, 'modules/projects/js/quote-editor-sanitize.js'));

const mainJs = readFileSync(join(root, 'modules/projects/js/quote-editor-main.js'), 'utf8');
const editorHtml = readFileSync(join(root, 'modules/projects/quote-editor.html'), 'utf8');
const viewHtml = readFileSync(join(root, 'modules/projects/quote-view.html'), 'utf8');
const accountingApi = readFileSync(join(root, 'shared/js/accounting_api.js'), 'utf8');
const gridJs = readFileSync(join(root, 'modules/projects/js/quote-editor-grid.js'), 'utf8');
const gridUi = readFileSync(join(root, 'modules/projects/js/quote-editor-grid-ui.js'), 'utf8');

test('sanitize hides internal_note and keeps customer note', () => {
  const clean = sanitize.toCustomerLine({
    item: '油漆',
    amount: 100,
    customer_note: '對客',
    internal_note: '內部',
    note: 'legacy'
  });
  assert.equal(clean.note, '對客');
  assert.equal('internal_note' in clean, false);
  assert.equal(sanitize.payloadContainsForbiddenToken(clean), '');
});

test('sanitize keeps billing_label for cost-plus items', () => {
  const clean = sanitize.toCustomerLine({
    item: '泥作追加（實報實銷）',
    amount: 1,
    unit: '式',
    qty: 1,
    billing_label: '實報實銷'
  });
  assert.equal(clean.billing_label, '實報實銷');
});

test('accounting_api exposes approve and draft_revision fields', () => {
  assert.match(accountingApi, /quote_editor_approve/);
  assert.match(accountingApi, /quoteEditorApprove/);
  assert.match(accountingApi, /draft_revision/);
});

test('editor has approve button and pending status label', () => {
  assert.match(editorHtml, /btnApprove/);
  assert.match(mainJs, /pending_approval/);
  assert.match(mainJs, /quoteEditorApprove/);
  assert.match(mainJs, /draft_revision/);
});

test('grid splits customer and internal notes', () => {
  assert.match(gridJs, /customer_note/);
  assert.match(gridJs, /internal_note/);
  assert.match(gridUi, /內部備註/);
  assert.match(gridUi, /對客說明/);
});

test('staff preview hides customer confirm button', () => {
  assert.match(viewHtml, /btn\.hidden = staffPreview/);
  assert.match(viewHtml, /valid_until|有效期限/);
});

test('print preview applies draft watermark', () => {
  assert.match(mainJs, /watermark|is_draft/);
});