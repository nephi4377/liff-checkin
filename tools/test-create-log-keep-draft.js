#!/usr/bin/env node
/**
 * 巡檢驗收：專案工作區新建日誌須等結果才清空表單。
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
  path.join(__dirname, '../modules/projects/js/logActions.js'),
  'utf8'
);
const fn = src.slice(src.indexOf('export function handleCreateNewPost'));
const end = fn.indexOf('\nexport function', 10);
const body = end > 0 ? fn.slice(0, end) : fn;

function must(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

must(body.includes('handleCreateNewPost'), '找不到新建日誌');
must(body.includes('.finally('), '須等結果才恢復按鈕');
must(body.includes('內容還在，可再按發佈'), '失敗人話');
must(body.includes('newCard.remove()'), '失敗須拿掉假卡片');

const thenIdx = body.indexOf('.then(result');
const clearIdx = body.indexOf('textarea.value = \'\'');
must(thenIdx > 0 && clearIdx > thenIdx, '清空輸入必須在成功回呼內，不可一送出就清');
must(body.includes('result.success'), '須判斷後端成功才清空');

const premature =
  /apiRequest\([\s\S]*?\)\s*\.then\([\s\S]*?\)\s*\.catch\([\s\S]*?\);\s*submitBtn\.disabled = false/.test(body);
must(!premature, '不可在請求還沒結束就恢復按鈕並清空');

console.log('OK: 新建日誌失敗保留草稿');
