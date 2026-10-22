/**
 * BUDGET-PARSE-778 / 778b / 778c 自動測試（假資料，無客戶個資）
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function pushAdjustBlock(rows, zone, count, idBase) {
  rows.push(['', zone, 0, 0, 0, 0, '', '', '', '', '']);
  for (let j = 0; j < count; j++) {
    const jCost = 80000 + idBase + j;
    const kCost = 90000 + idBase + j;
    rows.push(['', '', `${zone}-增項${j + 1}`, '式', 1, 100 + j, 100 + j, '', '', jCost, kCost]);
  }
}

function buildMockSheet() {
  const rows = [];
  rows.push(['測試市示範路99號4樓之1', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['項次', '品項', '單位', '數量', '單價', '總價', '備註', '', '', '成本J', '成本K']);
  for (let i = 1; i <= 100; i++) {
    const jCost = 70000 + i;
    rows.push([String(i), `工項${i}`, '式', 1, 10, 10, '', '', '', jCost, '']);
  }
  rows.push(['', '廚房', 0, 0, 0, 0, '', '', '', '', '']);
  rows.push(['', '建議方案-加裝照明', '式', 1, 0, 1200, '', '', '', 66666, '']);
  rows.push(['', '建議方案-換開關', '組', 1, 0, 800, '', '', '', 55555, '']);
  rows.push(['簽約後續增減', '', 0, 0, 0, 0, '', '', '', '', '']);
  pushAdjustBlock(rows, '餐廳', 3, 1);
  pushAdjustBlock(rows, '男孩房', 4, 10);
  pushAdjustBlock(rows, '走道', 2, 20);
  pushAdjustBlock(rows, '插座', 5, 30);
  pushAdjustBlock(rows, '開關', 3, 40);
  pushAdjustBlock(rows, '陽台封窗', 3, 50);
  pushAdjustBlock(rows, '客浴', 3, 60);
  rows.push(['', '增減合計(未稅)', '式', 1, 0, 50000, '', '', '', '', '']);
  rows.push(['103', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '1399805', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '-278000', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '75814.25', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '5%發票稅', '式', 1, 0, 75814, '', '', '', '', '']);
  rows.push(['', '3. 假條款說明示意', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '6. 另一條假條款', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '訂購人簽名：', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '客戶確認欄', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '合計', '式', 1, 0, 999999, '', '', '', 12345, 67890]);
  rows.push(['', '客廳', 0, 0, 0, 0, '', '', '', '', '']);
  rows.push(['', '', '', '', '', '', '含稅總計', '', '', 1592099, '']);
  return rows;
}

function findRowForItem(json, item, colMapping, startRow) {
  for (let i = startRow; i < json.length; i++) {
    const row = json[i];
    const picked = parser.pickItemFields(row, colMapping);
    if (picked && picked.name === item.data.name && picked.qtyVal === item.data.qty) {
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
  const { items, taxInclusiveTotal } = parser.parseSheetRows(json, '0818', { metadataKeywords: ['估價單'] });
  const counts = parser.classifyItemCounts(items);
  const { colMapping, startRow } = parser.detectColMappingFromHeaderRows(json);

  const headers = items.filter((it) => it.type === 'header').map((h) => h.zone);
  assert(!headers.some((z) => /4樓之1/.test(z)), '表頭地址不得被當成分區');
  assert(headers.includes('廚房'), '廚房分區應辨識');
  assert(headers.includes('簽約後續增減'), '簽約後續增減應為分區');
  assert(headers.includes('餐廳') && headers.includes('走道'), '增減區子標題應保留');
  assert(!headers.includes('客廳'), '表尾後不得再開客廳小節');
  assert(!headers.some((z) => /^103$/.test(z) || z === '1399805'), '純數字不得為小節');

  assert(counts.work === 100, `一般工項應 100 筆，實際 ${counts.work}`);
  assert(counts.suggest === 2, `建議工項應 2 筆，實際 ${counts.suggest}`);
  assert(counts.adjust === 23, `增減工項應 23 筆，實際 ${counts.adjust}`);
  assert(taxInclusiveTotal === 1592099, `含稅總計應 1592099，實際 ${taxInclusiveTotal}`);

  const itemNames = items.filter((i) => i.type === 'item').map((i) => i.data.name);
  assert(!itemNames.some((n) => n === '合計' || /增減合計/.test(n) || /發票稅/.test(n)), '合計／稅務列不得算工項');

  const adjustUnderSub = items.filter(
    (i) => i.type === 'item' && i.data.zone === '走道' && i.data.in_adjust_section
  );
  assert(adjustUnderSub.length === 2, '走道子區工項應仍屬增減');

  const exportItems = items.filter((r) => r.type === 'item').map((r) => parser.sanitizeItemForExport(r.data));
  assert(!parser.exportPayloadContainsForbiddenKeys({ items: exportItems }), '匯出不得含內部欄位');

  items
    .filter((r) => r.type === 'item')
    .forEach((it) => {
      const row = findRowForItem(json, it, colMapping, startRow);
      assert(row, `找不到來源列：${it.data.name}`);
      assert(
        !parser.rawLineContainsInternalCostValues(row, it.data.raw_line),
        `raw_line 含 J/K 成本：${it.data.name} → ${it.data.raw_line}`
      );
    });

  console.log('✅ test_budget_parse_778 通過');
  console.log(JSON.stringify({ counts, taxInclusiveTotal }, null, 2));
}

try {
  run();
} finally {
  try {
    unlinkSync(FIXTURE_PATH);
  } catch (_) {}
}
