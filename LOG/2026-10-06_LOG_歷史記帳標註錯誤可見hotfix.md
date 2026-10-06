# 2026-10-06｜歷史記帳「標註錯誤」可見／可按 hotfix

| Diff／目的 | Boss／Yang（permission=3）正式站歷史記帳「沒有可以按的阿」——看不到／按不到「標註錯誤」 |
| --- | --- |
| 根因 | 混排後預設「全部」黃標請款列無標註（設計如此）；收支詳情的標註鈕原本排在圖片集之後易被擠出視野；`sessionCanFlag` 若遇 API `can_flag:false`（身分軟失敗／舊快取）會把 ≥3 的鈕藏掉；列表無任何可標示意 |
| 技術 | `ledger_history.html`：權限取 hub/session 較高者；≥3 且未標則顯示鈕；詳情置頂 sticky「標註錯誤」；藍標列表列內直接有按鈕；文案澄清。`accounting_nav.js` v=3：合併 query 取較高 permission、去重。`api?v=90` |
| 驗證 | `node modules/accounting/tools/test-ledger-flag-button-visible.js`；本地 serve 以 Yang uid／permission=3 開頁 DOM 確認有 `data-role=list-flag`／`flag-error` |
| 部署 | Pages 待 push main；對齊 Backend list `can_flag` |


## 追加：必填錯誤原因（同日）

- 標註時 `prompt` 必填「錯誤記帳原因」；寫入備註 `[error_flag:… reason:…]`
- 列表／詳情顯示 `error_flag_reason`；API `accounting_ledger_flag` 無 reason 拒收
- cache-bust `api?v=91`
