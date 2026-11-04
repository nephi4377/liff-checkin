/**
 * Backend_GAS #276 client mirror smoke — hub gate ticket on AccountingApi.post
 * node modules/accounting/tools/test-hub-gate-ticket-client.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var apiPath = path.join(__dirname, '../../../shared/js/accounting_api.js');
var api = fs.readFileSync(apiPath, 'utf8');

assert(api.indexOf("action: 'accounting_hub_gate_ticket'") >= 0, 'fetches ticket from project-console');
assert(api.indexOf('hub_gate_ticket') >= 0, 'attaches hub_gate_ticket');
assert(api.indexOf('attachHubGateTicketIfPossible_') >= 0, 'post() enriches body');
assert(api.indexOf('readHubGateTicketCache_') >= 0, 'ticket cache read');
assert(api.indexOf('hub_gate_ticket unavailable') >= 0, 'graceful degrade log');

var empEditor = fs.readFileSync(
  path.join(__dirname, '../../attendance/employee_editor.html'),
  'utf8'
);
assert(empEditor.indexOf('ensureAccountingSession') >= 0, 'employee_editor session init');
assert(empEditor.indexOf('accounting_api.js?v=112') >= 0, 'employee_editor cache bust');

console.log('test-hub-gate-ticket-client: OK');
