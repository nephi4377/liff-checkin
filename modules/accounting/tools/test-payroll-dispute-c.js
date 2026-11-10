/**
 * 規格 C 前端：員工異議顯示／resolve API（假資料契約）
 * 執行：node --test modules/accounting/tools/test-payroll-dispute-c.js
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
const panel = fs.readFileSync(
  path.join(__dirname, '..', '..', 'attendance', 'payroll_review_panel.js'),
  'utf8'
);

describe('規格 C 加減項異議前端契約', () => {
  it('審核頁出勤旁顯示異議＋標為已處理', () => {
    assert.match(html, /att-objections|員工異議/);
    assert.match(html, /data-dispute-resolve/);
    assert.match(html, /金額須人工/);
  });

  it('API 有 payrollDisputeResolve → payroll_dispute_resolve', () => {
    assert.match(api, /payrollDisputeResolve/);
    assert.match(api, /payroll_dispute_resolve/);
  });

  it('員工 LIFF 加減項有「有問題」與截止日', () => {
    assert.match(panel, /payroll-dispute-btn/);
    assert.match(panel, /有問題/);
    assert.match(panel, /dispute_submit/);
    assert.match(panel, /disputeDeadline|異議截止/);
    assert.match(panel, /金額不對/);
  });

  it('異議送出用原生 fetch POST（非 injected GET fetchApi）', () => {
    const idx = panel.indexOf("op: 'dispute_submit'");
    assert.ok(idx > 0);
    const snippet = panel.slice(idx, idx + 700);
    assert.match(snippet, /await fetch\(apiBaseUrl/);
    assert.doesNotMatch(snippet, /await fetchApi\(apiBaseUrl/);
  });

  it('標已處理會保留審核草稿', () => {
    assert.match(html, /captureReviewDrafts_/);
    assert.match(html, /restoreReviewDrafts_/);
    assert.match(html, /var drafts = captureReviewDrafts_\(\);\s*\n\s*await loadList\(true\);\s*\n\s*restoreReviewDrafts_\(drafts\)/);
  });
});
