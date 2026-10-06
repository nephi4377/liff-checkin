# 2026-10-06｜歷史列表停用交易日觀感排序＋強刷快取

| 項目 | 內容 |
|------|------|
| Diff／目的 | Boss 仍見交易日序；前端加防禦性只依 `recorded_at` 排，並強刷 LINE WebView JS。 |
| 根因（跨倉） | 後端無戳記 fallback 用分頁年月（＝交易月）。前端原本不重排，故照後端誤序渲染。正式站 `api?v=81` 無 client sort。 |
| 技術 | `ledger_history.html`：`sortHistoryByRecordedAtOnly`（禁 txn_date）；`api?v=82`／`ui?v=28`／`boot?v=12`；Cache-Control meta。SPEC 15 v1.46。 |
| 驗證 | 正式 HTML 部署後應含 `api?v=82` 與 `sortHistoryByRecordedAtOnly`；列表頂＝最新 `recorded_at`。 |
| 部署 | 待 merge → Pages |

