# GAS-Backend-Expert — 參考細節

> 由 `SKILL.md` 分流。帳號以 `backend/SPEC/GOOGLE_ACCOUNTS.md` 為準；有衝突以該檔與各模組 SPEC 為準。

---

## 1. clasp 與部署

### 1.1 專案對照

| 模組 | 路徑 | clasp 建議帳號 | 日常部署 |
|------|------|----------------|----------|
| project-console | `backend/project-console` | nephihuang 或已授權協作 | `backend/upload.bat` → Actions |
| CheckinSystem | `backend/CheckinSystem` | 同上 | 同上（改 `CheckinSystem/**` 觸發） |
| accounting-gas | `backend/accounting-gas` | **nephihuang** | `accounting-gas/deploy.bat` 或 Actions |
| core_library | `backend/core_library` | 依 `.clasprc` | **`core_library/deploy.bat`**（Actions 不自動） |
| ProjectSchedule | `backend/ProjectSchedule` | 依 `.clasp.json` | Actions 通常僅 push |

### 1.2 本機登入

```bat
npx @google/clasp@3.0.6-alpha login -u nephihuang
npx @google/clasp@3.0.6-alpha login
```

憑證：`%USERPROFILE%\.clasprc.json`。GitHub Secret `CLASPRC_JSON` 須能 push 對應 `scriptId`。

### 1.3 標準流程（project-console / CheckinSystem）

1. 在 **`backend/` 根目錄**（不是子資料夾）執行 `upload.bat`  
   - 可設 `NONINTERACTIVE=1` 略過 pause  
2. 腳本：備份 → commit → `git push origin main`  
3. Actions 依變更路徑 `clasp push -f` → `clasp deploy -i <deploymentId>`  
4. 驗證：Actions 綠燈 + 前端／LINE 抽測關鍵 action  

完整說明：`backend/project-console/SPEC/DEPLOYMENT_SPEC.md`

### 1.4 會計 accounting-gas

- **擁有者**：nephihuang；Web App 執行身分應為部署者（寫試算表用主帳號權限）。
- 日常：`cd backend/accounting-gas` → `deploy.bat`（讀 `.clasp.json` 的 `deploymentId`）。
- **首次** Web App URL：編輯器手動建「網頁應用程式」部署 → 見 `accounting-gas/SPEC/FIRST_WEBAPP_DEPLOY.md`（僅 `clasp deploy` 不會產生新 exec URL）。
- Actions：`.github/workflows/accounting-gas-clasp.yml`（push `accounting-gas/**`）。

### 1.5 三種權限（常搞混）

| 動作 | 需要 |
|------|------|
| `clasp push` | GAS **專案編輯權**（帳號與擁有者一致最省事） |
| Web App **執行**、寫試算表 | **部署者**帳號（會計應為 nephihuang） |
| `clasp login` | 本機「用哪個 Google 身分叫 API」 |

### 1.6 常見部署錯誤

| 現象 | 處理 |
|------|------|
| `The caller does not have permission` | `login -u nephihuang` 或請主帳號共用 GAS 專案 |
| Actions 失敗 | Secret `CLASPRC_JSON` 過期／帳號無權 → 重匯 `.clasprc.json` |
| 改了程式但線上沒變 | 只 push Git 沒改 `project-console/**` → Actions 未觸發；或 deploy 失敗 |
| deploymentId 混用 | 各模組 `.clasp.json` 與 `deploy.bat` 的 `-i` 必須一致，**勿跨專案** |
| 觸發器沒跑 | 部署後到 GAS 編輯器 → 觸發器；新增函式名後常需手動補 |

---

## 2. action 索引（摘要）

**權威來源**：各模組 `WebApp.js` 內 `ACTION_DESCRIPTIONS`／`GET_ROUTES`／`doPost` 分支。下表僅快速對照；新增 action 以程式為準。

### 2.1 project-console（GET 常用 `page` 或 `action`）

| action | 白話 |
|--------|------|
| `get_hub_projects_data` | 主控台專案列表 |
| `get_notifications` | 使用者通知 |
| `get_daily_reports` | 日報看板當日回報 |
| `getSingleLog` | 單篇施工日誌 |
| `getJobStatus` | 非同步上傳任務輪詢 |
| `get_social_logs` / `get_comments` | 社群日誌／留言 |
| `get_site_project_status` | 驗收表案場狀態 |

