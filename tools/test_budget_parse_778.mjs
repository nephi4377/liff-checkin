/**
 * BUDGET-PARSE-778 / 778b–778d 自動測試（假資料，無客戶個資）
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

/** 增減緊湊版面：品名 col0、單位 3、數量 4、合計 5 */
function pushAdjustCompactRow(rows, name, unit, qty, total, kCost = '') {
  rows.push([name, '', '', unit, qty, total, '', '', '', '', kCost]);
}

function pushAdjustSubHeader(rows, zone) {
  rows.push([zone, '', '', '', '', '', '', '', '', '', '']);
}

function pushAdjustBlockCompact(rows, zone, items) {
  pushAdjustSubHeader(rows, zone);
  items.forEach(([name, unit, qty, total]) => pushAdjustCompactRow(rows, name, unit, qty, total, 91000));
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

  rows.push(['103', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '1399805', '', '', '', '', '', '', '', '', '']);
  rows.push(['', '5%發票稅', '式', 1, 0, 75814, '', '', '', '', '']);
  rows.push(['', '訂購人簽名：', '', '', '', '', '', '', '', '', '']);

  rows.push(['簽約後續增減', '', '', '', '', '', '', '', '', '', '']);
  pushAdjustBlockCompact(rows, '餐廳', [
    ['拆除工程重新評估', '式', 1, -71400],
    ['餐廳增項A', '式', 1, 5000],
    ['餐廳增項B', '式', 1, 3200],
  ]);
  pushAdjustBlockCompact(rows, '男孩房', [
    ['男孩房增項1', '式', 1, 1000],
    ['男孩房增項2', '式', 1, 1100],
    ['男孩房增項3', '式', 1, 1200],
    ['男孩房增項4', '式', 1, 1300],
  ]);
  pushAdjustBlockCompact(rows, '走道', [
    ['走道增項1', '式', 1, 800],
    ['走道增項2', '式', 1, 900],
  ]);
  pushAdjustCompactRow(rows, '拆除後壁面修補', '式', 1, '');
  pushAdjustCompactRow(rows, '拆除後地面復原', '式', 1, '');
  pushAdjustBlockCompact(rows, '插座', [
    ['插座增項1', '式', 1, 400],
    ['插座增項2', '式', 1, 410],
    ['插座增項3', '式', 1, 420],
    ['插座增項4', '式', 1, 430],
    ['插座增項5', '式', 1, 440],
  ]);
  pushAdjustBlockCompact(rows, '開關', [
    ['開關增項1', '式', 1, 300],
    ['開關增項2', '式', 1, 310],
    ['開關增項3', '式', 1, 320],
  ]);
  pushAdjustBlockCompact(rows, '陽台封窗', [
    ['陽台封窗1', '式', 1, 2000],
    ['陽台封窗2', '式', 1, 2100],
    ['陽台封窗3', '式', 1, 2200],
  ]);
  pushAdjustBlockCompact(rows, '客浴', [
    ['客浴增項1', '式', 1, 1500],
    ['客浴增項2', '式', 1, 1600],
    ['客浴增項3', '式', 1, 1700],
  ]);

  rows.push(['', '增減合計(未稅)', '式', 1, 0, 50000, '', '', '', '', '']);
  rows.push(['', '客廳', 0, 0, 0, 0, '', '', '', '', '']);
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
  const { items, taxInclusiveTotal } = parser.parseSheetRows(json, '0818', { metadataKeywords: ['估價單'] });
  const counts = parser.classifyItemCounts(items);
  const { colMapping, startRow } = parser.detectColMappingFromHeaderRows(json);

  const headers = items.filter((it) => it.type === 'header').map((h) => h.zone);
  assert(!headers.some((z) => /4樓之1/.test(z)), '表頭地址不得被當成分區');
  assert(headers.includes('廚房'), '廚房分區應辨識');
  assert(headers.includes('簽約後續增減'), '表尾後簽約後續增減應重新開區');
  assert(headers.includes('餐廳') && headers.includes('走道'), '增減區子標題應保留');
  assert(!headers.includes('客廳'), '增減合計後不得再開客廳小節');

  assert(counts.work === 100, `一般工項應 100 筆，實際 ${counts.work}`);
  assert(counts.suggest === 2, `建議工項應 2 筆，實際 ${counts.suggest}`);
  assert(counts.adjust === 23, `增減工項應 23 筆，實際 ${counts.adjust}`);
  assert(taxInclusiveTotal === 1592099, `含稅總計應 1592099，實際 ${taxInclusiveTotal}`);

  const itemNames = items.filter((i) => i.type === 'item').map((i) => i.data.name);
  assert(!itemNames.includes('拆除後壁面修補'), '合計空白列不得算工項');
  assert(!itemNames.includes('拆除後地面復原'), '合計空白列不得算工項');
  assert(itemNames.includes('拆除工程重新評估'), '增減緊湊版面負數合計應算工項');

  const neg = items.find((i) => i.type === 'item' && i.data && i.data.name === '拆除工程重新評估');
  assert(neg && String(neg.data.price).includes('-71400'), '應保留負數合計');

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
