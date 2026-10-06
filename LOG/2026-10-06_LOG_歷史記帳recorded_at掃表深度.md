# 2026-10-06｜Codex P1：歷史查詢停傳誤導 months

| 項目 | 內容 |
|------|------|
| 需求 | 記帳時間窗不可用日曆跨月 `months` 限後端掃交易月分頁 |
| 作法 | `ledger_history.html` `readHistoryFilters` 不再算／傳 `months`；`accounting_api.js` 僅在呼叫端明示時才帶；`?v=79` |
| 驗證 | 字串檢查無 `months: 1` 日曆推導；配合 Backend sheet_months=12 |
| 關聯 | Backend_GAS 同主題 PR |

**部署**：待 merge → GitHub Pages
