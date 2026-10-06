# 2026-10-06｜待付款請款驗證身分 20s 逾時 hotfix

## Diff／目的

老闆（Yang）從主控台進會計選單 → `#/payment_request.html`：動作「驗證身分」卡滿 **20.0 秒** 後錯誤回報。

## 根因

1. 選單（`index.html`）背景 `accounting_auth_me` 逾時仍走 `toastErrorReport` → 頁面顯示「會計功能選單／驗證身分／20.0 秒」
2. 正式站 `payment_request.html` 仍鎖 `accounting_api.js?v=63`（未吃到 @369 暫用身分），且未用 `AccountingBoot` → iframe 冷路徑可乾等 auth_me 20s
3. 後端 `payment_request_auth_me` LIFF 路徑仍每次清員工快取；稽核失敗可擋回傳

## 技術

- 前端：`payment_request` 改 `AccountingBoot`＋cache-bust `v=79`／`ui v=26`／`boot v=11`；hub 暫用身分立即進門；背景 `forceAuth`；auth_me 逾時改軟性 log、不噴錯誤回報
- 後端：`resolvePaymentRequestAuth_` 不再每次 invalidate；`handlePaymentRequestAuthMe_` 稽核 try/catch
- SPEC：19、PAYMENT_REQUEST_UNIFIED

## 驗證

- `node modules/accounting/tools/test-hub-auth-provisional.js`
- 正式站 `payment_request.html` 含 `accounting_api.js?v=79`、`accounting_boot.js`
- 老闆：主控台重開會計 → 待付款請款應秒開（勿乾等 20s）
