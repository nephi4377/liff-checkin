# TOS 第三輪盤點｜Task 與 Employee Identity

日期：2026-08-24

本文件補充 `TOS_AUDIT.md`，記錄第三輪深入盤點結果；後續會再整併回主盤點文件。

---

## 1. NotificationCenter 實際上已包含 Task Domain 雛形

`project-console/NotificationCenter.js` 不只是單純通知功能。

已確認欄位／語意：

- NotificationID
- TaskID
- Timestamp
- SenderID
- SenderName
- RecipientID
- RecipientName
- Type
- Title
- Content
- Status
- ActionType
- ActionDeadline
- ActionPayload
- RelatedProjectID
- RelatedLink

支援狀態／互動：

- Unread
- Overdue
- Read
- Archived
- Completed
- reply
- complete

### 判斷

目前系統其實已具備「交辦事項／Task」核心概念，只是被包在 NotificationCenter 裡。

### TOS 建議

不要另外從零建立完全重複的 Task 系統。

後續應拆成：

```text
Task
├─ task_id
├─ project_id
├─ title
├─ content
├─ creator_employee_id
├─ assignee_employee_id
├─ due_at
├─ status
├─ completed_at
└─ result / reply

Notification
├─ notification_id
├─ task_id
├─ recipient_employee_id
├─ read_status
└─ delivery metadata
```

也就是：

**Task 是業務資料，Notification 是配送／提醒資料。**

目前兩者混在同一 Sheet，短期可保留，長期應邏輯分層。

---

## 2. project-console API 已經是大型整合入口

`WebApp.js` 已確認 GET / POST routes 包含：

- project
- get_hub_projects_data
- get_notifications
- getSingleLog
- get_daily_reports
- get_site_project_status
- get_site_ai_analysis
- submitReport
- sendNotification
- process_notification_action
- updateSchedule
- createFromTemplate
- createLog
- updateLogText
- deleteLog
- updateProjectStatus
- material selection 系列
- LINE webhook
- Facebook webhook
- accounting-gas 轉接
- Dropbox 完工媒體

### 判斷

`project-console` 已不是單一 Project Console Backend，而是公司多服務共用的 integration gateway。

### 風險 R-008｜單一 GAS 專案承擔過多 Domain

目前至少混合：

- Project
- Schedule
- Log
- Notification / Task
- LINE
- Facebook
- Accounting bridge
- Material Selection
- AI
- Media
- Customer member/rich menu

若持續新增功能，WebApp route 與跨檔案依賴會逐漸形成 monolith。

### 建議

短期不拆部署，先在程式邏輯上建立 Domain boundary：

```text
ProjectService
TaskService
EmployeeService
CommunicationService
MediaService
FinanceBridge
MaterialService
```

未來需要時再決定是否拆成不同 GAS / Cloud service。

---

## 3. CheckinSystem 的 Employee Domain 已相當成熟

`CheckinSystem/EmployeeLogic.js` 已確認：

- `員工資料` 為主要員工 roster
- 另有員工封存機制
- 離職滿 90 天後可移入封存
- 有統一 roster cache
- 已建立 `_accessEmployeeSheet_` / `_manageEmployee_` 類型的統一入口概念
- 員工欄位已涵蓋人事、班別、權限、薪資、銀行、聯絡電話、特休等

主要 API object mapping 包含：

- userId
- permission
- shiftStart
- shiftEnd
- shiftType
- group
- status
- hireDate
- resignationDate
- flexibleMinutes
- payType
- payRule
- baseSalary
- allowances
- insurance
- bankCode
- accountNo
- contactPhone
- annualLeaveQuotaOverride

### 判斷

Employee 主檔不需要重新設計一套新的資料來源；應優先把 CheckinSystem 的員工資料提升為 TOS Employee canonical source。

---

## 4. Identity Mapping 目前仍以 LINE userId 為核心

已確認 project-console 使用的 `userId` 與 CheckinSystem 員工資料中的 `userId` 是重要識別欄位，且會被拿來：

- 權限判斷
- 專案負責人解析
- Notification RecipientID
- Firebase notifications/{UID}
- 現場回報 userId

### 風險 R-009｜LINE UID 同時被當員工主鍵

LINE UID 適合當外部 identity，但不適合成為公司永久 employee primary key。

原因：

- 它是外部平台識別碼
- 未來可能增加 Google / Email / Device / App identity
- 員工與外部帳號應可一對多

### TOS 建議

新增 canonical：

```text
employee_id = EMP-xxxx
```

Identity alias：

```text
EmployeeIdentity
- employee_id
- provider: line | device | google | email
- external_id
- is_primary
- active
```

短期不改現有 `userId`，先由 adapter 轉換。

---

## 5. 第三輪新增決策

### D-005｜Employee canonical source 優先沿用 CheckinSystem

以 `CheckinSystem/員工資料` 作為 TOS Employee Domain 的主要資料來源，避免重建另一張員工主檔。

### D-006｜Task 與 Notification 邏輯分離

現有 `NotificationCenter` 短期保留；TOS canonical schema 中 Task 與 Notification 分開建模。

### D-007｜project-console 暫不拆部署，先拆 Domain boundary

先整理 API、schema、service ownership，再評估實體拆服務，避免為重構而重構。

---

## 6. 下一輪

1. 深入 CheckinSystem 的 device / 電腦綁定資料。
2. 確認 employee `userId` 是否百分之百等同 LINE UID。
3. 追 `_getAllSites_()` 真正資料來源與案場資料 schema。
4. 追 `_getProjectSchedulesCache_()` / `_getProjectLogsCache_()` cache source。
5. 建立 `TOS_CANONICAL_SCHEMA.md` 第一版。
