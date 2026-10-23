#!/usr/bin/env node
/**
 * 一次性補 id 工具（解析器規則：同 base id 第 2 筆起 _2、_3）。
 * 預設 dry-run 只印 diff；--write-out <file> 寫出新 JSON（仍不連 Firebase）。
 * 執行正式雲端前須豪哥核准。
 *
 * 驗收進度：若雲端已有 completion 綁在舊的重複 id 上，補 id 後僅「保留順序的第 1 筆」
 * 仍沿用原 id；第 2、3 筆變新 id 會失去原進度（需人工對照名稱+規格轉移）。
 */
import fs from 'fs';

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

const counts = new Map();
const changes = [];

const nextId = (baseId) => {
    const n = (counts.get(baseId) || 0) + 1;
    counts.set(baseId, n);
    if (n === 1) return baseId;
    return `${baseId}_${n}`;
};

const migrated = items.map((it, index) => {
    const base = it?.id ? String(it.id).replace(/_\d+$/, '') : `MISSING_R${index}`;
    const assigned = nextId(base);
    if (it?.id !== assigned) {
        changes.push({ index, from: it?.id, to: assigned, name: it?.name });
    }
    return { ...it, id: assigned };
});

console.log(JSON.stringify({ dryRun: !writeOut, changeCount: changes.length, changes: changes.slice(0, 20) }, null, 2));
if (changes.length > 20) console.log(`…另有 ${changes.length - 20} 筆`);

if (writeOut) {
    if (doc.context?.items) doc.context.items = migrated;
    else doc.items = migrated;
    fs.writeFileSync(writeOut, JSON.stringify(doc, null, 2));
    console.log(`已寫入 ${writeOut}`);
}
