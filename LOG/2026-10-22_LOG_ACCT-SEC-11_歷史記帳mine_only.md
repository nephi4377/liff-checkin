# 2026-10-22｜ACCT-SEC-11 歷史記帳 mine_only 與權限 4 閘門

| 項目 | 說明 |
|------|------|
| 目的 | `accounting_ledger_recent`：權限低於 4 一律只查本人；≥4 可選全部。前端標籤與「記帳範圍」與 API／session.auth 一致，避免 HUB 較高但 auth 未刷新時誤顯示「全部」。 |
| 前端 | `shared/js/accounting_api.js`（`authPerm < MIN_PERMISSION` 強制 `mine_only`）；`ledger_history.html`（記帳範圍、`data.mine_only` 狀態列、HUB 超前提示）；`submit_records.html`（狀態列依 `data.mine_only`；`api?v=107`） |
| 後端 | Backend_GAS PR #218（配對） |
| SPEC | `SPEC/15_會計系統模組規格書.md` v1.73；`ledger_history` 表列 ≥3 進頁、≥4 查全部人 |
| 驗證 | `node modules/accounting/tools/test-ledger-history-search-readonly.js`；`node modules/accounting/tools/test-ledger-history-mixed-sources.js`；`node modules/accounting/tools/test-submit-records-page.js` |
| 部署 | 待 merge PR #98（前端）；後端 #218 另併 |
