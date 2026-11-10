/**
 * QUOTE-EDITOR-3 前端：淨化、主控台分頁、API 接線、客人無單價／無成本
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

test('sanitize strips cost, vendor, and unit_price from customer quote', () => {
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
        is_cabinet: true,
        addons: [{
          line_id: 'a1',
          item: '特殊五金',
          unit: '式',
          qty: 1,
          unit_price: 500,
          amount: 500,
          custom: true
        }]
      }],
      trade_groups: [{ tab: '木作工程', subtotal: 9650 }]
    }],
    totals: { pretax: 9650, tax: 483, with_tax: 10133 }
  };
  const clean = sanitize.toCustomerQuote(dirty);
  assert.equal(clean.zones[0].lines[0].item, '開門高衣櫃');
  assert.equal('cost_unit' in clean.zones[0].lines[0], false);
  assert.equal('vendor_price' in clean.zones[0].lines[0], false);
  assert.equal('unit_price' in clean.zones[0].lines[0], false);
  assert.equal('unit_price' in clean.zones[0].lines[0].addons[0], false);
  assert.equal(clean.zones[0].lines[0].line_subtotal, 9650);
  assert.equal(sanitize.payloadContainsForbiddenToken(clean), '');
  assert.equal(JSON.stringify(clean).includes('"unit_price"'), false);
});

test('print-like assembly rejects forbidden tokens including unit_price', () => {
  const bad = { zones: [{ lines: [{ item: 'x', vendor_price: 1 }] }] };
  assert.equal(sanitize.payloadContainsForbiddenToken(bad), '"vendor_price"');
  const priced = { zones: [{ lines: [{ item: 'x', unit_price: 10, amount: 10 }] }] };
  assert.equal(sanitize.payloadContainsForbiddenToken(priced), '"unit_price"');
  const cleaned = sanitize.toCustomerQuote(priced);
  assert.equal(sanitize.payloadContainsForbiddenToken(cleaned), '');
});

test('designer console has 線上報價 tab and cost-guard print', () => {
  assert.match(designer, /data-tab="quote"/);
  assert.match(designer, /panelQuote/);
  assert.match(designer, /data-tab="esignc"/);
  assert.match(designer, /panelEsignc/);
  assert.match(designer, /quote-editor\.html/);
  assert.match(designer, /quoteEditorPrint/);
  assert.match(designer, /cost_unit\|vendor_price\|"成本"\|"廠商價"\|"unit_price"/);
  assert.doesNotMatch(designer, /<th>單價<\/th>/);
  assert.match(designer, /quotePrintByTrade/);
});

test('editor and view pages wire sanitize and no customer unit price', () => {
  assert.match(editorHtml, /quote-editor-sanitize\.js/);
  assert.match(editorHtml, /成本與廠商價不會出現/);
  assert.match(editorHtml, /tradeSelect/);
  assert.match(editorHtml, /btnAddCustom/);
  assert.match(editorHtml, /自填/);
  assert.match(viewHtml, /QuoteEditorSanitize/);
  assert.match(mainJs, /payloadContainsForbiddenToken/);
  assert.match(mainJs, /groupLinesByTrade/);
  assert.match(mainJs, /trade-head/);
  assert.match(viewHtml, /linesByTrade|trade-head/);
  assert.doesNotMatch(viewHtml, /廠商價|成本單價/);
  assert.match(viewHtml, /金額/);
  assert.doesNotMatch(viewHtml, /<th>單價<\/th>/);
});

test('accounting_api exposes quote_editor actions including update and custom', () => {
  assert.match(accountingApi, /quote_editor_catalog/);
  assert.match(accountingApi, /quote_editor_add_zone/);
  assert.match(accountingApi, /quote_editor_add_line/);
  assert.match(accountingApi, /quote_editor_update_line/);
  assert.match(accountingApi, /quoteEditorUpdateLine/);
  assert.match(accountingApi, /parent_line_id/);
  assert.match(accountingApi, /custom: !!payload\.custom/);
  assert.match(accountingApi, /quote_editor_customer_view/);
  assert.match(accountingApi, /quote_editor_print/);
});

test('editor hangs catalog addons under cabinet via 掛附加', () => {
  assert.match(mainJs, /btn-addon-hang/);
  assert.match(mainJs, /likely_addon|data-likely-addon/);
  assert.match(mainJs, /掛附加/);
  assert.match(mainJs, /resolveAddonParentId/);
  assert.match(editorHtml, /掛附加|抽屜／拉籃/);
});

test('editor page has fees, versions, trade, custom fill controls', () => {
  assert.match(editorHtml, /feeMeasure/);
  assert.match(editorHtml, /btnSaveFees/);
  assert.match(editorHtml, /btnSend/);
  assert.match(editorHtml, /btnNewVersion/);
  assert.match(editorHtml, /versionsBox/);
  assert.match(mainJs, /quoteEditorSetFees/);
  assert.match(mainJs, /quoteEditorSend/);
  assert.match(mainJs, /quoteEditorUpdateLine/);
  assert.match(mainJs, /btn-addon-custom/);
  assert.match(mainJs, /特殊五金自填/);
  assert.match(mainJs, /tradeSelect/);
  assert.match(mainJs, /line_subtotal/);
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
  assert.equal('unit_price' in clean.zones[0].lines[0], false);
  assert.equal(sanitize.payloadContainsForbiddenToken(clean), '');
});

test('backend QuoteEditor.js has howard fields when sibling mounted', () => {
  const p = resolveBackendQuoteJs();
  if (!existsSync(p)) {
    assert.ok(true, 'backend sibling missing — skip');
    return;
  }
  const src = readFileSync(p, 'utf8');
  assert.match(src, /QE_FORBIDDEN_KEYS_/);
  assert.match(src, /qeStripUnitPriceDeep_/);
  assert.match(src, /handleQuoteEditorUpdateLine_/);
  assert.match(src, /parent_line_id/);
  assert.match(src, /特殊五金自填/);
  assert.match(src, /qeEnrichZoneCustomer_/);
  assert.match(src, /trade_groups/);
});
