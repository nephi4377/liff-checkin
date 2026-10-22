/**
 * BUDGET-PARSE-778 / 778b–778e 自動測試（假資料，無客戶個資）
 * 執行：node tools/test_budget_parse_778.mjs
 */
import { createRequire } from 'module';
import { writeFileSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, 'package.json'));
const XLSX = require('xlsx');
const parser = require('./budget-quote-parser-lib.js');

const FIXTURE_PATH = join(__dirname, '_tmp_budget_parse_778_fixture.xlsx');
const TARGET_ADJUST_SUM = 116480;
const METADATA_KW = ['估價單', '電話'];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pushStdRow(rows, id, name, unit, qty, total, jCost) {
  rows.push([String(id), name, unit, qty, 10, total, '', '', '', jCost, '']);
}

function pushAdjustCompactRow(rows, name, unit, qty, total, kCost = '') {
  rows.push([name, '', '', unit, qty, total, '', '', '', '', kCost]);
}

function pushAdjustSubHeader(rows, zone) {
  rows.push([zone, '', '', '', '', '', '', '', '', '', '']);
}

function buildMockSheet() {
  const rows = [];
  rows.push(['測試市示範路99號4樓之1', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['電話：示意專線', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['項次', '品項', '單位', '數量', '單價', '總價', '備註', '', '', '成本J', '成本K']);

  for (let i = 1; i <= 87; i++) {
    pushStdRow(rows, i, `工項${i}`, '式', 1, 10, 70000 + i);
  }

  rows.push(['', '付款條件示意（第二期）', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '水電明細表（示意）', '', '', '', '', '', '', '', '', '']);
  rows.push(['1399805', '', '', '', '', '', '', '', '', '', '']);

  for (let i = 88; i <= 97; i++) {
    pushStdRow(rows, 160 + i, `尾段工項${i}`, '式', 1, 50, 71000 + i);
  }

  rows.push(['', '廚房', 0, 0, 0, 0, '', '', '', '', '']);
  pushStdRow(rows, '', '建議方案-加裝照明', '式', 1, 1200, 66666);
  pushStdRow(rows, '', '建議方案-換開關', '組', 1, 800, 55555);

  rows.push(['簽約後續增減', '', '', '', '', '', '', '', '', '', '']);

  const adjustAmounts = [-71400, 5000, 3200, 1000, 1100, 1200, 1300, 800, 900, 400, 410, 420, 430, 440, 300, 310, 320, 2000, 2100, 2200, 1500];
  adjustAmounts.push(TARGET_ADJUST_SUM - adjustAmounts.reduce((a, b) => a + b, 0));

  const names = [
    '拆除工程重新評估',
    '餐廳增項A',
    '餐廳增項B',
    '男孩房增項1',
    '男孩房增項2',
    '男孩房增項3',
    '男孩房增項4',
    '走道增項1',
    '走道增項2',
    '插座增項1',
    '插座增項2',
    '插座增項3',
    '插座增項4',
    '插座增項5',
    '開關增項1',
    '開關增項2',
    '開關增項3',
    '客廳/主臥電話線',
    '陽台封窗1',
    '陽台封窗2',
    '陽台封窗3',
    '客浴增項1',
  ];
  assert(names.length === 22 && adjustAmounts.length === 22, 'adjust 應 22 筆');

  pushAdjustSubHeader(rows, '餐廳');
  pushAdjustCompactRow(rows, names[0], '式', 1, adjustAmounts[0]);
  pushAdjustCompactRow(rows, names[1], '式', 1, adjustAmounts[1]);
  pushAdjustCompactRow(rows, names[2], '式', 1, adjustAmounts[2]);
  pushAdjustSubHeader(rows, '男孩房');
  for (let k = 3; k <= 6; k++) pushAdjustCompactRow(rows, names[k], '式', 1, adjustAmounts[k]);
  pushAdjustSubHeader(rows, '走道');
  pushAdjustCompactRow(rows, names[7], '式', 1, adjustAmounts[7]);
  pushAdjustCompactRow(rows, names[8], '式', 1, adjustAmounts[8]);
  pushAdjustCompactRow(rows, '拆除後壁面修補', '式', 1, '');
  pushAdjustCompactRow(rows, '拆除後地面復原', '式', 1, '');
  pushAdjustSubHeader(rows, '插座');
  for (let k = 9; k <= 13; k++) pushAdjustCompactRow(rows, names[k], '式', 1, adjustAmounts[k]);
  pushAdjustSubHeader(rows, '開關');
  for (let k = 14; k <= 16; k++) pushAdjustCompactRow(rows, names[k], '式', 1, adjustAmounts[k]);
  pushAdjustCompactRow(rows, names[17], '式', 1, adjustAmounts[17]);
  pushAdjustSubHeader(rows, '陽台封窗');
  for (let k = 18; k <= 20; k++) pushAdjustCompactRow(rows, names[k], '式', 1, adjustAmounts[k]);
  pushAdjustSubHeader(rows, '客浴');
  for (let k = 21; k <= 22; k++) pushAdjustCompactRow(rows, names[k], '式', 1, adjustAmounts[k]);

  rows.push(['', '簽約後續增減合計(未稅)', '式', 1, 0, TARGET_ADJUST_SUM, '', '', '', '', '']);
  pushStdRow(rows, 201, '增減後油漆A', '式', 1, 2500, 72001);
  pushStdRow(rows, 202, '增減後油漆B', '式', 1, 5000, 72002);
  pushStdRow(rows, 203, '增減後油漆C', '式', 1, 20000, 72003);

  rows.push(['', '訂購人簽名：', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '含稅總計', '', '', 1592099, '']);
  return rows;
}

function findRowForItem(json, item, colMapping, startRow) {
  for (let i = startRow; i < json.length; i++) {
    const row = json[i];
    let picked = parser.pickItemFields(row, colMapping);
    if (!picked) picked = parser.pickAdjustCompactItemFields(row);
    if (picked && picked.name === item.data.name && String(picked.qtyVal) === String(item.data.qty)) {
      return row;
    }
  }
  return null;
}

function run() {
  const aoa = buildMockSheet();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, '0818');
  writeFileSync(FIXTURE_PATH, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

  const loaded = XLSX.readFile(FIXTURE_PATH);
  const json = XLSX.utils.sheet_to_json(loaded.Sheets['0818'], { header: 1, defval: '' });
  const { items, taxInclusiveTotal } = parser.parseSheetRows(json, '0818', { metadataKeywords: METADATA_KW });
  const counts = parser.classifyItemCounts(items);
  const adjustSum = parser.sumAdjustItemPrices(items);
  const { colMapping, startRow } = parser.detectColMappingFromHeaderRows(json);

  const headers = items.filter((it) => it.type === 'header').map((h) => h.zone);
  assert(!headers.some((z) => /4樓之1/.test(z)), '表頭地址不得被當成分區');
  assert(headers.includes('廚房'), '廚房分區應辨識');
  assert(headers.includes('簽約後續增減'), '簽約後續增減應為分區');

  const tailWork = items.filter((i) => i.type === 'item' && /^尾段工項/.test(i.data.name));
  assert(tailWork.length === 10, `付款條件後尾段工項應 10 筆，實際 ${tailWork.length}`);

  assert(counts.work === 100, `一般工項應 100 筆，實際 ${counts.work}`);
  assert(counts.suggest === 2, `建議工項應 2 筆，實際 ${counts.suggest}`);
  assert(counts.adjust === 23, `增減工項應 23 筆，實際 ${counts.adjust}`);
  assert(adjustSum === TARGET_ADJUST_SUM, `增減加總應 ${TARGET_ADJUST_SUM}，實際 ${adjustSum}`);
  assert(taxInclusiveTotal === 1592099, `含稅總計應 1592099，實際 ${taxInclusiveTotal}`);

  const itemNames = items.filter((i) => i.type === 'item').map((i) => i.data.name);
  assert(itemNames.includes('客廳/主臥電話線'), '品名含電話且有單位數量應保留');
  assert(!itemNames.includes('拆除後壁面修補'), '合計空白列不得算工項');

  const paints = items.filter((i) => i.type === 'item' && /^增減後油漆/.test(i.data.name));
  assert(paints.length === 3, '增減合計後油漆應 3 筆');
  paints.forEach((p) => assert(!parser.isAdjustItem(p), '增減合計後油漆應算一般工項'));

  items
    .filter((r) => r.type === 'item')
    .forEach((it) => {
      const row = findRowForItem(json, it, colMapping, startRow);
      assert(row, `找不到來源列：${it.data.name}`);
      assert(
        !parser.rawLineContainsInternalCostValues(row, it.data.raw_line),
        `raw_line 含 J/K 成本：${it.data.name}`
      );
    });

  console.log('✅ test_budget_parse_778 通過');
  console.log(JSON.stringify({ counts, adjustSum, taxInclusiveTotal }, null, 2));
}

try {
  run();
} finally {
  try {
    unlinkSync(FIXTURE_PATH);
  } catch (_) {}
}
