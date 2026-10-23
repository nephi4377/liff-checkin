/**
 * 煙測：請款身分安全契約（DEVBYPASS-FE-1）
 * - 正式前端不得送出 dev_bypass / authBypass 冷開
 * - 主控台缺 uid 應要求重開，不可匿名測試身分當稽核
 * node modules/accounting/tools/test-payment-request-auth-bypass.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

var cacheBust = require('./test-cache-bust-helper');
var root = path.resolve(__dirname, '../../..');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var indexHtml = fs.readFileSync(path.join(root, 'modules/accounting/index.html'), 'utf8');

assert(api.indexOf('dev_bypass') < 0, 'accounting_api must not reference dev_bypass');
assert(api.indexOf('devBypassAuthBody_') < 0, 'devBypassAuthBody_ removed');
assert(api.indexOf('allowLocalAuthBypassDemo_') < 0, 'local auth bypass helper removed');
assert(api.indexOf('policy.authBypass') < 0, 'authBypass policy path removed');

assert(api.indexOf('HUB_RELOGIN_MSG') >= 0, 'hub missing uid asks relogin');
assert(/isInHubIframe_\(\)[\s\S]{0,200}HUB_RELOGIN_MSG/.test(api)
  || api.indexOf('主控台 iframe 卻沒帶 uid') >= 0,
  'embed without uid does not fall through to test identity');
assert(api.indexOf('POLICY_TIMEOUT_MS') >= 0, 'policy timeout so UI fails fast');
assert(api.indexOf("body.action === 'accounting_policy'") >= 0, 'policy uses short timeout');

cacheBust.assertSameNumericCacheBust(
  [html, indexHtml],
  cacheBust.RE.accountingApi,
  'payment_request and index share accounting_api.js ?v=',
  108
);
assert(html.indexOf('本機測試（勿當正式稽核）') >= 0, 'legacy bypass label string may remain for dead branch');
assert(html.indexOf('先進門再補員工名單') >= 0, 'showApp before waitForHubData');

console.log('test-payment-request-auth-bypass: OK');
