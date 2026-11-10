/**
 * 報價編輯器：試算表式填寫（格子、貼上、加購、即時小計、自動暫存計畫）
 * 客人列不得含單價。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const grid = require(join(root, 'modules/projects/js/quote-editor-grid.js'));
const gridUi = readFileSync(join(root, 'modules/projects/js/quote-editor-grid-ui.js'), 'utf8');
const editorHtml = readFileSync(join(root, 'modules/projects/quote-editor.html'), 'utf8');
const viewHtml = readFileSync(join(root, 'modules/projects/quote-view.html'), 'utf8');

function filled(extra) {
  return grid.blankRow(Object.assign({
    tab: '木作工程',
    item: '層板',
    unit: '才',
    qty: 2,
    unit_price: 500,
    dirty: true,
    custom: true
  }, extra || {}));
}

test('always keeps one blank row; typing in it adds another', () => {
  const rows = grid.ensureTrailingBlank([]);
  assert.equal(rows.length, 1);
  assert.equal(grid.isBlank(rows[0]), true);
  const typed = grid.touchCell(rows, 0, 'item', '衣櫃');
  assert.equal(typed.added, true);
  assert.equal(rows.length, 2);
  assert.equal(grid.isBlank(rows[1]), true);
  const again = grid.touchCell(rows, 0, 'unit', '尺');
  assert.equal(again.added, false);
  assert.equal(rows.length, 2);
});

test('Enter moves down; Enter on the empty bottom row does not stack blanks', () => {
  const rows = grid.ensureTrailingBlank([filled()]);
  assert.equal(rows.length, 2);
  const ontoBlank = grid.commitEnter(rows, 0);
  assert.equal(ontoBlank.added, false);
  assert.equal(ontoBlank.next, 1);
  assert.equal(rows.length, 2);
  const stay = grid.commitEnter(rows, 1);
  assert.equal(stay.added, false);
  assert.equal(stay.next, 1);
  assert.equal(rows.length, 2);
  rows[1].item = '已打字';
  const grown = grid.commitEnter(rows, 1);
  assert.equal(grown.added, true);
  assert.equal(grown.next, 2);
  assert.equal(grid.isBlank(rows[2]), true);
});

test('Tab and arrows move between cells and stop at the edges', () => {
  const bounds = { rows: 2, cols: grid.COLS.length };
  const tab = grid.moveCell({ row: 0, col: 0 }, 'Tab', bounds);
  assert.deepEqual({ row: tab.row, col: tab.col }, { row: 0, col: 1 });
  const wrap = grid.moveCell({ row: 0, col: grid.COLS.length - 1 }, 'Tab', bounds);
  assert.deepEqual({ row: wrap.row, col: wrap.col }, { row: 1, col: 0 });
  const back = grid.moveCell({ row: 1, col: 0 }, 'ShiftTab', bounds);
  assert.deepEqual({ row: back.row, col: back.col }, { row: 0, col: grid.COLS.length - 1 });
  const down = grid.moveCell({ row: 0, col: 2 }, 'ArrowDown', bounds);
  assert.equal(down.row, 1);
  assert.equal(down.col, 2);
  const enter = grid.moveCell({ row: 0, col: 3 }, 'Enter', bounds);
  assert.equal(enter.row, 1);
  assert.equal(enter.col, 3);
  const stuck = grid.moveCell({ row: 0, col: 0 }, 'ArrowUp', bounds);
  assert.equal(stuck.moved, false);
  assert.equal(stuck.row, 0);
  const last = grid.moveCell({ row: 1, col: 1 }, 'Enter', bounds);
  assert.equal(last.moved, false);
  assert.equal(last.needRow, true);
});

test('paste tab-separated rows, including a header, and keep one blank row', () => {
  const rows = grid.ensureTrailingBlank([filled({ item: '原有' })]);
  const text = '工種\t品名\t單位\t數量\t單價\t說明\n' +
    '油漆工程\t天花板\t坪\t10\t1,650\t水泥漆\n' +
    '水電工程\t插座\t個\t3\t450\t';
  const applied = grid.applyClipboard(rows, 1, 0, text);
  assert.equal(applied.count, 2);
  assert.equal(rows[1].tab, '油漆工程');
  assert.equal(rows[1].item, '天花板');
  assert.equal(rows[1].unit, '坪');
  assert.equal(rows[1].qty, '10');
  assert.equal(rows[1].unit_price, '1650');
  assert.equal(rows[2].item, '插座');
  assert.equal(grid.isBlank(rows[rows.length - 1]), true);
  assert.equal(rows.filter(grid.isBlank).length, 1);
});

test('paste starts at the focused column when there is no header', () => {
  const rows = grid.ensureTrailingBlank([]);
  const itemCol = grid.COLS.indexOf('item');
  grid.applyClipboard(rows, 0, itemCol, '抽屜組\t組\t1\t1200');
  assert.equal(rows[0].item, '抽屜組');
  assert.equal(rows[0].unit, '組');
  assert.equal(rows[0].qty, '1');
  assert.equal(rows[0].unit_price, '1200');
  assert.equal(rows[0].tab, '');
});

test('catalog suggestion fills unit and price and stays editable', () => {
  const catalog = [{
    item: '開門高衣櫃-D60H240內',
    unit: '尺',
    price: 6100,
    tab: '木作工程',
    note: '含門片',
    catalog_key: '木作工程::開門高衣櫃-D60H240內',
    cost_unit: 9999,
    likely_cabinet: true
  }, {
    item: '矽酸鈣天花板',
    unit: '坪',
    price: 1650,
    tab: '油漆工程',
    catalog_key: '油漆工程::矽酸鈣天花板'
  }];
  assert.deepEqual(grid.suggestItems(catalog, '', '', 8), []);
  const hits = grid.suggestItems(catalog, '衣櫃', '', 8);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].item, '開門高衣櫃-D60H240內');
  assert.equal('cost_unit' in hits[0], false);
  assert.equal(grid.suggestItems(catalog, '衣', '油漆工程', 8).length, 0);
  const row = grid.blankRow({ item: '衣', note: '先寫的說明' });
  grid.applyCatalogHit(row, hits[0]);
  assert.equal(row.unit, '尺');
  assert.equal(row.unit_price, 6100);
  assert.equal(row.tab, '木作工程');
  assert.equal(row.catalog_key, '木作工程::開門高衣櫃-D60H240內');
  assert.equal(row.note, '先寫的說明');
  grid.touchCell([row, grid.blankRow()], 0, 'unit_price', '5000');
  assert.equal(row.unit_price, '5000');
  assert.equal(row.catalog_price, 6100);
});

test('live line, trade, and grand totals round to integer yuan', () => {
  const cab = filled({
    item: '開門高衣櫃',
    unit: '尺',
    qty: 1.5,
    unit_price: 6100,
    is_cabinet: true
  });
  const addon = grid.blankRow({
    parent_row_id: cab.row_id,
    depth: 1,
    tab: '木作工程',
    item: '抽屜組',
    unit: '組',
    qty: 1,
    unit_price: 1200
  });
  const paint = filled({
    tab: '油漆工程',
    item: '天花板',
    unit: '坪',
    qty: 10,
    unit_price: 1650
  });
  const rows = [cab, addon, paint];
  const out = grid.recalc(rows, { measure: 3000, startup: 10000, planning: 0 });
  assert.equal(cab.amount, 9150);
  assert.equal(addon.amount, 1200);
  assert.equal(cab.line_subtotal, 10350);
  assert.equal(out.zone_subtotal, 26850);
  assert.equal(out.groups[0].tab, '木作工程');
  assert.equal(out.groups[0].subtotal, 10350);
  assert.equal(out.groups[1].tab, '油漆工程');
  assert.equal(out.groups[1].subtotal, 16500);
  assert.equal(out.totals.pretax, 26850);
  assert.equal(out.totals.tax, 1343);
  assert.equal(out.totals.with_tax, 28193);
  assert.equal(out.totals.payable, 15193);
});

test('addon row is indented under the cabinet and keeps custom name, qty, price', () => {
  const cab = filled({ item: '開門高衣櫃', unit: '尺', is_cabinet: true, line_id: 'cab1' });
  const rows = grid.ensureTrailingBlank([cab]);
  const added = grid.addAddonRow(rows, 0);
  assert.equal(added.index, 1);
  const child = rows[1];
  assert.equal(child.depth, 1);
  assert.equal(child.parent_row_id, cab.row_id);
  assert.equal(child.parent_line_id, 'cab1');
  assert.equal(child.custom, true);
  assert.equal(child.unit, '組');
  grid.touchCell(rows, 1, 'item', '特殊五金');
  grid.touchCell(rows, 1, 'qty', '2');
  grid.touchCell(rows, 1, 'unit_price', '300');
  assert.equal(rows[1].item, '特殊五金');
  assert.equal(rows[1].qty, '2');
  assert.equal(rows[1].unit_price, '300');
  assert.equal(grid.isBlank(rows[rows.length - 1]), true);
  const plain = filled({ item: '插座' });
  const no = grid.addAddonRow([plain], 0);
  assert.equal(no.index, -1);
});

test('delete, insert, and move keep addon children with the cabinet', () => {
  const cab = filled({ item: '開門高衣櫃', is_cabinet: true });
  const ad = grid.blankRow({
    parent_row_id: cab.row_id, depth: 1, item: '拉籃', unit: '組', qty: 1, unit_price: 800, tab: '木作工程'
  });
  const other = filled({ item: '天花板', tab: '油漆工程' });
  const rows = grid.ensureTrailingBlank([cab, ad, other]);
  const moved = grid.moveRow(rows, 0, 1);
  assert.equal(moved[0].item, '天花板');
  assert.equal(moved[1].item, '開門高衣櫃');
  assert.equal(moved[2].item, '拉籃');
  assert.equal(moved[2].parent_row_id, cab.row_id);
  const back = grid.moveRow(moved, 1, -1);
  assert.equal(back[0].item, '開門高衣櫃');
  assert.equal(back[1].item, '拉籃');
  const inserted = grid.insertBelow(back, 0);
  assert.equal(grid.isBlank(inserted.rows[inserted.index]), true);
  assert.ok(inserted.index > 1);
  const doomed = grid.ensureTrailingBlank([
    filled({ item: '開門高衣櫃', is_cabinet: true, row_id: 'keep' }),
  ]);
  const child = grid.blankRow({
    parent_row_id: 'keep', depth: 1, item: '抽屜', unit: '組', qty: 1, unit_price: 100, tab: '木作工程'
  });
  doomed.splice(1, 0, child);
  const removed = grid.deleteRow(doomed, 0);
  assert.equal(removed.removed.items.length, 2);
  assert.equal(doomed.some((r) => r.item === '抽屜'), false);
  grid.undoDelete(doomed, removed.removed);
  assert.equal(doomed[0].item, '開門高衣櫃');
  assert.equal(doomed[1].item, '抽屜');
  const only = grid.ensureTrailingBlank([]);
  const nope = grid.deleteRow(only, 0);
  assert.equal(nope.removed, null);
  assert.equal(only.length, 1);
});

test('picked addon item hangs under the cabinet', () => {
  const cab = filled({ item: '開門高衣櫃', unit: '尺', is_cabinet: true, line_id: 'cab1' });
  const row = filled({ item: '抽屜組-標準', tab: '木作工程', unit: '組' });
  const rows = grid.ensureTrailingBlank([cab, row]);
  const placed = grid.placeAddonIfNeeded(rows, 1);
  assert.equal(placed.moved, true);
  assert.equal(rows[1].item, '抽屜組-標準');
  assert.equal(rows[1].parent_line_id, 'cab1');
  assert.equal(rows[1].depth, 1);
});

test('autosave plan adds, updates, blocks a price change without a reason, and skips blanks', () => {
  const parent = filled({
    item: '自訂櫃', unit: '尺', qty: 2, unit_price: 1000, custom: true, dirty: true
  });
  const child = grid.blankRow({
    parent_row_id: parent.row_id,
    depth: 1,
    tab: '木作工程',
    item: '特殊五金',
    unit: '組',
    qty: 1,
    unit_price: 400,
    custom: true,
    dirty: true
  });
  const saved = filled({
    line_id: 'l-saved',
    item: '插座',
    unit: '個',
    qty: 2,
    unit_price: 300,
    saved_unit_price: 300,
    dirty: false,
    custom: true
  });
  const changed = filled({
    line_id: 'l-price',
    item: '門片',
    unit: '才',
    qty: 1,
    unit_price: 900,
    saved_unit_price: 700,
    catalog_key: '木作工程::門片',
    custom: false,
    dirty: true,
    price_override_reason: ''
  });
  const rows = grid.ensureTrailingBlank([parent, child, saved, changed]);
  const plan = grid.autosavePlan(rows, { serverLineIds: ['l-saved', 'l-price', 'l-gone'] });
  const types = plan.ops.map((op) => op.type);
  assert.equal(types[0], 'add');
  assert.equal(plan.ops[0].payload.custom, true);
  assert.equal(plan.ops[0].payload.price_override_reason, '自訂項');
  assert.equal(types[1], 'wait');
  assert.equal(types.includes('update'), false);
  assert.ok(types.includes('blocked'));
  assert.deepEqual(plan.localDeletes, ['l-gone']);
  parent.line_id = 'cab-new';
  const plan2 = grid.autosavePlan(rows, { serverLineIds: ['l-saved', 'l-price', 'cab-new'] });
  const childOp = plan2.ops.filter((op) => op.payload && op.payload.item === '特殊五金')[0];
  assert.equal(childOp.type, 'add');
  assert.equal(childOp.payload.parent_line_id, 'cab-new');
  assert.equal(childOp.payload.price_override_reason, '特殊五金自填');
  changed.price_override_reason = '客人要求';
  saved.qty = 4;
  saved.dirty = true;
  const plan3 = grid.autosavePlan(rows, { serverLineIds: ['l-saved', 'l-price', 'cab-new'] });
  const upd = plan3.ops.filter((op) => op.row_id === saved.row_id)[0];
  assert.equal(upd.type, 'update');
  assert.equal(upd.payload.qty, 4);
  const priced = plan3.ops.filter((op) => op.row_id === changed.row_id)[0];
  assert.equal(priced.type, 'update');
  assert.equal(priced.payload.price_override_reason, '客人要求');
});

test('customer lines keep unit, qty, and amount, never unit price', () => {
  const cab = filled({
    item: '開門高衣櫃', unit: '尺', qty: 1.5, unit_price: 6100, is_cabinet: true, line_id: 'c1'
  });
  const ad = grid.blankRow({
    parent_row_id: cab.row_id,
    parent_line_id: 'c1',
    depth: 1,
    item: '抽屜',
    unit: '組',
    qty: 1,
    unit_price: 1200,
    tab: '木作工程'
  });
  grid.recalc([cab, ad], {});
  const lines = grid.toCustomerLines([cab, ad, grid.blankRow()]);
  const text = JSON.stringify(lines);
  assert.equal(text.includes('unit_price'), false);
  assert.equal(text.includes('catalog_price'), false);
  assert.equal(lines[0].unit, '尺');
  assert.equal(lines[0].qty, 1.5);
  assert.equal(lines[0].amount, 9150);
  assert.equal(lines[0].addons[0].item, '抽屜');
  assert.equal(lines[0].addons[0].amount, 1200);
  assert.equal(lines[0].line_subtotal, 10350);
});

test('local draft keeps unsaved rows and hides rows removed on this browser', () => {
  const zone = {
    zone_id: 'z1',
    name: '客廳',
    lines: [{
      line_id: 'l1',
      item: '層板',
      unit: '才',
      qty: 1,
      unit_price: 100,
      amount: 100,
      tab: '木作工程',
      addons: []
    }, {
      line_id: 'l2',
      item: '要拿掉',
      unit: '式',
      qty: 1,
      unit_price: 50,
      amount: 50,
      tab: '其他',
      addons: []
    }]
  };
  const serverRows = grid.rowsFromZone(zone);
  assert.equal(grid.isBlank(serverRows[serverRows.length - 1]), true);
  const localRows = serverRows.map((r) => Object.assign({}, r));
  const kept = localRows.filter((r) => r.line_id === 'l1')[0];
  kept.item = '層板改名';
  kept.dirty = true;
  const extra = filled({ item: '還沒存', line_id: '' });
  const merged = grid.mergeLocal(serverRows, localRows.concat([extra]), ['l2']);
  assert.equal(merged.some((r) => r.line_id === 'l2'), false);
  assert.equal(merged.some((r) => r.item === '層板改名'), true);
  assert.equal(merged.some((r) => r.item === '還沒存'), true);
  assert.equal(grid.isBlank(merged[merged.length - 1]), true);
});

test('editor page wires the sheet; customer page still has no unit price column', () => {
  assert.match(editorHtml, /quote-editor-grid\.js/);
  assert.match(editorHtml, /quote-editor-grid-ui\.js/);
  assert.match(editorHtml, /成本與廠商價不會出現/);
  assert.match(gridUi, /btn-row-delete/);
  assert.match(gridUi, /btn-row-insert/);
  assert.match(gridUi, /btn-row-up/);
  assert.match(gridUi, /btn-row-down/);
  assert.match(gridUi, /btn-addon-add/);
  assert.match(gridUi, /＋加購/);
  assert.match(gridUi, /paste/);
  assert.match(gridUi, /自動暫存/);
  assert.doesNotMatch(gridUi, /QUOTE_EDITOR_ENABLED/);
  assert.doesNotMatch(readFileSync(join(root, 'modules/projects/js/quote-editor-grid.js'), 'utf8'), /QUOTE_EDITOR_ENABLED/);
  assert.doesNotMatch(viewHtml, /<th>單價<\/th>/);
  assert.match(viewHtml, /金額/);
});
