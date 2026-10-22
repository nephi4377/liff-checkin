/**
 * BUDGET-PARSE-778 自動測試（假資料，無客戶個資）
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

function buildMockSheet() {
  const rows = [];
  rows.push(['', '', '', '', '', '', '', '', '', '']);
  rows.push(['項次', '品項', '單位', '數量', '單價', '總價', '備註', '', '', '成本']);
  rows.push(['1', '假案場地坪', '式', 1, 10000, 10000, '', '', '', 8888]);
  rows.push(['', '主臥', 0, 0, 0, 0, '', '', '', '']);
  rows.push(['2', '主臥木作', '式', 1, 5000, 5000, '', '', '', 7777]);
  rows.push(['', '建議方案', 0, 0, 0, 0, '', '', '', '']);
  rows.push(['', '建議加裝照明', '式', 1, 0, 1200, '', '', '', 6666]);
  rows.push(['', '建議換線', '組', 2, 0, 800, '', '', '', 5555]);
  rows.push(['', '簽約後續增減', 0, 0, 0, 0, '', '', '', '']);
  for (let i = 1; i <= 23; i++) {
    rows.push(['', '', `增減工項${i}`, '式', 1, 100 * i, 100 * i, '', '', '', 4000 + i]);
  }
  rows.push(['', '', '', '', '', '', '含稅總計', '', '', 1592099]);
  return rows;
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

  const headers = items.filter((it) => it.type === 'header').map((h) => h.zone);
  assert(headers.includes('主臥'), '主臥分區應辨識為標題（單位/總價填 0）');
  assert(counts.work === 2, `一般工項應 2 筆（假案場地坪＋主臥木作），實際 ${counts.work}`);
  assert(counts.suggest === 2, `建議工項應 2 筆，實際 ${counts.suggest}`);
  assert(counts.adjust === 23, `增減工項應 23 筆，實際 ${counts.adjust}`);
  assert(taxInclusiveTotal === 1592099, `含稅總計應 1592099，實際 ${taxInclusiveTotal}`);

  const exportItems = items.filter((r) => r.type === 'item').map((r) => parser.sanitizeItemForExport(r.data));
  assert(!parser.exportPayloadContainsForbiddenKeys({ items: exportItems }), '匯出不得含 cost 欄位');
  const blob = JSON.stringify({ items: exportItems });
  assert(!blob.includes('8888') && !blob.includes('7777'), 'J 欄成本不得出現在匯出 JSON');

  const rawLines = exportItems.map((i) => i.raw_line).join('|');
  assert(!rawLines.includes('8888'), 'raw_line 不得含 J 欄成本');

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
