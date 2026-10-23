/**
 * Smoke: ledger_history.html ?v= floors (LIFF-INTEGRATE-1 / #203 subset regression guard)
 * node modules/accounting/tools/test-ledger-history-cache-bust.js
 */
var fs = require('fs');
var path = require('path');

var cacheBust = require('./test-cache-bust-helper');
var html = fs.readFileSync(path.join(__dirname, '..', 'ledger_history.html'), 'utf8');

cacheBust.assertLedgerHistoryCacheBustFloors(html);

console.log('OK test-ledger-history-cache-bust');
