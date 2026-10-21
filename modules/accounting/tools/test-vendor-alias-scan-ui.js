/**
 * Static checks for vendor alias scan UI (VENDOR-ALIAS-SCAN-1-UI).
 * Contract: Backend_GAS PR #186 (after_vendor_id cursor).
 * Run: node modules/accounting/tools/test-vendor-alias-scan-ui.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var root = path.join(__dirname, '..', '..', '..');
var vendors = fs.readFileSync(path.join(root, 'modules/accounting/vendors.html'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/vendorAliasProfileScan/.test(api), 'accounting_api has vendorAliasProfileScan');
assert(/vendor_alias_profile_scan/.test(api), 'action vendor_alias_profile_scan');
assert(/after_vendor_id/.test(api), 'api sends after_vendor_id');
assert(!/options\.offset/.test(api), 'api must not use offset');
assert(/VENDOR_ALIAS_SCAN_TIMEOUT_MS = 300000/.test(api), '300s timeout');

assert(/掃描暱稱（只看）/.test(vendors), 'scan button');
assert(/確認寫入/.test(vendors), 'write button');
assert(/vendorAliasWriteBtn.*disabled/.test(vendors), 'write button starts disabled');
assert(/aliasScanDryRunForAfterVendorId/.test(vendors), 'dry-run gate for write');
assert(/next_after_vendor_id/.test(vendors), 'uses next_after_vendor_id cursor');
assert(!/aliasScanNextOffset|aliasScanCurrentOffset/.test(vendors), 'no offset state');
assert(/total_candidates/.test(vendors), 'shows total_candidates');
assert(/data\.apply/.test(vendors), 'shows apply block');
assert(/vendorAliasScanMoreBtn/.test(vendors), 'continue batch button');
assert(/VENDOR_ALIAS_SCAN_LIMIT = 25/.test(vendors), 'batch limit 25');

var scanFn = vendors.slice(vendors.indexOf('function runVendorAliasScan'));
scanFn = scanFn.slice(0, scanFn.indexOf('function runVendorAliasUidCheck'));
assert(/after_vendor_id/.test(scanFn), 'scan sends after_vendor_id');
assert(!/\boffset\b/.test(scanFn), 'scan must not send offset');
assert(!/payment_uid_check/.test(scanFn), 'scan/write must not send payment_uid_check');

var uidFn = vendors.slice(vendors.indexOf('function runVendorAliasUidCheck'));
uidFn = uidFn.slice(0, uidFn.indexOf('function resetPayHistoryUi'));
assert(/payment_uid_check/.test(uidFn), 'uid check sends payment_uid_check');
assert(!/宋仁凱/.test(uidFn), 'vendor name not hardcoded in logic');
assert(!/7133913065be/.test(uidFn), 'prefix not hardcoded in logic');
assert(/value="宋仁凱"/.test(vendors), 'prefilled vendor name in HTML');
assert(/value="7133913065be"/.test(vendors), 'prefilled prefix in HTML');

console.log('test-vendor-alias-scan-ui.js: OK');
