/**
 * 驗證 vendor_payment_mark_paid 網路錯誤會轉成人話（不應再出現 Load failed）
 */
function mapVendorPayWriteErr(raw, actionName) {
  var err = new Error(raw);
  var isVendorPayWrite = actionName === 'vendor_payment_approve' || actionName === 'vendor_payment_mark_paid';
  if (/abort/i.test(raw)) {
    if (isVendorPayWrite) {
      err = new Error('等太久了。請重新整理列表，確認是否已完成，先不要再按一次。');
    } else {
      err = new Error('連線逾時，請再試一次');
    }
  } else if (isVendorPayWrite && /Failed to fetch|NetworkError|Load failed|Network request failed/i.test(raw)) {
    err = new Error('連線中斷。後端可能已處理完，請重新整理列表確認，先不要再按一次。');
  }
  return err.message;
}

function humanMarkPaidErr(msg) {
  if (/等太久|重新整理列表|連線中斷|可能已處理完/.test(msg)) return msg;
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) {
    return '連線中斷。後端可能已處理完，請重新整理列表確認，先不要再按一次。';
  }
  return msg;
}

var cases = [
  ['Load failed', 'vendor_payment_mark_paid'],
  ['Failed to fetch', 'vendor_payment_mark_paid'],
  ['AbortError', 'vendor_payment_mark_paid'],
  ['Load failed', 'crud_list']
];

var failed = 0;
cases.forEach(function (pair) {
  var raw = pair[0];
  var action = pair[1];
  var mapped = mapVendorPayWriteErr(raw, action);
  var finalMsg = humanMarkPaidErr(mapped);
  if (/Load failed/i.test(finalMsg)) {
    console.error('FAIL', raw, action, '=>', finalMsg);
    failed += 1;
    return;
  }
  console.log('OK', raw, action, '=>', finalMsg);
});

if (failed) {
  process.exit(1);
}
console.log('all passed');
