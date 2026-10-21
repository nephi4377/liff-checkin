/**
 * Static checks for vendor alias scan UI (VENDOR-ALIAS-SCAN-1-UI).
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
assert(/VENDOR_ALIAS_SCAN_TIMEOUT_MS = 300000/.test(api), '300s timeout');
assert(/payment_uid_check/.test(api), 'api supports payment_uid_check option');

assert(/掃描暱稱（只看）/.test(vendors), 'scan button label');
assert(/確認寫入/.test(vendors), 'write button label');
assert(/檢查仁凱 UID（只看）/.test(vendors), 'uid check button');
assert(/vendorAliasScanMoreBtn/.test(vendors), 'continue batch button');
assert(/VENDOR_ALIAS_SCAN_LIMIT = 25/.test(vendors), 'batch limit 25');
assert(/VENDOR_ALIAS_ADMIN_MIN = 5/.test(vendors), 'perm 5 gate');

var scanFn = vendors.slice(vendors.indexOf('function runVendorAliasScan'));
scanFn = scanFn.slice(0, scanFn.indexOf('function runVendorAliasUidCheck'));
assert(!/payment_uid_check/.test(scanFn), 'scan/write must not send payment_uid_check');

var uidFn = vendors.slice(vendors.indexOf('function runVendorAliasUidCheck'));
uidFn = uidFn.slice(0, uidFn.indexOf('function resetPayHistoryUi'));
assert(/payment_uid_check/.test(uidFn), 'uid check sends payment_uid_check');
assert(/limit: 1/.test(uidFn), 'uid check limit 1');
assert(/vendorAliasUidCheckName/.test(vendors), 'vendor name input');
assert(/vendorAliasUidCheckPrefix/.test(vendors), 'prefix input');
assert(/value="宋仁凱"/.test(vendors), 'prefilled vendor name in HTML');
assert(/value="7133913065be"/.test(vendors), 'prefilled prefix in HTML');
assert(!/宋仁凱/.test(uidFn), 'vendor name not hardcoded in uid check logic');
assert(!/7133913065be/.test(uidFn), 'prefix not hardcoded in uid check logic');

console.log('test-vendor-alias-scan-ui.js: OK');
