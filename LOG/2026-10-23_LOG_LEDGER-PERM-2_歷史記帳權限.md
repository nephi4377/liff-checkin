# 2026-10-23｜LEDGER-PERM-2 歷史記帳權限（前端）

| 項目 | 說明 |
|------|------|
| 目的 | 列表依 API；≥5 看全部；本人或 5 可改帳／作廢；疑重待審；合計排除作廢 |
| 前端 | `ledger_entry_map.js?v=4`、`ledger_history.html`、`accounting_api.js?v=110`（伺服器 can_*／dup 欄位） |
| 後端 | Backend_GAS PR #218（契約假設寫在 map 檔頭） |
| 驗證 | `node modules/accounting/tools/test-ledger-perm-2.js` 等 |
| 預覽 | raw.githack @ `0951ff536eb734ca23c8b43f3883fa4a92bca136`（見 PR #98；需 LIFF／主控台） |
