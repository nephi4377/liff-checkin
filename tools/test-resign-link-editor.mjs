/**
 * 員工編輯頁：離職連動成功提示（不顯示薪資金額）
 * 執行：node --test tools/test-resign-link-editor.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(
  path.join(__dirname, '..', 'modules', 'attendance', 'employee_editor.html'),
  'utf8'
);

describe('employee_editor 離職連動提示', () => {
  it('存檔成功路徑有讀 resignLink', () => {
    assert.match(html, /response\.resignLink/);
    assert.match(html, /leaveSettlement/);
    assert.match(html, /特休結算草稿/);
  });

  it('提示文案不直接輸出 cashout／底薪金額欄位', () => {
    // 成功提示區塊不應把折現金額秀在 UI
    const idx = html.indexOf('response.resignLink');
    assert.ok(idx > 0);
    const slice = html.slice(idx, idx + 900);
    assert.doesNotMatch(slice, /cashoutAmount/);
    assert.doesNotMatch(slice, /dailyWage/);
    assert.doesNotMatch(slice, /baseSalary/);
  });
});
