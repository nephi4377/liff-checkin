# TOS｜添心營運管理系統盤點紀錄

> 建立日期：2026-08-24  
> 目的：持續盤點「添心設計」現有程式、資料流、模組、技術債與營運缺口，作為 TOS（Tianxin Operating System／添心營運管理系統）後續整併與重構依據。

---

## 1. 盤點原則

本文件與既有 `PROJECT_MAP.md` 分工如下：

- 倉庫根目錄 `PROJECT_MAP.md`：描述既有系統藍圖、模組關係與主要資料流。
- `TOS/TOS_AUDIT.md`：記錄實際盤點結果、現況判斷、問題、風險、缺口、優先級與後續建議。
- 所有 TOS 盤點檔（主紀錄、Master Summary、各 Round）一律放在 `TOS/`，不要寫回倉庫根目錄。

盤點過程持續更新，不以一次性報告為目標。

---

## 2. 已確認的主要 Repository

### 2.1 nephi4377/liff-checkin

角色：目前可視為「前端／LIFF／企業工具整合與文件中心」之一。

已確認存在：

- `.agents/`
- `.cursor/`
- `LOG/`
- `SPEC/`
- `assets/`
- `AGENTS.md`
- `PROJECT_MAP.md`
- `README.md`
- `README_CODING.md`

目前判斷：此 Repo 已不只是單純的 LIFF 打卡頁，而是逐步承載企業前端工具、AI Agent 規範、系統文件與部分 Web 戰情介面。

### 2.2 nephi4377/Backend_GAS

角色：Google Apps Script 雲端後端核心。

已確認主要模組：

- `CheckinSystem/`
- `ProjectSchedule/`
- `accounting-gas/`
- `core_library/`
- `project-console/`
- `LOG/`
- `SPEC/`
- `patches/`
- `tools/`

目前判斷：Backend_GAS 已具備模組化後端雛形，而不是單一 GAS Script。

---

## 3. 既有系統架構初步確認

根據 `PROJECT_MAP.md`，現有架構已涵蓋：

1. Electron 員工生產力／出勤客戶端
2. GAS 雲端後端
3. Google Sheets 資料儲存
4. Web 戰情前端
5. LINE／LIFF 身分綁定與現場回報
6. Dropbox／Drive／Firebase 圖片與檔案處理
7. Gemini AI 內容處理
8. 備份守護工具
9. 本地 SQLite 財務／記帳工具
10. 投資分析工作區

### 初步判斷

目前真正需要做的，不是重寫整套系統，而是：

- 統一案件主鍵與資料模型
- 找出重複資料來源
- 明確切分各模組責任
- 整理 API 契約
- 建立跨模組狀態流
- 補足 CRM → 報價 → 合約 → 施工 → 成本 → 驗收 → 結案 → 獎金 → KPI 的完整營運閉環

---

## 4. TOS 最終營運主流程

預計整併為：

接案
↓
設計
↓
報價
↓
簽約
↓
施工
↓
進度
↓
成本
↓
驗收
↓
結案
↓
獎金
↓
績效

所有階段應以單一 `project_id` 為主索引，避免跨 Sheet、GAS、前端與 LINE 系統各自建立不同案件識別。

---

## 5. 第一批盤點重點

### P0｜核心資料結構

- [x] 確認 `project-console` 目前核心案件索引：以「案號」作為跨模組 project key
- [ ] 確認案號的正式來源、生成規則與唯一性約束
- [ ] 確認 Project 主資料存在哪一張 Sheet／哪個模組
- [ ] 確認員工 ID、LINE userId、電腦綁定 ID 是否一致或可映射
- [x] 確認施工日報與 Project 的關聯欄位：`ProjectLog.ProjectName` 實際儲存 `projectId`
- [x] 確認 `ProjectSchedule` 與 `project-console` 並非單純同一資料模型：目前存在兩種排程模型

### P1｜後端模組

- [ ] CheckinSystem
- [~] ProjectSchedule（完成首輪）
- [~] project-console（完成首輪）
- [ ] core_library
- [ ] accounting-gas

### P2｜前端與入口

- [ ] LIFF 打卡
- [~] LIFF／Web 施工日報後端流程（已確認 Fast Report / UploadQueue 部分）
- [~] Web 戰情室後端聚合（已確認 HubLogic）
- [ ] Electron 客戶端

### P3｜外部服務

- [~] LINE Messaging API（已確認通知依 project → 負責人 UID 路徑）
- [ ] Dropbox
- [ ] Gemini API
- [~] Firebase（已確認通知與報告圖片搬運兩種用途）
- [~] Google Sheets（已確認 ProjectLog、UploadQueue、排程待辦池等資料表）

---

## 6. 已確認風險／技術債

### R-001｜同一 Project Key 有多種欄位名稱

目前確認至少出現：

