#!/usr/bin/env node
/**
 * TX34 本機試跑 778 quote.xlsx（不會上傳、不會同步雲端）
 *
 * 用法：
 *   node tools/run-budget-parse-778-local.mjs --xlsx "D:\path\quote.xlsx" --sheet 0818
 *
 * 預期（0818 真實案）：工項 100、建議 2、增減 23、含稅總計 1,592,099
 */
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, 'package.json'));
const XLSX = require('xlsx');
const parser = require('./budget-quote-parser-lib.js');

function parseArgs(argv) {
  const out = { xlsx: '', sheet: '0818' };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--xlsx' && argv[i + 1]) {
      out.xlsx = argv[++i];
    } else if (argv[i] === '--sheet' && argv[i + 1]) {
      out.sheet = argv[++i];
    }
  }
  return out;
}

const { xlsx, sheet } = parseArgs(process.argv);
if (!xlsx) {
  console.error('請提供 --xlsx 報價單路徑');
  process.exit(1);
}

const abs = resolve(xlsx);
const wb = XLSX.readFile(abs);
if (!wb.SheetNames.includes(sheet)) {
  console.error(`找不到工作表「${sheet}」，現有：${wb.SheetNames.join(', ')}`);
  process.exit(1);
}

const json = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: '' });
const { items, taxInclusiveTotal } = parser.parseSheetRows(json, sheet, {
  metadataKeywords: ['住址', '電話', '簽名', '定金', '支付', '發票', '尾款', '估價單']
});
const counts = parser.classifyItemCounts(items);

const result = {
  sheet,
  file: abs,
  workItems: counts.work,
  suggestItems: counts.suggest,
  adjustItems: counts.adjust,
  totalItems: counts.total,
  taxInclusiveTotal,
  expected: {
    workItems: 100,
    suggestItems: 2,
    adjustItems: 23,
    taxInclusiveTotal: 1592099
  }
};

console.log(JSON.stringify(result, null, 2));

const ok =
  counts.work === 100 &&
  counts.suggest === 2 &&
  counts.adjust === 23 &&
  taxInclusiveTotal === 1592099;

if (!ok) {
  console.error('⚠️ 與預期不符，請檢查解析規則或工作表內容。');
  process.exit(2);
}

console.log('✅ 與預期一致');
