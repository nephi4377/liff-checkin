/**
 * QUOTE-EDITOR-3 前端：淨化、主控台分頁、API 接線、成本永不進客戶／列印組裝
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const sanitize = require(join(root, 'modules/projects/js/quote-editor-sanitize.js'));

const designer = readFileSync(join(root, 'modules/accounting/designer-customer-finance.html'), 'utf8');
const editorHtml = readFileSync(join(root, 'modules/projects/quote-editor.html'), 'utf8');
const viewHtml = readFileSync(join(root, 'modules/projects/quote-view.html'), 'utf8');
const mainJs = readFileSync(join(root, 'modules/projects/js/quote-editor-main.js'), 'utf8');
const accountingApi = readFileSync(join(root, 'shared/js/accounting_api.js'), 'utf8');

function resolveBackendQuoteJs() {
  const candidates = [
    join(root, '../backend_gas/project-console/QuoteEditor.js'),
    join(root, '../Backend_GAS/project-console/QuoteEditor.js'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

test('sanitize strips cost and vendor keys from customer quote', () => {
  const dirty = {
    project_no: '9901',
    zones: [{
      zone_id: 'z1',
      name: '客廳',
      lines: [{
        line_id: 'l1',
        item: '開門高衣櫃',
        unit: '尺',
        qty: 1.5,
        unit_price: 6100,
        amount: 9150,
        cost_unit: 3200,
        vendor_price: 3500,
        成本: 999,
        廠商價: 888
      }]
    }],
    totals: { pretax: 9150, tax: 457.5, with_tax: 9607.5 }
  };
  const clean = sanitize.toCustomerQuote(dirty);
  assert.equal(clean.zones[0].lines[0].item, '開門高衣櫃');
  assert.equal('cost_unit' in clean.zones[0].lines[0], false);
  assert.equal('vendor_price' in clean.zones[0].lines[0], false);
  assert.equal(sanitize.payloadContainsForbiddenToken(clean), '');
});

test('print-like assembly rejects forbidden tokens', () => {
  const bad = { zones: [{ lines: [{ item: 'x', vendor_price: 1 }] }] };
  assert.equal(sanitize.payloadContainsForbiddenToken(bad), '"vendor_price"');
  const cleaned = sanitize.stripForbiddenDeep(bad);
  assert.equal(sanitize.payloadContainsForbiddenToken(cleaned), '');
});

test('designer console has 線上報價 tab and cost-guard print', () => {
  assert.match(designer, /data-tab="quote"/);
  assert.match(designer, /panelQuote/);
  assert.match(designer, /quote-editor\.html/);
  assert.match(designer, /quoteEditorPrint/);
  assert.match(designer, /cost_unit\|vendor_price/);
});

test('editor and view pages wire sanitize and no cost UI labels', () => {
  assert.match(editorHtml, /quote-editor-sanitize\.js/);
  assert.match(editorHtml, /成本與廠商價不會出現/);
  assert.match(viewHtml, /QuoteEditorSanitize/);
  assert.match(mainJs, /payloadContainsForbiddenToken/);
  assert.doesNotMatch(viewHtml, /廠商價|成本單價/);
});

test('accounting_api exposes quote_editor actions', () => {
  assert.match(accountingApi, /quote_editor_catalog/);
  assert.match(accountingApi, /quote_editor_add_zone/);
  assert.match(accountingApi, /quote_editor_add_line/);
  assert.match(accountingApi, /quote_editor_customer_view/);
  assert.match(accountingApi, /quote_editor_print/);
  assert.match(accountingApi, /quoteEditorCatalog/);
  assert.match(accountingApi, /quote_editor_set_fees/);
  assert.match(accountingApi, /quote_editor_send/);
  assert.match(accountingApi, /quote_editor_new_version/);
  assert.match(accountingApi, /quote_editor_confirm/);
  assert.match(accountingApi, /quote_editor_list_versions/);
});

test('editor page has fees, versions, send controls', () => {
  assert.match(editorHtml, /feeMeasure/);
  assert.match(editorHtml, /feeStartup/);
  assert.match(editorHtml, /feePlanning/);
  assert.match(editorHtml, /btnSaveFees/);
  assert.match(editorHtml, /btnSend/);
  assert.match(editorHtml, /btnNewVersion/);
  assert.match(editorHtml, /versionsBox/);
  assert.match(mainJs, /quoteEditorSetFees/);
  assert.match(mainJs, /quoteEditorSend/);
  assert.match(mainJs, /quoteEditorNewVersion/);
  assert.match(mainJs, /prevZone/);
  assert.match(mainJs, /btn\.disabled = true/);
  assert.match(mainJs, /已收丈量費/);
  assert.match(mainJs, /應付/);
  assert.match(mainJs, /小計/);
});

test('sanitize rounds money to integer yuan', () => {
  const clean = sanitize.toCustomerQuote({
    zones: [{ name: 'a', lines: [{ item: 'x', amount: 10.4 }], zone_subtotal: 10.4 }],
    fees_received: { measure: 1.6, startup: 0, planning: 0 },
    totals: { pretax: 10.4, tax: 0.52, with_tax: 10.92, deducted: 1.6, payable: 9.32 }
  });
  assert.equal(clean.totals.tax, 1);
  assert.equal(clean.totals.with_tax, 11);
  assert.equal(clean.fees_received.measure, 2);
  assert.equal(clean.zones[0].zone_subtotal, 10);
});

test('customer view has confirm and fees display without cost labels', () => {
  assert.match(viewHtml, /btnConfirm/);
  assert.match(viewHtml, /quoteEditorConfirm/);
  assert.match(viewHtml, /丈量費/);
  assert.match(viewHtml, /啟動金/);
  assert.match(viewHtml, /規劃費/);
  assert.doesNotMatch(viewHtml, /廠商價|成本單價|cost_unit|vendor_price/);
});

test('customer sanitize keeps fees_received sell-side only', () => {
  const dirty = {
    project_no: '9901',
    fees_received: { measure: 1000, startup: 2000, planning: 500 },
    totals: { pretax: 10000, tax: 500, with_tax: 10500, deducted: 3500, payable: 7000 },
    zones: [{
      name: '客廳',
      lines: [{ item: 'x', unit: '式', qty: 1, unit_price: 10000, amount: 10000, cost_unit: 1, vendor_price: 2 }]
    }]
  };
  const clean = sanitize.toCustomerQuote(dirty);
  assert.equal(clean.fees_received.measure, 1000);
  assert.equal(clean.totals.payable, 7000);
  assert.equal('cost_unit' in clean.zones[0].lines[0], false);
  assert.equal(sanitize.payloadContainsForbiddenToken(clean), '');
});

test('backend QuoteEditor.js present with forbidden-key strip (when sibling repo mounted)', () => {
  const p = resolveBackendQuoteJs();
  if (!existsSync(p)) {
    assert.ok(true, 'backend sibling missing in this checkout — skip structural check');
    return;
  }
  const src = readFileSync(p, 'utf8');
  assert.match(src, /QE_FORBIDDEN_KEYS_/);
  assert.match(src, /qeStripForbiddenDeep_/);
  assert.match(src, /qeCustomerView_/);
  assert.match(src, /qePrintView_/);
  assert.match(src, /QUOTE_EDITOR_ENABLED/);
  assert.match(src, /handleQuoteEditorSetFees_/);
  assert.match(src, /handleQuoteEditorSend_/);
  assert.match(src, /handleQuoteEditorConfirm_/);
  assert.match(src, /qeBuildPreflight_/);
});