POST 常用：`submitReport`、`createLog`、`createUploadJob`、`uploadJobDataChunk`、`line_webhook`、`process_queue`、`updateProjectStatus`、`reconcileProjectClosure` 等。

入口：`backend/project-console/WebApp.js`

### 2.2 CheckinSystem

GET 常用：`checkin`、`attendance_api`、`get_report`、`get_my_leave_requests`、`get_pending_requests`、`get_latest_schedule`、`get_hub_today_presence`、`get_employees` 等。

POST 常用：`submit_leave_request`、`process_site_form`、`save_schedule_version`、`upsert_employee`、`submit_productivity_report`、`manage_plan_schedule` 等。

入口：`backend/CheckinSystem/WebApp.js`

### 2.3 accounting-gas（多為 POST `action`）

| 群組 | 代表 action |
|------|-------------|
| 健康／設定 | `health`、`accounting_policy`、`accounting_bootstrap` |
| 記帳 ingest | `ledger_ingest`、`accounting_form_submit` |
| 廠商請款 | `vendor_payment_*`（submit、list、approve、reject、mark_paid…） |
| 廠商註冊 | `vendor_register_*` |
| 廠商檔案 | `vendor_upload_photos`、`vendor_list_files` |
| 毛利 | `margin_*` |
| OCR | `vendor_register_ocr`（Gemini；見 gemini-usage-policy） |
| 維運（需 secret） | `setup_master_spreadsheets`、`setup_once_bootstrap`、`migrate_sheet_layout` |

入口：`backend/accounting-gas/WebApp.js`  
API 契約：`backend/accounting-gas/SPEC/README.md`

### 2.4 冒煙測試

```bash
curl -s "<WebApp_URL>?action=health"
curl -s "<WebApp_URL>?action=ping"
```

URL 從 CODING `shared/js/config.js` 或各模組 config 取，**勿寫死在本檔**。

---

## 3. 配額與踩坑

### 3.1 執行時間

- 單次 Web App／觸發器：**最長約 6 分鐘**（Workspace 略高，仍以實測為準）。
- 超時症狀：前端一直轉圈、GAS 執行紀錄 `Exceeded maximum execution time`。
- 對策：拆成非同步 job + 輪詢（project-console 的 `createUploadJob`／`getJobStatus` 模式）、或定時觸發器分批處理佇列。

### 3.2 試算表 API

- **禁止**在迴圈內反覆 `getValue`／`setValue`／`appendRow`（每次一次往返）。
- **應**一次 `getValues()` → 記憶體處理 → 一次 `setValues()`。
- 詳細審查流程 → skill **`gas-sheets-batch-io`**。

### 3.3 UrlFetch / 外部 API

- LINE、Gemini、Dropbox 每次 `UrlFetchApp.fetch` 計入配額；批次 OCR／大量 webhook 易撞限。
- Gemini token 控管 → skill **`gemini-usage-policy`** + `GeminiUsageLog.js`。

### 3.4 觸發器

- 勿在每次部署重複 `ScriptApp.newTrigger` 而不刪舊的 → 會倍數執行。
- 定時任務集中 `ScheduledTasks.js`；部署後到雲端確認觸發器列表。

### 3.5 Cache / 配額

- `CacheService` 單值約 **100KB**；大 JSON 勿整包塞 cache。
- `PropertiesService` 適合小設定，不適合大量資料。

### 3.6 跨模組呼叫

- project-console → accounting-gas：`ledger_ingest` + 共用 `INGEST_SECRET`（Script Properties 兩邊一致）。
- 改 ingest 契約須同時看 `project-console/accounting_ingest.js` 與 `accounting-gas/WebApp.js`。

---

## 4. 維護本參考

| 變更類型 | 更新哪 |
|----------|--------|
| 新 GAS 模組、新 deploy 路徑 | 本檔 §1 + `SKILL.md` 模組表 |
| 新 action | 各模組 `WebApp.js`（本檔 §2 可補一行摘要） |
| 新踩坑 | 本檔 §3 |
| 業務規則 | 模組 SPEC + CODING 資料字典（不在此重複） |
