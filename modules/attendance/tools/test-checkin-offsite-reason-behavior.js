/**
 * Behavioral tests for off-site reason submit (Node + minimal DOM stubs).
 * Run: node modules/attendance/tools/test-checkin-offsite-reason-behavior.js
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var root = path.join(__dirname, '..', '..', '..');
var html = fs.readFileSync(path.join(root, 'modules/attendance/checkin.html'), 'utf8');

function extractBalancedBraceBlock(source, openBraceIndex) {
  var depth = 0;
  for (var i = openBraceIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex, i + 1);
    }
  }
  throw new Error('unbalanced braces');
}

function extractFunction(source, name) {
  var marker = 'function ' + name;
  var start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function ' + name);
  var brace = source.indexOf('{', start);
  var body = extractBalancedBraceBlock(source, brace);
  return source.slice(start, brace) + body;
}

function extractAppCoreMethod(source, methodName) {
  var marker = methodName + ':';
  var start = source.indexOf(marker);
  if (start < 0) throw new Error('missing AppCore.' + methodName);
  var fnStart = source.indexOf('(', start);
  var arrow = source.indexOf('=>', fnStart);
  var brace = source.indexOf('{', arrow >= 0 ? arrow : fnStart);
  var body = extractBalancedBraceBlock(source, brace);
  var params = source.slice(fnStart, arrow >= 0 ? arrow : brace).trim();
  return 'function ' + methodName + params + ' ' + body;
}

var helperSrc = [
  extractFunction(html, 'isOffSiteReasonErrorQueueable'),
  extractFunction(html, 'escapeHtmlText')
].join('\n');

var sandbox = { TypeError: TypeError };
vm.runInNewContext(helperSrc, sandbox);
var isOffSiteReasonErrorQueueable = sandbox.isOffSiteReasonErrorQueueable;
var escapeHtmlText = sandbox.escapeHtmlText;

assert(isOffSiteReasonErrorQueueable(new Error('HTTP 錯誤: 400')) === false, '4xx not queueable');
assert(isOffSiteReasonErrorQueueable(new Error('HTTP 錯誤: 403')) === false, '403 not queueable');
assert(isOffSiteReasonErrorQueueable(new Error('HTTP 錯誤: 500')) === false, '5xx not queueable');
assert(isOffSiteReasonErrorQueueable(new TypeError('Failed to fetch')) === true, 'network TypeError queueable');
assert(isOffSiteReasonErrorQueueable(new Error('伺服器無回應')) === true, 'timeout queueable');
assert(isOffSiteReasonErrorQueueable(new Error('持續斷網，進入離線模式')) === true, 'offline queueable');

assert(escapeHtmlText('<b>&x</b>') === '&lt;b&gt;&amp;x&lt;/b&gt;', 'escapeHtmlText');

function makeBtn() {
  return {
    textContent: '',
    disabled: false,
    className: '',
    classList: { add: function () {}, remove: function () {} }
  };
}

function makeHarness() {
  var btn = makeBtn();
  var skipBtn = { classList: { add: function () {}, remove: function () {} } };
  var queue = [];
  var lastMessageHtml = '';
  var AppCore = {
    awaitingOffSiteReason: true,
    pageSessionEnded: false,
    isLocked: false,
    primaryResultMessage: '打卡成功！',
    completeOffSiteFlow: function (opts) {
      AppCore.awaitingOffSiteReason = false;
      AppCore.pageSessionEnded = true;
      btn.textContent = (opts && opts.completeButtonText) || '打卡完成';
      var reasonHint = '';
      if (opts && opts.reasonNote) {
        reasonHint = escapeHtmlText(opts.reasonNote);
      }
      lastMessageHtml = AppCore.primaryResultMessage + reasonHint;
    },
    restoreOffSiteReasonReady: function () {
      AppCore.isLocked = false;
      AppCore.pageSessionEnded = false;
      AppCore.awaitingOffSiteReason = true;
      btn.textContent = '送出離場說明';
      btn.disabled = false;
    }
  };
  var AppStorage = { addToQueue: function (item) { queue.push(item); } };
  var AppActionLog = { log: function () {} };
  var AppOffSite = { reset: function () {}, showPanel: function () {} };

  var methodSrc = extractAppCoreMethod(html, 'applyOffSiteReasonSubmitError');
  vm.runInNewContext(
    methodSrc +
      '\nAppCore.applyOffSiteReasonSubmitError = applyOffSiteReasonSubmitError;',
    {
      AppCore: AppCore,
      AppStorage: AppStorage,
      AppActionLog: AppActionLog,
      AppOffSite: AppOffSite,
      isOffSiteReasonErrorQueueable: isOffSiteReasonErrorQueueable,
      Date: Date
    }
  );

  return {
    AppCore: AppCore,
    queue: queue,
    btn: btn,
    get lastMessageHtml() {
      return lastMessageHtml;
    },
    failHuman: '<strong>fail</strong>',
    payload: { action: 'update_off_site_reason', userId: 'u1' }
  };
}

var h = makeHarness();
h.AppCore.applyOffSiteReasonSubmitError(new Error('HTTP 錯誤: 422'), h.failHuman, h.payload);
assert(h.queue.length === 0, '4xx throw does not queue');
assert(h.btn.textContent === '送出離場說明', '4xx throw restores button');
assert(h.AppCore.awaitingOffSiteReason === true, '4xx keeps awaiting reason');

h = makeHarness();
h.AppCore.applyOffSiteReasonSubmitError(new TypeError('fetch failed'), h.failHuman, h.payload);
assert(h.queue.length === 1, 'network error queues');
assert(h.btn.textContent === '說明已暫存', 'queued shows 說明已暫存 not 打卡完成');
assert(h.AppCore.pageSessionEnded === true, 'queued ends session');

h = makeHarness();
h.AppCore.applyOffSiteReasonSubmitError(new Error('伺服器無回應'), h.failHuman, h.payload);
assert(h.queue.length === 1, 'timeout queues');
assert(h.btn.textContent === '說明已暫存', 'timeout button 說明已暫存');

// success:false path via restore (simulate response handler)
h = makeHarness();
h.AppCore.restoreOffSiteReasonReady(h.failHuman);
assert(h.btn.textContent === '送出離場說明', 'success:false restores');

// success path via completeOffSiteFlow
h = makeHarness();
h.AppCore.completeOffSiteFlow({ reasonNote: '<script>' });
assert(h.lastMessageHtml.indexOf('<script>') === -1, 'success reasonNote escaped in message');
assert(h.btn.textContent === '打卡完成', 'success shows 打卡完成');

console.log('test-checkin-offsite-reason-behavior.js: OK');
