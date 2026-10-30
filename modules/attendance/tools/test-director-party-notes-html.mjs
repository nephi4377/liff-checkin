/**
 * 靜態檢查客戶／廠商觀察頁人機閉環關鍵字。
 * node modules/attendance/tools/test-director-party-notes-html.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'director_party_notes.html'), 'utf8');
const hr = fs.readFileSync(path.join(__dirname, '..', 'director_hr_notes.html'), 'utf8');
const project = fs.readFileSync(path.join(__dirname, '..', 'director_project_notes.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes('對象類型'), '對象類型');
assert(html.includes('新增觀察'), '新增觀察');
assert(html.includes('只看雷點'), '雷點篩選');
assert(html.includes('observation'), '預設觀察分類');
assert(html.includes('處理中'), '處理中');
assert(html.includes('已存'), '已存');
assert(html.includes('director_party_notes'), 'API action');
assert(html.includes('localDemo'), 'localDemo');
assert(html.includes('更新中'), '更新中');
assert(hr.includes('總監人事筆記'), '人事保留');
assert(hr.includes('link-party-notes'), '人事連到觀察');
assert(project.includes('專案／工地備忘') || project.includes('專案備忘'), '專案備忘保留');
assert(project.includes('link-party'), '專案頁連到觀察');

console.log('OK test-director-party-notes-html');
