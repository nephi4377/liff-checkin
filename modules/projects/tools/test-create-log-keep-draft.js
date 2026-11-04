/**
 * 靜態檢查：專案工作區新建日誌失敗時須保留草稿（來源：巡檢 PR #68）。
 * 執行：node modules/projects/tools/test-create-log-keep-draft.js
 */
const fs = require('fs');
const path = require('path');

function must(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const src = fs.readFileSync(
  path.join(__dirname, '../js/logActions.js'),
  'utf8',
);
const fnStart = src.indexOf('export function handleCreateNewPost');
must(fnStart >= 0, '找不到 handleCreateNewPost');
const body = src.slice(fnStart, src.indexOf('\n}', fnStart) + 2);

must(body.includes('result.success'), '須判斷後端成功才清空');
must(body.includes('.finally('), '按鈕恢復應在 finally');

const premature =
  /apiRequest\([\s\S]*?\)\s*\.then\([\s\S]*?\)\s*\.catch\([\s\S]*?\);\s*submitBtn\.disabled = false/.test(
    body,
  );
must(!premature, '不可在請求還沒結束就恢復按鈕並清空');

const clearOutsideSuccess =
  /\.catch\([\s\S]*?\)\s*[\s\S]*?textarea\.value = ''/.test(body) &&
  !/if \(result\.success\)[\s\S]*textarea\.value = ''/.test(body);
must(!clearOutsideSuccess, '不可在失敗路徑外無條件清空 textarea');

must(
  body.includes('newCard.remove()'),
  '失敗時應移除樂觀更新假卡片',
);

console.log('OK: 新建日誌失敗保留草稿（#68 行為）');
