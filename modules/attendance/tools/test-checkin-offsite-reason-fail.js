/**
 * P0 checkin: off-site reason API failure must not show「打卡完成」; user can retry.
 * Source cherry-pick: PR #61. Run: node modules/attendance/tools/test-checkin-offsite-reason-fail.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var root = path.join(__dirname, '..', '..', '..');
var html = fs.readFileSync(path.join(root, 'modules/attendance/checkin.html'), 'utf8');

assert(/function isLocalOffSiteReasonFailMock\(\)/.test(html), 'mock helper exists');
assert(/mock=offsitereasonfail/.test(html), 'mock query param documented in code');
assert(/restoreOffSiteReasonReady/.test(html), 'restoreOffSiteReasonReady exists');

var submitBlock = html.slice(html.indexOf('submitOffSiteReason: async'));
submitBlock = submitBlock.slice(0, submitBlock.indexOf('skipOffSiteReason:'));

assert(/restoreOffSiteReasonReady\(failHuman\)/.test(submitBlock), 'failure path restores UI for retry');
assert(/completeOffSiteFlow\(\{ reasonNote/.test(submitBlock), 'success/offline paths call completeOffSiteFlow explicitly');
assert(!/}\s*catch[\s\S]*completeOffSiteFlow\(\);\s*}/.test(submitBlock), 'no bare completeOffSiteFlow after try/catch');

var afterFailLog = submitBlock.slice(submitBlock.indexOf("AppActionLog.log('離場說明失敗')"));
assert(
  afterFailLog.indexOf('restoreOffSiteReasonReady') < afterFailLog.indexOf('completeOffSiteFlow') ||
    !/completeOffSiteFlow/.test(afterFailLog.split('restoreOffSiteReasonReady')[0]),
  'after API failure log, restore runs without unconditional completeOffSiteFlow'
);

assert(/params\.action === 'update_off_site_reason'/.test(html), 'mock intercepts off-site reason action');

console.log('test-checkin-offsite-reason-fail.js: OK');
