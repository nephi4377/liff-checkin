/**
 * 規格 A 前端：摘要列／異常 CSS／確認閘文案（假資料）
 * 執行：node --test modules/accounting/tools/test-payroll-attendance-embed-a.js
 */
'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '..', 'payroll_review.html'),
  'utf8'
);
const api = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', 'shared', 'js', 'accounting_api.js'),
  'utf8'
);

describe('規格 A 薪資審核出勤核對前端契約', () => {
  it('頁面含摘要／確認／日曆／異常樣式', () => {
    assert.match(html, /應上/);
    assert.match(html, /data-att-confirm/);
    assert.match(html, /data-toggle-cal/);
    assert.match(html, /is-anomaly/);
    assert.match(html, /att-cal-grid/);
    assert.match(html, /全部確認後才能核准/);
  });

  it('API 有 payrollAttendanceConfirm → payroll_attendance_confirm', () => {
    assert.match(api, /payrollAttendanceConfirm/);
    assert.match(api, /payroll_attendance_confirm/);
  });
});
