/**
 * 靜態檢查決策紀錄頁人機閉環關鍵字。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'director_decision_notes.html'), 'utf8');
const hr = fs.readFileSync(path.join(__dirname, '..', 'director_hr_notes.html'), 'utf8');
const project = fs.readFileSync(path.join(__dirname, '..', 'director_project_notes.html'), 'utf8');
const party = fs.readFileSync(path.join(__dirname, '..', 'director_party_notes.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes('記決策'), '記決策按鈕');
assert(html.includes('題目'), '題目欄');
assert(html.includes('定論'), '定論欄');
assert(html.includes('為何'), '為何欄');
assert(html.includes('請填寫題目'), '缺題目提示');
assert(html.includes('請填寫定論'), '缺定論提示');
assert(html.includes('id="form-title-input"'), '題目輸入 id');
assert(html.includes('id="form-heading"'), '表單標題不與輸入撞 id');
assert(html.includes('處理中'), '處理中');
assert(html.includes('已存'), '已存');
assert(html.includes('director_decision_notes'), 'API');
assert(html.includes('localDemo'), 'localDemo');
assert(html.includes('更新中'), '更新中');
assert(hr.includes('總監人事筆記'), '人事保留');
assert(hr.includes('link-decision-notes'), '人事連決策');
assert(project.includes('link-decision'), '專案連決策');
assert(party.includes('link-decision'), '對象連決策');

console.log('OK test-director-decision-notes-html');
