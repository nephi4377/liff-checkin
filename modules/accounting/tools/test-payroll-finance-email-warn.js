/**
 * 薪資待匯款：EMAIL 需手動寄送應為 setWarn，不可 setMsg（會誤觸錯誤回報／AI 信箱）
 */
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'payroll_finance.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let failed = false;
if (/setMsg\(\s*['"]部分 EMAIL 需手動寄送/.test(html)) {
  console.error('FAIL: 仍用 setMsg 顯示「部分 EMAIL 需手動寄送」');
  failed = true;
}
if (!/setWarn\(\s*['"]部分 EMAIL 需手動寄送/.test(html)) {
  console.error('FAIL: 找不到 setWarn「部分 EMAIL 需手動寄送」');
  failed = true;
}
if (/setMsg\([^)]*data\.warnings/.test(html)) {
  console.error('FAIL: warnings 仍用 setMsg');
  failed = true;
}

if (failed) process.exit(1);
console.log('OK: payroll_finance EMAIL 手動寄送提示使用 setWarn');
