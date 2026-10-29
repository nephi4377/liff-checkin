#!/usr/bin/env node
/**
 * MantleDB v2 → SEC-1 Google Sheet 匯入計畫（預設 dry-run，不寫入 Mantle、不寫 Sheet）。
 *
 * 用法：
 *   node scripts/mantle-to-sheet-migration.mjs              # dry-run，僅印步驟
 *   node scripts/mantle-to-sheet-migration.mjs --export path.json  # 驗證匯出 JSON 欄位
 *
 * 取得 Mantle 匯出需在本機以既有 Mantle 工具／PIN 匯出 JSON；此腳本不含金鑰、不呼叫 Mantle API。
 */
import fs from 'node:fs';

const SHEET_ID = '1QfVtsf7Pr9Nmn7wOmC-xYceNq7ChFclM2aoh5JvJ01Q';
const MANTLE_ROOM = 'yang-employee-todo-v2-1792379200';

const args = process.argv.slice(2);
const exportIdx = args.indexOf('--export');
const exportPath = exportIdx >= 0 ? args[exportIdx + 1] : null;
const dryRun = !args.includes('--apply');

console.log('=== 員工待辦 Mantle → Sheet 匯入（計畫）===');
console.log('Mantle room:', MANTLE_ROOM);
console.log('Target Sheet:', SHEET_ID);
console.log('Mode:', dryRun ? 'DRY-RUN（預設）' : 'APPLY 未實作 — 請勿使用');
console.log('');

const steps = [
  '1. 凍結 Mantle 正式寫入：通知使用者暫時只用 Mantle 唯讀或停更。',
  '2. 自 Mantle room 匯出 tasks／officeTasks／assigners JSON（公司既有流程）。',
  '3. 執行本腳本 --export file.json 做欄位對照與筆數摘要（仍不寫 Sheet）。',
  '4. 由負責人在 project-console GAS 後端執行一次性 import（需另開維護窗；本 PR 不含 GAS 改動）。',
  '5. 比對 Sheet open 列與 Mantle 匯出；確認 SEC-1 新 URL 可 todo_list。',
  '6. 公告新 URL（/modules/projects/employee-todo/）；舊 /employee-todo/ 轉址＋SW 卸載見 cut-over checklist（另 PR）。',
  '7. 禁止任何 SEC-1 或腳本寫回 MantleDB。',
];

steps.forEach((s) => console.log(s));

if (exportPath) {
  if (!fs.existsSync(exportPath)) {
    console.error('Export file not found:', exportPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  const tasks = raw.tasks || raw.data?.tasks || [];
  const open = tasks.filter((t) => t && !t.completed && !t.trashedAt);
  console.log('');
  console.log('Export summary:');
  console.log('  tasks:', tasks.length);
  console.log('  open (not completed, not trashed):', open.length);
  console.log('  sample titles:', open.slice(0, 5).map((t) => t.title));
  console.log('');
  console.log('DRY-RUN: no Sheet write performed.');
}

if (!dryRun) {
  console.error('--apply is not implemented in this repository. Use GAS maintenance import.');
  process.exit(2);
}
