#!/usr/bin/env node
/**
 * 一次性補 id：僅處理「真重複」的 id（同字串多筆），第 2 筆起 _2、_3（跳過已占用）。
 * 預設 dry-run；--write-out 寫檔（不連 Firebase）。執行正式雲端前須豪哥核准。
 */
import fs from 'fs';
import { migrateDuplicateItemIdsOnly } from '../quotation-item-id-migrate.js';

const args = process.argv.slice(2);
const inPath = args[0];
const writeOutIdx = args.indexOf('--write-out');
const writeOut = writeOutIdx >= 0 ? args[writeOutIdx + 1] : null;

if (!inPath) {
    console.error('用法: node tools/scripts/migrate-quotation-item-ids.mjs <json> [--write-out out.json]');
    process.exit(2);
}

const doc = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const items = doc.items || doc.context?.items;
if (!Array.isArray(items)) {
    console.error('找不到 items 陣列');
    process.exit(2);
}

const { items: migrated, changes } = migrateDuplicateItemIdsOnly(items);

console.log(JSON.stringify({ dryRun: !writeOut, changeCount: changes.length, changes: changes.slice(0, 20) }, null, 2));
if (changes.length > 20) console.log(`…另有 ${changes.length - 20} 筆`);

if (writeOut) {
    if (doc.context?.items) doc.context.items = migrated;
    else doc.items = migrated;
    fs.writeFileSync(writeOut, JSON.stringify(doc, null, 2));
    console.log(`已寫入 ${writeOut}`);
}
