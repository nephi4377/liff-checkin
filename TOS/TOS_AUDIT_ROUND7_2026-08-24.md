# TOS 系統盤點｜Round 7｜Project Lifecycle

日期：2026-08-24

## 本輪目標

確認 Project Master 的「專案狀態／結案日」來源、修改方式與權限邏輯，評估是否已具備正式 Lifecycle／State Machine。

---

## 1. Project Master 已確認來源

`CheckinSystem/SiteLogic.js` 直接操作 Checkin 試算表中的 `案場資料`。

主要入口：

- `_accessSiteSheet_()`
- `_manageSite_()`
- `_getAllSites_()`

案件定位優先以 `案號` 查找，查不到時才退回以 `siteName` 比對。

因此再次確認：

`TOS.project_id = 案場資料.案號`

---

## 2. 現有「專案狀態」不是 State Machine

`_manageSite_()` 的寫入策略是：

1. 讀取案場 Sheet headers
2. payload 內只要有同名欄位，就直接套用到該欄
3. 沒有看到針對 `專案狀態` 的 enum 驗證
4. 沒有看到狀態轉移規則
5. 沒有看到「必須先驗收才能結案」等流程 gate

也就是目前：

`專案狀態` = 一般可寫欄位

而不是：

`Project Lifecycle State`

---

## 3. 已結案的實際系統效果

`_getAllSites_()` 取得案場時，會讀取 `專案狀態` 欄。

若：

`專案狀態 === 已結案`

該案件會被排除，不再出現在 active sites 清單。

目前「已結案」最明確的技術效果是：

- 從一般 active Project List 隱藏

尚未確認存在：

- 鎖定 Project 資料
- 鎖定 Schedule
- 鎖定施工日報
- 鎖定收支
- 建立 Margin Snapshot
- 建立 Bonus Snapshot
- 驗收完成檢查
- 未收款檢查
- 未付款成本檢查
- 未完成 Task 檢查

因此 `已結案` 目前比較接近「顯示狀態」，不是正式結案交易。

---

## 4. Lifecycle 寫入入口風險

`CheckinSystem/WebApp.js` 的 API handler 目前存在：

`update_site → _manageSite_({ ...params, action: 'SAVE' })`

而 `_manageSite_()` 本身沒有執行 user permission 驗證。

由於 payload 會按 header 名稱直接覆寫對應欄位，因此理論上若呼叫端可進入 `update_site`，也可能改寫 `專案狀態` 等 Project Master 欄位。

### R-016｜Project Master 更新權限需再收斂

建議：

- Project Master write API 必須有 server-side auth
- 不可信任前端只隱藏按鈕
- `project_status`、`closed_at`、負責人等敏感欄位應採欄位級權限
- 「正式結案」不能靠 generic `update_site`

---

## 5. 建議建立正式 Project Lifecycle

TOS canonical lifecycle 建議先不要做過度複雜，採：

```text
lead
↓
design
↓
quoted
↓
contracted
↓
construction
↓
inspection
↓
closing
↓
closed
```

另設：

- cancelled
- suspended

顯示中文可映射為：

- 接案中
- 設計中
- 已報價
- 已簽約
- 施工中
- 驗收中
- 結案確認中
- 已結案
- 已取消
- 暫停

Legacy Sheet 可繼續存中文，但 TOS Adapter 應統一成 canonical enum。

---

## 6. 正式結案不應等同 update status

建議新增獨立 command：

`closeProject(project_id)`

流程建議：

```text
Request Close
  ↓
檢查未完成事項
  ├─ 驗收是否完成
  ├─ 客戶收款是否完成
  ├─ 廠商請款是否仍待處理
  ├─ 未分攤成本
  ├─ 未完成 Task
  └─ 其他 Blocking Issue
  ↓
Close Review
  ↓
建立 Margin Snapshot
  ↓
Project.status = closed
  ↓
Project.closed_at
  ↓
產生 Bonus Calculation
```

必要時允許老闆 Override，但必須留下 reason 與 audit log。

---

## 7. 建議新增 Project Lifecycle Audit

資料至少包含：

- lifecycle_event_id
- project_id
- from_status
- to_status
- changed_by
- changed_at
- reason
- source
- override

這樣才能回答：

「752 案為什麼在 8/15 結案？」

而不是只看到現在欄位是 `已結案`。

---

## 8. 正式決策

### D-019｜Project Lifecycle authoritative source

Project lifecycle 的 authoritative source 應屬於 Project Domain／Project Master。

Finance、Hub、Schedule 等只能同步／讀取，不應各自決定結案狀態。

### D-020｜禁止用 generic update_site 執行正式結案

一般案場編輯可以繼續沿用 `_manageSite_()`；但正式 `close / reopen / cancel` 應使用專用 command，包含權限、前置條件與 audit。

### D-021｜正式結案是一個 Business Transaction

`closed` 不只是某欄填入「已結案」，而是一組動作：

1. validation
2. approval
3. margin snapshot
4. lifecycle audit
5. status commit
6. downstream bonus trigger

### D-022｜保留 Legacy 中文欄位，新增 Adapter

短期不全面改 Sheet header。

Legacy：`專案狀態`

Canonical：`project_status`

由 Adapter 統一轉換。

---

## 9. 新增風險

### R-015｜「已結案」目前只造成 active sites 過濾

技術上尚未形成跨 Domain 結案交易，因此不能直接作為 Bonus Trigger。

### R-016｜generic Project update API 權限邊界過寬

`update_site` 對 `_manageSite_()` 的 generic payload 更新方式，可能讓敏感 lifecycle 欄位缺乏欄位級保護。

### R-017｜Project status 缺少 transition validation

目前看不到：

- construction → inspection
- inspection → closing
- closing → closed

等合法轉移規則。

容易出現跳階、回退或拼字不一致。

---

## 10. 下一輪

優先盤點：

1. Inspection／驗收資料是否已存在
2. Project close date 是否實際存在於案場資料
3. Accounting 對 Project status／close date 的 backfill 規則
4. 是否存在 reopen／cancel 流程
5. 現有客戶尾款如何判斷未收
6. 建立 Close Readiness Checklist 草案
