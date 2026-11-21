/**
 * P0 checkin: off-site reason failure / error paths (smoke + behavior).
 * Run:
 *   node modules/attendance/tools/test-checkin-offsite-reason-fail.js
 *   node modules/attendance/tools/test-checkin-offsite-reason-behavior.js
 */
require('./test-checkin-offsite-reason-behavior.js');

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var root = path.join(__dirname, '..', '..', '..');
var html = fs.readFileSync(path.join(root, 'modules/attendance/checkin.html'), 'utf8');

assert(/function isLocalOffSiteReasonFailMock\(\)/.test(html), 'mock helper exists');
assert(/function isOffSiteReasonErrorQueueable/.test(html), 'queueable classifier exists');
assert(/applyOffSiteReasonSubmitError/.test(html), 'applyOffSiteReasonSubmitError exists');
assert(/completeButtonText/.test(html), 'offline queue uses distinct button label');
assert(/escapeHtmlText\(opts\.reasonNote\)/.test(html), 'reasonNote escaped in completeOffSiteFlow');

console.log('test-checkin-offsite-reason-fail.js: OK');
