# 2026-10-06｜歷史列表停用「分頁年月」排序 fallback（看起來像交易日）

| 項目 | 內容 |
|------|------|
| Diff／目的 | Boss：正式站仍像依**交易日**排。要的是只依按下送出／寫入時間（`recorded_at`）新→舊。 |
| 根因 | `@379` 已依 `recorded_at` 排，但**無戳記**時 fallback 用分頁名年月＋列號；分頁依交易日存放 → 列表看起來就是交易日序。正式 probe：20 筆裡僅 1 筆有 `recorded_at`，其餘整段 sheet_ym+row 降冪。前端未重排。 |
| 技術 | `SheetWriter.js`：`ledgerHistorySortKeyAg_` 去掉 YM；無戳記用 `_scan_ord`；回傳前剝除。`test-ledger-recent-history.js` 加「無戳記不得靠較新交易日置頂」與「有戳記舊交易日壓過無戳記新交易日」。SPEC `LINE_OA_SPEC` 同步。 |
| 驗證 | `node accounting-gas/tools/test-ledger-recent-history.js` OK；正式 POST `accounting_ledger_recent` 仍回 `sort_basis=recorded_at`（部署後再證無 YM 序）。 |
| 部署 | 待 merge → Actions clasp（目標 @382+） |

