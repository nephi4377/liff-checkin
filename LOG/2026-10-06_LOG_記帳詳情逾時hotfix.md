# 2026-10-06｜記帳詳情 60s 逾時 hotfix

## Diff／目的

歷史記帳點列「記帳詳情」連線逾時 60s → 錯誤回報。改為列表摘要立刻顯示、lean 詳情（略過附件索引）、15s 軟失敗、圖片集另載。

## 技術

- `ledger_history.html`：點列先 `fill` 列表 payload；`skip_attachments`；附件 soft load；cache-bust `api?v=80`／`ui?v=27`
- `accounting_api.js`：`LEDGER_DETAIL_TIMEOUT_MS=15000`；預設 `skip_attachments`
- `accounting_ui.js`：`accounting_ledger_detail` 逾時不噴錯誤回報 toast
- SPEC 15 v1.44

## 驗證

- `node --check` accounting_api／ui
- 後端 `node tools/test-ledger-detail-history.js`
- 正式站部署後：HTML 含 `api?v=80`；點列應秒開案號，不應再卡 60s 錯誤回報

## 部署

待 PR merge → Pages

## 部署

- Pages：[`37423041183`](https://github.com/nephi4377/liff-checkin/actions/runs/37423041183)
- 正式站：`accounting_api.js?v=81`／`accounting_ui.js?v=27`
- 配對 clasp：**@381**