- 案場資料：`案號`
- 排程資料：`案號`
- 日誌資料：`ProjectName`，但實際內容寫入的是 `projectId`
- 通訊／客戶資料：`專案號碼`
- 通知資料：`RelatedProjectID`

判斷：語意相同但 schema 命名不一致，後續很容易造成 mapping 錯誤。

建議：TOS canonical schema 統一採 `project_id`，舊欄位由 Adapter 層轉換，不急著一次改掉全部 Sheet 表頭。

### R-002｜存在兩套不同的排程資料模型

#### A. `project-console`

排程屬於結構化 rows：

- 以 `案號` 過濾專案
- 任務包含 `預計開始日`
- 任務包含 `預計完成日`
- 任務包含 `狀態`
- Hub 可依案號聚合排程

#### B. `ProjectSchedule`

目前是「木作排程」專用試算表模型：

- `待辦任務池` 儲存案號、工項、預期天、實際天、工班、優先、狀態、業主、地點、備註
- 主表 `2026木作排程記錄表` 使用 日期 × 人員／排程欄
- 指派時直接把 `projectId` 寫進日曆儲存格
- 實際天數再反向掃描整張排程表計算

風險：同一件「排程」在兩邊的資料表示方式不同，無法直接互換。

建議：短期不拆掉木作排程表；建立 `Schedule Adapter`，先把木作排程轉成 TOS 標準 Task/Schedule 資料，逐步讓主系統取得一致視圖。

### R-003｜`ProjectLog.ProjectName` 欄名語意錯置

`ProjectLogic._manageLogEntry_()` 建立日誌時：

`ProjectName: projectId`

也就是 `ProjectName` 欄位實際放的是「案號」，不是案場名稱。

風險：未來新程式看到欄名很容易誤用。

建議：canonical model 改為：

- `project_id`
- `project_name`

舊 Sheet `ProjectName` 先視為 legacy `project_id`。

### R-004｜開工日存在「人工值＋推導值」雙來源

`resolveProjectStartDateForSiteInfo_()`：

1. 優先使用案場表 `專案起始日`
2. 若沒有，從 ProjectLog 中木作／保護／油漆／系統工程第一則已發布日誌推導開工日

判斷：這個設計合理，但需要把來源一併保存，否則 UI 看得到日期卻不知道是人工設定還是系統推算。

TOS 建議：

- `start_date`
- `start_date_source = manual | first_site_log`

### R-005｜員工身分目前主要以 LINE UID 為主

Hub 權限與 Firebase 通知目前均會使用員工資料的：

- `userId`
- `userName`
- `權限`
- `組別`

專案負責人欄位甚至同時允許「UID 或姓名」，並支援逗號分隔多人。

風險：姓名可變更／重名，不適合作為關聯鍵。

建議：建立 TOS `employee_id`，將 LINE UID、姓名、設備 ID 都當 identity alias。

### R-006｜Firebase 同時肩負通知與媒體中繼

已確認至少有兩種用途：

1. `notifications/{employeeId}`：LINE/FB 客戶訊息的即時推送
2. 回報照片：Firebase Storage → UploadQueue → Google Drive 的非同步搬運
3. `quotations/{案號}`：結案狀態同步

判斷：Firebase 不是單一用途資料庫，而是即時事件層＋媒體中繼＋部分業務狀態鏡像。

建議：未來文件中明確區分：

- Firebase Notification Bus
- Firebase Upload Staging
- Firebase Business State Mirror

避免誤認 Firebase 是 TOS 唯一資料庫。

### R-007｜圖片上傳流程已有 Queue／Lock／Retry，應保留

`FirebaseHandler` 已具備：

- `batchId` 冪等控制
- UploadQueue
- chunk 分塊
- Script Lock
- time-based trigger
- retry / exponential backoff
- Firebase → Drive 非同步搬運

判斷：這部分已屬成熟的基礎設施，不建議重寫，只需標準化介面與監控。

---

## 7. 已確認的資料流

### F-001｜主控台專案聚合

```text
員工 userId
  ↓
Employees Cache
  ↓ 權限 / 組別 / userName
案場資料 _getAllSites_()
  ↓ project_id = 案號
  ├─ ProjectSchedule Cache[案號]
  ├─ ProjectLog[ProjectName = 案號]
  └─ Notifications[RelatedProjectID = 案號]
  ↓
Hub Project Card
```

### F-002｜客戶訊息 → 負責人即時通知

```text
LINE / Facebook Webhook
  ↓
客戶資料
  ↓ 專案號碼
案場資料[案號]
  ↓ 專案負責人
Employees[userId / userName]
  ↓
LINE UID
  ↓
Firebase notifications/{UID}
  ↓
員工生產力助手
```

無負責人時，目前會從台南／高雄且權限 >= 2 的員工中隨機挑選，最後再 fallback 到 Admin UID。

