/**
 * 靜態檢查對話摘記頁人機閉環關鍵字。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'director_transcript_notes.html'), 'utf8');
const followup = fs.readFileSync(path.join(__dirname, '..', 'director_followup_notes.html'), 'utf8');
const hr = fs.readFileSync(path.join(__dirname, '..', 'director_hr_notes.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(html.includes('產生摘要'), '產生摘要按鈕');
assert(html.includes('整理中'), '整理中');
assert(html.includes('請貼上對話或文字'), '缺原文提示');
assert(html.includes('一行摘要'), '摘要欄');
assert(html.includes('展開原文'), '展開原文');
assert(html.includes('存進筆記本'), '存進筆記本');
assert(html.includes('director_transcript_notes'), 'API');
assert(html.includes("op: 'summarize'") || html.includes('op: "summarize"') || html.includes("op: 'summarize'"), 'summarize op');
assert(html.includes('localDemo'), 'localDemo');
assert(html.includes('更新中'), '更新中');
assert(html.includes('showGlobalNotification(message, duration, type'), 'notify 參數順序');
assert(!/showGlobalNotification\([^,]+,\s*'(error|success|info)'\)/.test(html), '通知不可把 type 當第二參');
assert(html.includes('僅私人'), '掛接僅私人');
assert(hr.includes('link-transcript-notes'), '人事連摘記');
assert(followup.includes('link-transcript'), '待跟進連摘記');

console.log('OK test-director-transcript-notes-html');
