#!/usr/bin/env node
/**
 * MantleDB v2 → SEC-1 Google Sheet 匯入計畫（預設 dry-run，不寫入 Mantle、不寫 Sheet）。
 *
 * 用法：
 *   npm run migration:plan
 *   node scripts/mantle-to-sheet-migration.mjs --export mantle.json
 *   node scripts/mantle-to-sheet-migration.mjs --export mantle.json --sheet-snapshot sheet.json
 *
 * --export：Mantle room 匯出 JSON（tasks 陣列）。腳本只讀檔案，不呼叫 Mantle API。
 * --sheet-snapshot：Sheet 側匯出／快照 JSON（同 tasks 結構），用於 diff；仍不寫入。
 *
 * --apply：未實作（永遠 exit 2）。
 */
import fs from 'node:fs';

const SHEET_ID = '1QfVtsf7Pr9Nmn7wOmC-xYceNq7ChFclM2aoh5JvJ01Q';
const MANTLE_ROOM = 'yang-employee-todo-v2-1792379200';

const args = process.argv.slice(2);

function readTasks(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return raw.tasks || raw.data?.tasks || [];
}

function summarizeTasks(tasks, label) {
  const open = tasks.filter((t) => t && !t.completed && !t.trashedAt);
  const completed = tasks.filter((t) => t && t.completed && !t.trashedAt);
  const trashed = tasks.filter((t) => t && t.trashedAt);
  console.log(`--- ${label} ---`);
  console.log('  total tasks:', tasks.length);
  console.log('  open:', open.length);
  console.log('  completed:', completed.length);
  console.log('  trashed:', trashed.length);
  if (open.length) {
    console.log(
      '  open titles:',
      open.slice(0, 8).map((t) => t.title || t.id),
    );
  }
  return { open, completed, trashed, all: tasks };
}

function taskKey(t) {
  return String(t.id || t.title || '').trim();
}

function diffOpen(mantleOpen, sheetOpen) {
  const mKeys = new Set(mantleOpen.map(taskKey).filter(Boolean));
  const sKeys = new Set(sheetOpen.map(taskKey).filter(Boolean));
  const onlyMantle = [...mKeys].filter((k) => !sKeys.has(k));
  const onlySheet = [...sKeys].filter((k) => !mKeys.has(k));
  console.log('--- diff (open tasks, by id/title key) ---');
  console.log('  only in Mantle export:', onlyMantle.length, onlyMantle.slice(0, 10));
  console.log('  only in Sheet snapshot:', onlySheet.length, onlySheet.slice(0, 10));
  console.log('  open count delta (Mantle − Sheet):', mantleOpen.length - sheetOpen.length);
}

const exportIdx = args.indexOf('--export');
const exportPath = exportIdx >= 0 ? args[exportIdx + 1] : null;
const sheetIdx = args.indexOf('--sheet-snapshot');
const sheetPath = sheetIdx >= 0 ? args[sheetIdx + 1] : null;
const dryRun = !args.includes('--apply');

console.log('=== 員工待辦 Mantle → Sheet 匯入（計畫）===');
console.log('Mantle room:', MANTLE_ROOM);
console.log('Target Sheet:', SHEET_ID);
console.log('Mode:', dryRun ? 'DRY-RUN（預設）' : 'APPLY 未實作 — 請勿使用');
console.log('');

[
  '1. 凍結 Mantle 正式寫入（cut-over 前）。',
  '2. 匯出 Mantle JSON → 本腳本 --export。',
  '3. （選）匯出 Sheet 快照 → --sheet-snapshot，看 diff。',
  '4. GAS 一次性 import（另 PR／維護窗）；禁止寫回 Mantle。',
  '5. 部署 SEC-1 URL 後 todo_list 驗證。',
  '6. 舊 /employee-todo/ 轉址 + SW 卸載：cut-over checklist（本 PR 不做）。',
].forEach((s) => console.log(s));

if (exportPath) {
  if (!fs.existsSync(exportPath)) {
    console.error('Export file not found:', exportPath);
    process.exit(1);
  }
  const mantle = summarizeTasks(readTasks(exportPath), 'Mantle export');
  if (sheetPath) {
    if (!fs.existsSync(sheetPath)) {
      console.error('Sheet snapshot not found:', sheetPath);
      process.exit(1);
    }
    const sheet = summarizeTasks(readTasks(sheetPath), 'Sheet snapshot');
    diffOpen(mantle.open, sheet.open);
  }
  console.log('');
  console.log('DRY-RUN: no Mantle or Sheet write performed.');
}

if (!dryRun) {
  console.error('--apply is not implemented in this repository. Use GAS maintenance import.');
  process.exit(2);
}
