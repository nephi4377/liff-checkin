/**
 * Smoke: 薪資待匯款／補登 — 僅手動寄送才顯示 EMAIL 草稿
 * 執行：node modules/accounting/tools/test-payroll-email-manual-drafts.js
 */
var assert = require('assert');
var fs = require('fs');
var path = require('path');

function collectManualEmailDrafts(emailResults) {
  var drafts = [];
  var reasons = [];
  (emailResults || []).forEach(function (r) {
    if (!r) return;
    var en = r.email_notify || {};
    var needManual = en.manual_required === true ||
      en.success === false ||
      (!!r.error && en.success !== true);
    if (!needManual) return;
    var draft = r.draft || en.draft;
    if (!draft || !draft.body) return;
    drafts.push(draft);
    var why = en.message || r.error;
    if (why) {
      reasons.push((r.employee_name || draft.to || 'EMAIL') + '：' + why);
    }
  });
  return { drafts: drafts, reasons: reasons };
}

var okDraft = { subject: 'ok', to: 'a@x.com', body: 'hi' };
var failDraft = { subject: 'fail', to: 'b@x.com', body: 'bye' };

var mixed = collectManualEmailDrafts([
  { employee_name: '成功', email_notify: { success: true }, draft: okDraft },
  {
    employee_name: '失敗',
    email_notify: { success: false, manual_required: true, message: 'quota', draft: failDraft },
    draft: failDraft
  }
]);
assert.strictEqual(mixed.drafts.length, 1, '成功帶 draft 不可進手動區');
assert.strictEqual(mixed.drafts[0].to, 'b@x.com');
assert.ok(mixed.reasons[0].indexOf('quota') >= 0, '應帶失敗原因');

var legacySuccess = collectManualEmailDrafts([
  { email_notify: { success: true, draft: okDraft }, draft: okDraft }
]);
assert.strictEqual(legacySuccess.drafts.length, 0, '舊後端成功仍帶 draft → 前端略過');

var noEmail = collectManualEmailDrafts([
  {
    employee_name: '無信箱',
    email_notify: { success: false, manual_required: true, message: '員工未填 email', draft: failDraft },
    draft: failDraft
  }
]);
assert.strictEqual(noEmail.drafts.length, 1, '未填 email 需手動');

var html = fs.readFileSync(path.join(__dirname, '..', 'payroll_finance.html'), 'utf8');
assert(html.indexOf('collectManualEmailDrafts') >= 0, '待匯款頁使用 collectManualEmailDrafts');
assert(html.indexOf('ui.setWarn(warnText)') >= 0, '手動寄送用 warn 而非 err（避免送到 AI）');
assert(html.indexOf("setMsg('部分 EMAIL 需手動寄送") < 0, '不再用 setMsg 當手動寄送提示');

var backfill = fs.readFileSync(path.join(__dirname, '..', 'payroll_backfill.html'), 'utf8');
assert(backfill.indexOf('en.manual_required || en.success === false') >= 0, '補登頁僅失敗才顯示草稿');

console.log('ok: payroll-email-manual-drafts');
