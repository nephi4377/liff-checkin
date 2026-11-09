# 2026-11-09 簽約注意事項 ESIGN-NOTICE-1

- 客戶 LIFF 頁：`modules/projects/esign-notice.html`（逐條我了解＋簽名鎖定＋列印）
- 內容版本檔：`modules/projects/data/esign-notice-2025-0922-img1.json`（真圖 24 張；第12條無圖）
- 主控台：`designer-customer-finance.html` 新增「簽約注意」分頁（狀態／複製連結／列印）
- API：`shared/js/accounting_api.js` → project-console `esign_notice_*`
- 測試：`node --test tools/test-esign-notice.mjs`
- 未部署；PR draft；正式開關預設關
