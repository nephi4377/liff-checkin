import { humanReceiptConfirmFail, RECEIPT_CONFIRM_FAIL_FALLBACK } from './recConfirmFail.mjs';
import assert from 'node:assert/strict';

assert.equal(
  humanReceiptConfirmFail(new Error('Failed to fetch')),
  RECEIPT_CONFIRM_FAIL_FALLBACK
);
assert.equal(
  humanReceiptConfirmFail('連線逾時，請再試一次'),
  RECEIPT_CONFIRM_FAIL_FALLBACK
);
assert.match(humanReceiptConfirmFail('找不到收款'), /重新整理/);
assert.match(humanReceiptConfirmFail('無權存取此案'), /不屬於您目前的案件/);
assert.match(humanReceiptConfirmFail('目前狀態無法第一階段確認'), /可能已經確認過/);
assert.match(humanReceiptConfirmFail('請先完成第一階段確認'), /確認此收款紀錄/);
assert.match(humanReceiptConfirmFail('驗證失敗'), /重新登入 LINE/);
assert.match(humanReceiptConfirmFail('員工預覽為唯讀，無法代客戶確認收款'), /不能代客人確認/);
assert.equal(humanReceiptConfirmFail(''), RECEIPT_CONFIRM_FAIL_FALLBACK);

console.log('recConfirmFail.test.mjs ok');
