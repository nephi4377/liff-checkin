/**
 * 煙測：請款冷開應吃 authBypass，勿在 LIFF 空 token 後卡住
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

assert(api.indexOf('policy && policy.authBypass') >= 0 || api.indexOf('policy.authBypass') >= 0,
  'initLiff / policy authBypass branch');
assert(api.indexOf("devBypassAuthBody_('accounting_auth_me')") >= 0,
  'initLiff uses accounting_auth_me bypass');
assert(api.indexOf("devBypassAuthBody_('payment_request_auth_me')") >= 0,
  'payment request session uses payment_request_auth_me bypass');
assert(api.indexOf('buildDevBypassSession_(authBypassPr') >= 0
  || api.indexOf('buildDevBypassSession_(authBypass') >= 0,
  'builds dev bypass session');

assert(html.indexOf('accounting_api.js?v=107') >= 0, 'payment_request cache bust v=107');
assert(indexHtml.indexOf('accounting_api.js?v=107') >= 0, 'index cache bust v=107');
assert(html.indexOf('先進門再補員工名單') >= 0, 'showApp before waitForHubData');

console.log('test-payment-request-auth-bypass: OK');