### F-003｜現場快速回報照片

```text
前端 Fast Report
  ↓ batchId / projectId / userId / photos
Firebase Storage URL
  ↓
UploadQueue
  ↓ 分塊 / Lock / Trigger / Retry
Google Drive
  ↓
既有正式處理流程
  ↓
ProjectLog
```

---

## 8. `ProjectSchedule` 首輪盤點

### 功能定位

目前它較像「木作／工班產能排程器」，而非全公司的通用 Project Schedule Engine。

### 主要 Sheet

- `2026木作排程記錄表`
- `待辦任務池`
- `System_Holidays`

### 待辦任務池欄位

1. 案號
2. 工項
3. 預期天
4. 實際天
5. 工班
6. 優先
7. 狀態
8. 業主
9. 地點
10. 備註

### 已確認狀態

- 待辦
- 排定中
- 進行中
- 元工
- 完成

注意：`元工` 疑似業務語意或 typo，後續需確認實際定義。

### 特性

- 支援國定假日與 System_Holidays
- 指派會略過假日
- 以案號填入日曆格
- 可計算人員負荷
- 可掃描排程格反推實際工作天

### TOS 判斷

此模組值得保留其 UI/操作邏輯，但底層資料應逐步由「格子是資料」轉成「Task/Schedule row 是資料；格子是視圖」。

---

## 9. `project-console` 首輪盤點

### 已確認檔案

- `ProjectLogic.js`
- `HubLogic.js`
- `FirebaseBridge.js`
- `FirebaseHandler.js`
- `CompletionMediaList.js`
- `MasterCacheWarm.js`
- `MaterialPortalAccess.js`
- `MaterialSelectionModule.js`
- `NotificationCenter.js`

### 初步角色

`project-console` 已經非常接近 TOS 的「Project Domain Backend」，它負責：

- 專案聚合
- 專案權限
- 排程讀取
- 日誌 CRUD
- 開工日推導
- 通知聚合
- Firebase 即時通知
- 現場回報圖片中繼
- 選材
- 完工媒體

因此未來不應把它當成單純的「主控台後端」，而應考慮逐步重構成 TOS Project Service。

---

## 10. 本次盤點進度

### 2026-08-24｜第一輪

已完成：

- 確認 `nephi4377/liff-checkin` 可讀取。
- 確認 `nephi4377/Backend_GAS` 可讀取。
- 建立本 `TOS_AUDIT.md`。

### 2026-08-24｜第二輪：project-console / ProjectSchedule

已完成：

- 讀取 `project-console/ProjectLogic.js`
- 讀取 `project-console/HubLogic.js`
- 讀取 `project-console/FirebaseBridge.js`
- 讀取 `project-console/FirebaseHandler.js`
- 讀取 `ProjectSchedule/CONFIG.js`
- 讀取 `ProjectSchedule/程式碼.js`
- 確認案號已經是多數專案資料的實際 join key
- 確認 ProjectLog 欄位命名錯置
- 確認 project-console 與木作 ProjectSchedule 為兩套排程模型
- 確認 Firebase 的三種角色
- 確認 Fast Report 已有 Queue / Lock / Retry / Idempotency 基礎設施

下一步：

1. 找出 `_getAllSites_()`、`_getProjectSchedulesCache_()`、`_getProjectLogsCache_()` 的實際來源 Sheet 與欄位 schema。
2. 盤點 `NotificationCenter.js`，確認通知表 schema。
3. 盤點 `CheckinSystem`，建立 Employee / LINE UID / Device identity mapping。
4. 找出 `ProjectSchedule` 的資料是否有同步進 `project-console`，或目前完全獨立。
5. 建立第一版 `TOS_CANONICAL_SCHEMA.md`。

---

## 11. 決策紀錄

### D-001｜不從零重寫

現階段策略：保留既有可用模組，優先整理資料模型與介面，再逐步重構。

原因：既有系統已具備大量可用功能，全面重寫風險高、時間成本高，且容易丟失目前已驗證過的營運邏輯。

### D-002｜TOS 採漸進式整併

優先順序：

`Project → Task / Schedule → Progress → Cost → Profit`

後續再接：

`CRM → Quote → Contract → Payment → Inspection → Bonus → KPI → BI / AI`

### D-003｜保留現有案號，建立 Canonical Project ID 層

目前不強迫修改所有既有 Sheet 欄名。

先定義：

`TOS.project_id = legacy 案號`

所有 legacy 欄位（案號、ProjectName、專案號碼、RelatedProjectID）透過 adapter 映射。

### D-004｜木作排程短期保留，長期改為 View

`ProjectSchedule` 的試算表操作方式符合現場使用習慣，短期不取消。

長期目標：

- Task/Schedule row = source of truth
- 木作年度排程表 = calendar view / planning UI

避免試算表格子本身成為唯一資料庫。
