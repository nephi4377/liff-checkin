# 2026-10-06｜歷史記帳「近期收支」90s 逾時 hotfix

| 項目 | 內容 |
|------|------|
| Diff／目的 | 搭配後端掃表加速；正式站 cache-bust |
| 技術 | `ledger_history.html`：`accounting_api.js?v=88`；`accounting_api.js` 註解：維持 90s、勿再加長 |
| 對應後端 | accounting-gas LOG「近期收支逾時hotfix」 |
| 驗證 | 正式站 HTML 含 `api?v=88`；Yang ≥3 重開歷史記帳 → 近期收支應數秒內出列表 |
