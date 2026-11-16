# 2026-11-16｜會計 Hub 只帶 user_id 的請求附 hub_gate_ticket（前端，未部署）

## 目的
Backend_GAS #377：accounting-gas `HubUserIdGate` 要等所有正當呼叫端都帶有效 `hub_gate_ticket` 才能切 enforce。本 PR 讓 liff-checkin 盤點到的呼叫端帶票；取不到票照常送出（audit 期間不擋人）。

## 改動
- 新增 `shared/js/hub_gate_ticket.js`：向 project-console `accounting_hub_gate_ticket` 換票；依票內 exp 快取在 sessionStorage（主控台與 iframe 共用、到期前 20 秒換新）；同時多個請求只取一次；失敗退避 60 秒；單一請求最多等 5 秒；console `[HubGateTicket][WARN] reason=…`（uid 只印末 4 碼、不印票／token）。
- `shared/js/accounting_api.js`：`post()` 送出前對有 `user_id`／`auth.user_id`／`operatorUserId` 的 body 附票（複製 body，不改呼叫端物件）；頁面沒載 lib 時自動補載同目錄檔。涵蓋 Hub 登入、各會計 action、錯誤回報、請款、存摺 OCR、`accounting_ingest.html`。
- `spa/app.js`＋`index.html`：Hub 首頁款項待辦附票；`app.js?v=26.11.16.1`。
- `tools/sketchup-render-studio/`：`apiPost` 有 user_id 時附票。

## 仍無法帶票
- SketchUp 工作室 `?uid=`（外部瀏覽器、無 LINE 登入）：拿不到 LIFF token → 換不到票，需另做決策。
- 主控台 LINE 登入過期（約 1 小時）且快取票也過期：Hub 與 iframe 都換不到票，直到重新開主控台。

## 驗證
- `node modules/accounting/tools/test-hub-gate-ticket.js`（14 項）
- `node modules/accounting/tools/test-hub-gate-ticket-callers.js`（10 項；main 上 7 項失敗＝重現未帶票）
- Chromium＋mock GAS：Hub iframe 取票／token 過期／主控台拒發三情境；SketchUp `?uid=` 照常載入。
- 其餘 `modules/accounting/tools/test-*.js` 與 main 相同（`test-ledger-review-bundle-timeout.js` 在 main 已因衝突標記失敗）。
