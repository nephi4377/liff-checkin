# TOS｜添心營運管理系統盤點紀錄

> 建立日期：2026-08-24  
> 目的：持續盤點「添心設計」現有程式、資料流、模組、技術債與營運缺口，作為 TOS（Tianxin Operating System／添心營運管理系統）後續整併與重構依據。

---

## 1. 盤點原則

本文件與既有 `PROJECT_MAP.md` 分工如下：

- `PROJECT_MAP.md`：描述既有系統藍圖、模組關係與主要資料流。
- `TOS_AUDIT.md`：記錄實際盤點結果、現況判斷、問題、風險、缺口、優先級與後續建議。

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
6. Dropbox 圖片與檔案儲存
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

- [ ] 確認目前案件 ID 來源與格式
- [ ] 確認 Project 主資料存在哪一張 Sheet／哪個模組
- [ ] 確認員工 ID、LINE userId、電腦綁定 ID 是否一致或可映射
- [ ] 確認施工日報與 Project 的關聯欄位
- [ ] 確認 ProjectSchedule 與 project-console 是否共用案件資料

### P1｜後端模組

- [ ] CheckinSystem
- [ ] ProjectSchedule
- [ ] project-console
- [ ] core_library
- [ ] accounting-gas

### P2｜前端與入口

- [ ] LIFF 打卡
- [ ] LIFF 施工日報
- [ ] Web 戰情室
- [ ] Electron 客戶端

### P3｜外部服務

- [ ] LINE Messaging API
- [ ] Dropbox
- [ ] Gemini API
- [ ] Firebase
- [ ] Google Sheets

---

## 6. 初步風險／技術債假設

> 尚待程式碼逐項驗證，以下暫列為待查項目，不視為既定問題。

- GAS 各模組可能存在相似的資料讀取／格式轉換邏輯。
- Google Sheets 若同時被多個模組視為主資料來源，可能有 schema 不一致問題。
- `project-console`、`ProjectSchedule` 與前端可能各自維護專案狀態。
- LINE userId、員工 ID、設備 ID 與 Project 成員關係需要統一 identity mapping。
- 圖片儲存在 Dropbox，但資料索引可能散落在 Sheet、LIFF payload 或 Firebase。
- AI 摘要屬輔助資訊，不應成為唯一可稽核施工紀錄。

---

## 7. 本次盤點進度

### 2026-08-24

已完成：

- 確認 `nephi4377/liff-checkin` 可讀取。
- 確認 `nephi4377/Backend_GAS` 可讀取，且為 private repository。
- 確認前端 Repo 已存在 `PROJECT_MAP.md`、`SPEC/`、`LOG/` 等文件治理結構。
- 確認 Backend_GAS 已拆分 Checkin、排程、記帳、共用函式庫與專案控制台等主要模組。
- 建立本 `TOS_AUDIT.md` 作為持續盤點紀錄。

下一步：

1. 深入 `project-console`，找出 Project／施工日報／Firebase／Dropbox／LINE 的實際資料流。
2. 深入 `ProjectSchedule`，確認案件與排程資料模型。
3. 對照兩者是否共用相同 project key。
4. 再進入 `CheckinSystem` 與 identity mapping。

---

## 8. 決策紀錄

### D-001｜不從零重寫

現階段策略：保留既有可用模組，優先整理資料模型與介面，再逐步重構。

原因：既有系統已具備大量可用功能，全面重寫風險高、時間成本高，且容易丟失目前已驗證過的營運邏輯。

### D-002｜TOS 採漸進式整併

優先順序：

`Project → Task / Schedule → Progress → Cost → Profit`

後續再接：

`CRM → Quote → Contract → Payment → Inspection → Bonus → KPI → BI / AI`
