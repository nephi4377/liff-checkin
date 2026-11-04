/**
 * Smoke: 請款 AI 辨識 180s 逾時防護（只送勾選／縮圖／人話）
 * node modules/accounting/tools/test-payment-request-ocr-timeout.js
 */
var fs = require('fs');
var path = require('path');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
  console.log('OK:', msg);
}

var root = path.resolve(__dirname, '../../..');
var pay = fs.readFileSync(path.join(root, 'modules/accounting/payment_request.html'), 'utf8');
var api = fs.readFileSync(path.join(root, 'shared/js/accounting_api.js'), 'utf8');

assert(/OCR_TIMEOUT_MS\s*=\s*180000/.test(pay), 'OCR timeout 180s');
assert(/OCR_MAX_IMAGES\s*=\s*4/.test(pay), 'OCR max images 4');
assert(/buildOcrPhotosPayload_/.test(pay), 'OCR payload builder');
assert(/shrinkImageBase64ForOcr_/.test(pay), 'OCR image shrink');
assert(/photosPayload\(\)/.test(pay), 'photosPayload still exists for submit');

var payOcrIdx = pay.indexOf('paymentRequestOcrAnalyze');
assert(payOcrIdx > 0, 'has paymentRequestOcrAnalyze call');
var payOcrWindow = pay.slice(Math.max(0, payOcrIdx - 600), payOcrIdx + 120);
assert(/ocrPhotos/.test(payOcrWindow), 'payment OCR payload uses ocrPhotos');
assert(/buildOcrPhotosPayload_\(selected\)/.test(payOcrWindow), 'builds OCR payload from selected');
assert(!/photos:\s*photosPayload\(\)/.test(payOcrWindow), 'OCR call does not use photosPayload()');

assert(/accounting_api\.js\?v=113/.test(pay), 'api cache bust v=113');
assert(/AI 辨識逾時（約 3 分鐘）/.test(api), 'OCR abort human message');
assert(/timeoutMs === undefined \? 180000/.test(api), 'paymentRequestOcrAnalyze defaults to 180s');

console.log('All payment OCR timeout frontend checks passed.');
