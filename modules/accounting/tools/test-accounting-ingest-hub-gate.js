/**
 * Backend #278: hub 收支登錄須帶 parent LIFF + gate ticket（經 AccountingApi.post）
 * node modules/accounting/tools/test-accounting-ingest-hub-gate.js
 */
var fs = require('fs');
var path = require('path');
var assert = require('assert');

var html = fs.readFileSync(
  path.join(__dirname, '../accounting_ingest.html'),
  'utf8'
);

assert(/async function attachIngestAuth/.test(html), 'attachIngestAuth must be async for hub token');
assert(/refreshHubIngestLiffToken/.test(html), 'must fetch parent LIFF via refreshHubIngestLiffToken');
assert(/requestParentHubLiffToken/.test(html), 'must call AccountingApi.requestParentHubLiffToken');
assert(/fromHub[\s\S]{0,600}body\.liff_id_token = hubTok/.test(html),
  'hub branch must set body.liff_id_token (old code only sent user_id)');
assert(/accounting_pending_photos[\s\S]{0,400}body\.source = 'hub'/.test(html),
  'pending_photos must set source hub');
assert(/accounting_form_flush_deferred[\s\S]{0,400}body\.source = 'hub'/.test(html),
  'flush_deferred must set source hub');
assert(/accounting_form_flush_deferred[\s\S]{0,500}attachIngestAuth\(body\)/.test(html),
  'flush_deferred must run attachIngestAuth before post');
assert(/await attachIngestAuth\(body\)[\s\S]{0,80}AccountingApi\.post\(body\)/.test(html),
  'form_submit must await attachIngestAuth before post');

var legacyHubOnlyUid = /if \(sessionRef && sessionRef\.fromHub[\s\S]*?body\.auth = \{ user_id: sessionRef\.auth\.user_id \;\s*\n\s*return;/;
assert(!legacyHubOnlyUid.test(html), 'must not early-return hub auth with user_id only');

console.log('test-accounting-ingest-hub-gate: OK');
