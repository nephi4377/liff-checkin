/**
 * 算薪公司立場：前端守門（假資料／靜態字串契約）
 * 執行：node --test tools/test-payroll-audit-guards.mjs
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const reviewHtml = fs.readFileSync(
  path.join(root, 'modules', 'accounting', 'payroll_review.html'),
  'utf8'
);
const financeHtml = fs.readFileSync(
  path.join(root, 'modules', 'accounting', 'payroll_finance.html'),
  'utf8'
);
const editorHtml = fs.readFileSync(
  path.join(root, 'modules', 'attendance', 'employee_editor.html'),
  'utf8'
);
const panelJs = fs.readFileSync(
  path.join(root, 'modules', 'attendance', 'payroll_review_panel.js'),
  'utf8'
);

describe('審核減項：法定扣項不可編輯', () => {
  it('isEditableDeductionLabel 鎖定所得稅／勞健保／補充保費', () => {
    assert.match(reviewHtml, /function isEditableDeductionLabel/);
    assert.match(reviewHtml, /所得稅/);
    assert.match(reviewHtml, /補充保費/);
    assert.match(reviewHtml, /勞健保/);
    // 白名單僅假勤類
    assert.match(reviewHtml, /事假/);
    assert.match(reviewHtml, /缺勤/);
  });
});

describe('待匯款：超過核准實發阻擋', () => {
  it('有 assertPaymentNotOverApproved 與超額警告', () => {
    assert.match(financeHtml, /assertPaymentNotOverApproved/);
    assert.match(financeHtml, /總實發超過核准實發/);
    assert.match(financeHtml, /overpay-warn-/);
    assert.match(financeHtml, /data-approved/);
  });
});

describe('離職提示：結算失敗必警告', () => {
  it('leaveSettlement.ok === false 有人工處理提示', () => {
    assert.match(editorHtml, /特休結算草稿未產生，請人工處理/);
    assert.match(editorHtml, /usedDaysUnknown/);
  });
});

describe('試算面板：日薪不雙扣＋中途津貼比例', () => {
  it('有 prorateFixedPayrollAmount；日薪事假已自計薪天數排除', () => {
    assert.match(panelJs, /function prorateFixedPayrollAmount/);
    assert.match(panelJs, /已自計薪天數排除/);
    assert.match(panelJs, /按在職/);
  });
});

describe('P1 C1／C2／C4 前端守門', () => {
  it('C1：年中 ytd=0 警告＋自動累加文案', () => {
    assert.match(editorHtml, /ytd-bonus-midyear-warn/);
    assert.match(editorHtml, /shouldWarnMidYearYtdZero/);
    assert.match(editorHtml, /系統會自動累加/);
    assert.match(reviewHtml, /本年已發獎金累計.*為 0/);
  });

  it('C2：投保建議含交通／其他津貼', () => {
    assert.match(editorHtml, /regularWageForInsuredSuggest/);
    assert.match(editorHtml, /本薪＋交通＋其他經常性津貼/);
  });

  it('C4：年終折現有離職草稿擋雙付提示', () => {
    const lysp = fs.readFileSync(
      path.join(root, 'modules', 'attendance', 'leave_year_stats_panel.js'),
      'utf8'
    );
    assert.match(lysp, /resignSettlementBlocksCashout/);
    assert.match(lysp, /防雙付/);
  });
});
