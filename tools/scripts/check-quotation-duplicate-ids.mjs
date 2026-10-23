#!/usr/bin/env node
/**
 * 只讀：檢查 budget context JSON（或 quotations 節點匯出）內 items 重複 id。
 * 用法：node tools/scripts/check-quotation-duplicate-ids.mjs path/to/context.json
 * 不連 Firebase、不寫入。
 */
import fs from 'fs';

const path = process.argv[2];
if (!path) {
    console.error('用法: node tools/scripts/check-quotation-duplicate-ids.mjs <json-file>');
    process.exit(2);
}

const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const items = raw.items || raw.context?.items || [];
const byId = new Map();

items.forEach((it, idx) => {
    const id = it?.id ? String(it.id) : `(missing@${idx})`;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push({ index: idx, name: it?.name || '' });
});

const dups = [...byId.entries()].filter(([, rows]) => rows.length > 1);
const missing = [...byId.entries()].filter(([id]) => id.startsWith('(missing'));

console.log(JSON.stringify({ totalItems: items.length, duplicateIdGroups: dups.length, missingIdRows: missing.length }, null, 2));
if (dups.length) {
    dups.forEach(([id, rows]) => {
        console.log(`\nDUPLICATE ${id} (${rows.length} rows):`);
        rows.forEach((r) => console.log(`  #${r.index} ${r.name}`));
    });
    process.exit(1);
}
process.exit(0);
