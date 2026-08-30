/**
 * 廠商待匯款：失敗不可顯示成「目前沒有待匯款項目」
 * 執行：node tools/test-vendor-payment-finance-list.js
 */
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(
  path.join(__dirname, '../modules/accounting/vendor_payment_finance.html'),
  'utf8'
);

function decide(input) {
  var success = !!input.success;
  var itemCount = input.itemCount || 0;
  var hadPrior = !!input.hadPriorItems;
  if (!success) {
    return {
      kind: 'fail',
      showEmptyHint: false,
      showRetry: true,
      keepItems: hadPrior,
      emptyText: ''
    };
  }
  if (!itemCount) {
    return {
      kind: 'empty',
      showEmptyHint: true,
      showRetry: false,
      keepItems: false,
      emptyText: '目前沒有待匯款項目'
    };
  }
  return {
    kind: 'ok',
    showEmptyHint: false,
    showRetry: false,
    keepItems: false,
    emptyText: ''
  };
}

var fail = 0;
function assert(name, ok) {
  console.log(ok ? 'OK' : 'FAIL', name);
  if (!ok) fail = 1;
}

assert('source has fetchPendingPaymentRetry', html.indexOf('fetchPendingPaymentRetry') >= 0);
assert('source has renderListFail', html.indexOf('function renderListFail') >= 0);
assert('source hides emptyHint on fail', /emptyHint\.classList\.add\('hidden'\)/.test(html));
assert('source retry button 再試一次', html.indexOf('再試一次') >= 0);
assert('source peek cache first', html.indexOf('AccountingListCache.peek') >= 0);
assert('source loading skeleton', html.indexOf('載入中…') >= 0);
assert('source keep prior 仍顯示先前內容', html.indexOf('仍顯示先前內容') >= 0);

var firstFail = decide({ success: false, itemCount: 0, hadPriorItems: false });
assert('first fail is not empty', firstFail.kind === 'fail' && !firstFail.showEmptyHint && firstFail.showRetry);
assert('first fail does not say 目前沒有', firstFail.emptyText.indexOf('目前沒有待匯款項目') < 0);

var keepFail = decide({ success: false, itemCount: 0, hadPriorItems: true });
assert('fail with prior keeps items', keepFail.keepItems && !keepFail.showEmptyHint);

var trueEmpty = decide({ success: true, itemCount: 0, hadPriorItems: false });
assert('true empty shows hint', trueEmpty.kind === 'empty' && trueEmpty.showEmptyHint && trueEmpty.emptyText === '目前沒有待匯款項目');

var okList = decide({ success: true, itemCount: 3, hadPriorItems: false });
assert('success list hides empty', okList.kind === 'ok' && !okList.showEmptyHint && !okList.showRetry);

process.exit(fail);
