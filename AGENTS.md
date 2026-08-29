# AGENTS.md

專案細節與操作手冊見 `README.md`、`README_CODING.md`、`PROJECT_MAP.md`、`SPEC/`，
以及 `.agents/skills/Cloud-Agent-Runbook/`（本地開站、測試、LIFF bypass）。

TOS（添心營運管理系統）盤點文件一律在 `TOS/`（主紀錄 `TOS/TOS_AUDIT.md`）。不要把 `TOS_AUDIT*.md` 寫回倉庫根目錄。發現新模組、資料流、技術債或 schema 問題可補充 TOS 文件；不要刪既有盤點內容。案件識別長期朝 `project_id`，legacy 欄位先不要大量改名。

## Cursor Cloud specific instructions

此段給「環境已由 update script 安裝好依賴」的後續 cloud agent，只記非顯而易見的啟動／執行注意事項。

### 多 repo 雲端環境（前端＋後端）
- 自動排程／Cloud Agent 若需改 GAS，環境必須同時掛 **`nephi4377/liff-checkin`** 與 **`nephi4377/Backend_GAS`**（Cursor Dashboard → Cloud Agents → Environments）。
- 後端目錄名通常為 **`Backend_GAS`**，與本 repo 同層；找不到時用 `ls` 確認同工作區的 sibling repo。
- 本 repo 根目錄 **不要** `npm install`（根 `package.json` 含 Playwright，會拖慢 Build）；靜態站用 `npx --yes serve@14` 即可。
- 後端部署用 `npx @google/clasp`（各子目錄有 `.clasp.json`）；未明說部署不要 `clasp deploy`。

### 這是什麼
- 純靜態前端：Vue 3 SPA + iframe 模組（`modules/`），從 **repo 根目錄** 用 `serve` 開站。
- 後端是另一個 repo 的 Google Apps Script（`shared/js/config.js` 指定 URL），本 repo 不含後端程式。

### 啟動本地站（不放進 update script）
- 主控台：`npx --yes serve@14 -l 8080 .`，開 `http://127.0.0.1:8080/`。
- `serve` 會對 `.html` 做 clean-URL 301 轉址（例：`/modules/.../foo.html` → `/modules/.../foo`），curl 檢查時屬正常，非錯誤。
- LayoutPlanner 也可單獨開：`npm run serve --prefix modules/InteriorDesigned`（`:8765`）。

### Lint / 測試 / 建置
- 沒有 lint step，也沒有 build step（靜態站，直接 serve）。
- 唯一自動化測試在 `modules/InteriorDesigned`：`npm test --prefix modules/InteriorDesigned`（Vitest 單元 + Playwright e2e）。e2e 會自動起 `serve@8765`。

### 可測 / 不可測範圍
- **可本地端到端驗證**：`modules/InteriorDesigned` LayoutPlanner（不需登入，桌機視窗即可，無「僅限手機」遮罩）。
- **多數其他模組**（`daily_report`、`projects`、`attendance` 等）走 LINE LIFF 身分，本地只能驗 UI；完整流程需正式站或 `reportV3.html` 的 local bypass（測完務必改回 false，見 Runbook）。
- LayoutPlanner 頁的「施工面積」欄位僅供備註／匯出，不自動連動預算金額（預算需靠新增工程項目），$0 為預期行為。
