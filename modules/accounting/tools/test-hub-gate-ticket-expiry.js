/**
 * Backend #276: expires_in_sec=120 must cache ~100s, not 5min fallback.
 * node modules/accounting/tools/test-hub-gate-ticket-expiry.js
 */
var assert = require('assert');
var expiry = require('./lib/hub-gate-ticket-expiry.js');
var fs = require('fs');
var path = require('path');

var t0 = 1_700_000_000_000;
var legacyFallbackMs = 5 * 60 * 1000;
var res120 = { expires_in_sec: 120 };
var at = expiry.parseGateTicketExpiresMs(res120, t0);

assert.strictEqual(at, t0 + 100000, '120s ticket caches min(105s,100s)=100s from now');
assert.notStrictEqual(at, t0 + legacyFallbackMs, 'must not use old 5min fallback for expires_in_sec');
assert(at <= t0 + 120 * 1000 - 10000, 'expire at least 10s before nominal 120s window end');

assert.strictEqual(
  expiry.parseGateTicketExpiresMs(null, t0),
  t0 + expiry.HUB_GATE_TICKET_DEFAULT_TTL_MS
);
assert(expiry.HUB_GATE_TICKET_DEFAULT_TTL_MS <= 90000, 'default TTL <= 90s');

var api = fs.readFileSync(
  path.join(__dirname, '../../../shared/js/accounting_api.js'),
  'utf8'
);
assert(/expires_in_sec/.test(api), 'accounting_api.js handles expires_in_sec');

console.log('test-hub-gate-ticket-expiry: OK');
