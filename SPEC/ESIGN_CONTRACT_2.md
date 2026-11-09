# 線上合約（ESIGN-CONTRACT-2）

- 客戶頁：`modules/projects/esign-contract.html`（摘要＋付款表＋審閱＋雙簽名＋列印／紙本）
- 範本：`modules/projects/data/esign-contract-2025-0922.json`（version `2025-0922`）
- 主控台：`designer-customer-finance.html` 分頁「線上合約」（狀態、複製連結、編輯付款表、標記寄出）
- 本機：`?dev=1` 僅 `127.0.0.1`／`localhost`；內部簽乙方加 `?staff=1`
- 測試：`node --test tools/test-esign-contract.mjs`
