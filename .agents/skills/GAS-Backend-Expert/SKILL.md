---
name: gas-backend-expert
description: >-
  改 backend/ 內 Google Apps Script：API action、試算表、觸發器、LINE／Gemini／部署。
  Use when editing GAS, backend API, clasp deploy, accounting-gas, CheckinSystem,
  project-console, or frontend errors trace to backend.
---

# GAS 後端開發

> **CODING 只有前端**；後端在 **`../backend/`**。改 API／試算表／觸發器時載入本 skill。

## 何時用

- 改 `action`、試算表寫入、定時觸發、LINE／Dropbox／Gemini
- 前端報錯懷疑後端（先對 **資料字典 + SPEC**，再到 backend 查）
- 使用者說部署 GAS（仍須**明確**說「部署／發布」才執行 clasp）

## 模組地圖（backend/ 下）

| 模組 | 路徑 | 白話用途 |
|------|------|----------|
| 專案主控台 | `project-console/` | 案場、施工日誌、日報、LINE webhook、轉發會計 |
| 考勤 | `CheckinSystem/` | 打卡、假勤、排班、生產力助手 API |
| 會計 | `accounting-gas/` | 收支試算表、OCR、廠商請款、LINE 記帳 ingest |
| 共用函式庫 | `core_library/` | LINE／Gemini 等 Library；**無 Web App** |
| 專案排程 | `ProjectSchedule/` | 排程小工具（較獨立） |

架構總覽：`backend/全專案系統技術規格書_自動生成.md`  
帳號／scriptId：`backend/SPEC/GOOGLE_ACCOUNTS.md`

## 必讀（CODING 側）

| 文件 | 用途 |
|------|------|
| `SPEC/專案全域資料字典.md` | 欄位名**唯一**準則 |
| `SPEC/07_全量系統全景圖.md` | 前後端怎麼串 |
| 模組 SPEC | 如 `施工回報_系統完整_SPEC`、`03_員工打卡系統規格書` |

會計細節：`backend/accounting-gas/SPEC/`（欄位見 `SHEET_COLUMN_MAP.md`）

## 開發原則

1. **常數集中** — 表名、TTL 放 `Constants.js`／`config_.js`，邏輯裡不硬編碼表名。
2. **路由一致** — `doGet`／`doPost` 依 `action`（或 `page`）分派；新 action 對齊前端 + SPEC + 各模組 `WebApp.js` 描述表。
3. **回傳格式** — 沿用該模組慣例（多為 JSON：`success`、訊息、`data`）；業務失敗勿混 HTTP 500 除非真的壞掉。
4. **錯誤** — `try/catch` + 人話訊息；金鑰／堆疊只寫 log，不回前端。
5. **試算表** — 欄位順序對字典；大量讀寫用批次（見下方關聯 skill）。
6. **觸發器** — 定時任務放 `ScheduledTasks.js` 等專檔；部署後確認雲端觸發器未重複。
7. **Library** — 共用放 `core_library`；改 Library 後要 **push Library**，引用它的專案才吃到新版。

## 安全

- 金鑰、Token → **Script Properties**；勿 commit。
- Web App 對外要驗證來源／secret（各模組沿用既有做法，如 `INGEST_SECRET`）。

## 與前端協作

- 改欄位或 action → **同步** `專案全域資料字典.md` + 相關 SPEC。
- 只改 CODING 呼叫端 → `.cursor/rules/gas-and-spec-pointer.mdc`。
- 前端 API 網址 → `shared/js/config.js`（勿寫進 SPEC／skill）。

## 部署（勿自動執行）

| 情境 | 做法 |
|------|------|
| **日常**（project-console／CheckinSystem） | `backend/upload.bat` → push `main` → GitHub Actions 自動 clasp |
| **會計** accounting-gas | 子目錄 `deploy.bat`（`-u nephihuang`）或 Actions push `accounting-gas/**` |
| **共用 Library** | `core_library/deploy.bat`（僅 push，無 Web App deploy） |
| **緊急本機** | 各模組 `deploy.bat`；見 [reference.md](reference.md) |

- 僅在使用者明確說「部署、發布、Deploy」時跑 clasp。
- push 後到 [Backend_GAS Actions](https://github.com/nephi4377/Backend_GAS/actions) 確認綠燈。
- 改 `appsscript.json` 或新增定時函式 → 部署後查 GAS 雲端「觸發器」。

細節（clasp 帳號、deploymentId、action 索引、配額踩坑）→ **[reference.md](reference.md)**

## 關聯 skill

| Skill | 何時一起用 |
|-------|-----------|
| `gas-sheets-batch-io` | 試算表慢、逾時、迴圈內逐格讀寫 |
| `gemini-usage-policy` | accounting-gas OCR、模型、token 額度 |
| `debug-loop` | 已壞、要重現＋根因＋再測 |
| `code-advisor` | 改完要審、尚未部署 |

## 改完自檢

- [ ] 欄位／action 與字典、SPEC、前端一致？
- [ ] 無金鑰、無硬編碼表名？
- [ ] 大量 Sheet 操作是批次而非迴圈逐格？
- [ ] 需部署時已提醒使用者，且未擅自 clasp？
