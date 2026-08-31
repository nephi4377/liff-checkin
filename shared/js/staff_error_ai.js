/**
 * 員工畫面錯誤送到 AI 信箱（可叫雲端 Cursor）。
 * 網頁無法寫進使用者電腦裡正在開的 Cursor 對話。
 */
var STAFF_ERROR_AI_URL_ =
  'https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec';

function inferStaffErrorAiRepo_(text) {
  var t = String(text || '');
  if (/DriveApp|SpreadsheetApp|googleapis\.com\/auth|Apps Script|clasp|試算表|雲端硬碟/i.test(t)) {
    return 'backend';
  }
  return 'frontend';
}

function sendStaffErrorToAi(opts) {
  opts = opts || {};
  var uid = String(opts.userId || opts.user_id || '').trim();
  if (!uid) {
    return Promise.resolve({ success: false, message: '尚未登入' });
  }
  var title = String(opts.title || opts.message || '畫面錯誤').replace(/\s+/g, ' ').trim().slice(0, 80);
  var summary = String(opts.summary || opts.message || title).slice(0, 1500);
  var url = STAFF_ERROR_AI_URL_;
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG.GAS_WEB_APP_URL) url = CONFIG.GAS_WEB_APP_URL;
  } catch (eCfg) {}
  var body = {
    action: 'agent_inbox_staff_error',
    userId: uid,
    title: title || '畫面錯誤',
    summary: summary,
    page: opts.page || '',
    failedAction: opts.action || '',
    link: opts.link || (typeof location !== 'undefined' ? String(location.href || '') : ''),
    repo: opts.repo || inferStaffErrorAiRepo_(title + ' ' + summary)
  };
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.text().then(function (text) {
      try { return JSON.parse(text); } catch (eJ) { return { success: false, message: '信箱回應不是 JSON' }; }
    });
  }).catch(function () {
    return { success: false, message: '沒送到 AI' };
  });
}

function bindStaffErrorAiButton(btn, getCtx) {
  if (!btn) return;
  btn.addEventListener('click', function () {
    var orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = '送出中…';
    var ctx = typeof getCtx === 'function' ? (getCtx() || {}) : (getCtx || {});
    sendStaffErrorToAi(ctx).then(function (res) {
      btn.disabled = false;
      if (res && res.success) {
        var launched = res.cloud && res.cloud.launched;
        btn.textContent = launched ? '雲端已開工' : '已送到 AI';
        setTimeout(function () { btn.textContent = orig; }, 2400);
      } else {
        btn.textContent = orig;
        if (typeof alert === 'function') {
          alert((res && res.message) ? String(res.message) : '沒送到 AI');
        }
      }
    });
  });
}

if (typeof window !== 'undefined') {
  window.StaffErrorAi = {
    send: sendStaffErrorToAi,
    bindButton: bindStaffErrorAiButton
  };
}

export { sendStaffErrorToAi, bindStaffErrorAiButton };
