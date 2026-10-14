/**
 * 煙測：請款身分安全契約
 * - 正式／主控台：真實員工 uid，不可用匿名測試身分當稽核
 * - authBypass 僅本機冷開 demo
 * node modules/accounting/tools/test-payment-request-auth-bypass.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

var root = path.resolve(__dirname, '../../..');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');
var html = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var indexHtml = fs.readFileSync(path.join(root, 'modules/accounting/index.html'), 'utf8');

assert(api.indexOf('allowLocalAuthBypassDemo_') >= 0, 'local-only bypass gate');
assert(api.indexOf('isLocalDevHost_') >= 0, 'localhost host check');
assert(api.indexOf('policy.authBypass && allowLocalAuthBypassDemo_()') >= 0,
  'authBypass gated by local demo helper');
assert(api.indexOf('HUB_RELOGIN_MSG') >= 0, 'hub missing uid asks relogin');
assert(/isInHubIframe_\(\)[\s\S]{0,200}HUB_RELOGIN_MSG/.test(api)
  || api.indexOf('主控台 iframe 卻沒帶 uid') >= 0,
  'embed without uid does not fall through to test identity');
assert(api.indexOf('POLICY_TIMEOUT_MS') >= 0, 'policy timeout so UI fails fast');
assert(api.indexOf("body.action === 'accounting_policy'") >= 0, 'policy uses short timeout');

assert(html.indexOf('accounting_api.js?v=108') >= 0, 'payment_request cache bust v=108');
assert(indexHtml.indexOf('accounting_api.js?v=108') >= 0, 'index cache bust v=108');
assert(html.indexOf('本機測試（勿當正式稽核）') >= 0, 'bypass labeled on UI');
assert(html.indexOf('先進門再補員工名單') >= 0, 'showApp before waitForHubData');

console.log('test-payment-request-auth-bypass: OK');
