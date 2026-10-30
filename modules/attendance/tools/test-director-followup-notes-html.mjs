/**
 * 靜態檢查待跟進 inbox 頁人機閉環關鍵字。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'director_followup_notes.html'), 'utf8');
const hr = fs.readFileSync(path.join(__dirname, '..', 'director_hr_notes.html'), 'utf8');
const project = fs.readFileSync(path.join(__dirname, '..', 'director_project_notes.html'), 'utf8');
const party = fs.readFileSync(path.join(__dirname, '..', 'director_party_notes.html'), 'utf8');
const decision = fs.readFileSync(path.join(__dirname, '..', 'director_decision_notes.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes('要跟進'), '要跟進按鈕');
assert(html.includes('一句話'), '一句話欄');
assert(html.includes('到期日'), '到期日欄');
assert(html.includes('請填寫一句話'), '缺一句話提示');
assert(html.includes('btn-complete') || html.includes('做完'), '勾做完');
assert(html.includes('btn-restore') || html.includes('還原'), '還原');
assert(html.includes('過期') || html.includes('badge-overdue'), '過期醒目');
assert(html.includes('未完成'), '未完成區');
assert(html.includes('已完成'), '已完成區');
assert(html.includes('處理中'), '處理中');
assert(html.includes('已存'), '已存');
assert(html.includes('director_followup_notes'), 'API');
assert(html.includes('localDemo'), 'localDemo');
assert(html.includes('更新中'), '更新中');
assert(hr.includes('總監人事筆記'), '人事保留');
assert(hr.includes('link-followup-notes'), '人事連待跟進');
assert(project.includes('link-followup'), '專案連待跟進');
assert(party.includes('link-followup'), '對象連待跟進');
assert(decision.includes('link-followup'), '決策連待跟進');

console.log('OK test-director-followup-notes-html');
