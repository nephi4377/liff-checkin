/**
 * 靜態檢查專案備忘頁人機閉環關鍵字（不開瀏覽器）。
 * node modules/attendance/tools/test-director-project-notes-html.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'director_project_notes.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const hrPath = path.join(__dirname, '..', 'director_hr_notes.html');
const hr = fs.readFileSync(hrPath, 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes('選專案'), '選專案');
assert(html.includes('新增備忘'), '新增備忘');
assert(html.includes('處理中'), '處理中回饋');
assert(html.includes('已存'), '成功已存');
assert(html.includes('director_project_notes'), 'API action');
assert(html.includes('localDemo'), 'localDemo');
assert(html.includes('更新中'), '載入更新中');
assert(html.includes('軟刪') || html.includes('刪除'), '可刪');
assert(hr.includes('總監人事筆記'), '人事筆記保留');
assert(hr.includes('link-project-notes'), '人事頁連到專案備忘');

console.log('OK test-director-project-notes-html');
