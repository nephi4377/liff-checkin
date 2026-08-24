# TOS 系統盤點｜Round 8

日期：2026-08-24
主題：Inspection／尾款／Cancel／Reopen／Accounting Close Sync／Close Readiness

---

## 1. 本輪摘要

本輪針對「正式結案前到底要檢查什麼」進行盤點。

目前確認：

1. Backend_GAS 核心程式中尚未找到獨立、結構化的 Inspection／驗收 Domain。
2. Customer Finance 已能記錄每筆收款、狀態、簽名、客戶確認與收入審核，並將已核准收款寫入案件毛利。
3. 目前尚未確認有 canonical 的「合約應收總額」或「尾款餘額」欄位／entity，因此現況只能可靠知道已收多少，不能單靠 CustomerReceipts 判定是否已全額收清。
4. Project 的「已結案」目前主要是一個案場資料欄位，不是 transaction，也沒有 Reopen／Cancel 狀態轉移機制。
5. Accounting Margin 的「專案狀態／結案日」應視為 projection，不應成為 lifecycle source of truth。

---

## 2. 驗收 Domain 現況

### R8-001｜尚未找到正式 Inspection Entity

以目前 Backend_GAS 已盤到的核心程式，未找到類似以下結構化資料：

- inspection_id
- project_id
- inspection_date
- item
- defect_type
- assignee
- due_date
- status
- photo_refs
- customer_confirmed_at
- completed_at

目前因此無法由系統可靠回答：

- 是否完成驗收
- 是否仍有缺失未改善
- 是否已有客戶確認
- 哪一項缺失卡住結案

### 建議 canonical entity

```text
ProjectInspection
- inspection_id
- project_id
- inspection_type
- inspection_date
- status
- customer_confirmed_at
- created_by
- created_at

InspectionItem
- inspection_item_id
- inspection_id
- project_id
- item_desc
- severity
- assignee_employee_id
- due_date
- status
- before_photo_refs
- after_photo_refs
- completed_at
- verified_at
```

---

## 3. 尾款／應收現況

### R8-002｜已有 Receipt，但缺 canonical Accounts Receivable Base

CustomerFinanceModule 已有：

`CustomerReceipts`

欄位包含：

- receipt_id
- project_no
- receipt_no
- stage_label
- received_at
- amount
- method
- status
- designer_signed_at
- finance_signed_at
- customer confirmations
- ingest_id
- income_review_status

客戶確認＋收入審核後，會寫入 Margin Income。

但目前尚未確認有單一 canonical 欄位或 entity 表示：

- 原合約總額
- 已確認追加減總額
- 最新應收總額
- 已收總額
- 未收餘額
- 尾款是否清償

因此：

```text
已收款 ≠ 已收清
```

### TOS 建議

建立 Project Financial Summary projection：

```text
project_id
contract_amount
confirmed_adjustment_amount
receivable_total
received_total
outstanding_amount
refund_due
receivable_status
```

公式：

```text
receivable_total
= contract_amount + confirmed_adjustment_amount

outstanding_amount
= receivable_total - approved_received_total
```

其中 contract_amount 必須有 authoritative source，不能從 Margin Income 反推。

---

## 4. Cancel / Reopen 現況

### R8-003｜目前未確認有正式 Project Cancel / Reopen transaction

現有 `_manageSite_()` 是 generic upsert，可直接依 payload 寫入與 header 同名欄位。

因此「已取消／已結案／施工中」目前比較接近資料值，而不是具有：

- transition validation
- operator
- timestamp
- reason
- before/after status
- approval

的正式事件。

### 建議

新增：

```text
ProjectLifecycleEvent
- event_id
- project_id
- from_status
- to_status
- reason
- actor_employee_id
- approved_by
- occurred_at
- metadata_json
```

取消：

`cancelProject(project_id, reason)`

重開：

`reopenProject(project_id, reason)`

不可用 generic update_site 直接覆寫狀態。

---

## 5. Accounting Close Sync

### R8-004｜Finance status 應為 projection

Margin Overview 目前已有：

- 專案狀態
- 結案日

但前面已確認 Project Master 位於 CheckinSystem「案場資料」。

因此 TOS 定義：

```text
Project Domain
  = lifecycle source of truth

Finance Margin Overview
  = project status projection / reporting cache
```

結案流程應：

1. Project close transaction 成功
2. 建立 Close Snapshot
3. 更新 Project Master status/closed_at
4. 發送 projection sync
5. Accounting 更新專案狀態／結案日

Accounting 不應反向自行決定 Project 是否結案。

---

## 6. Close Readiness Checklist v0.1

第一版正式結案前檢查建議如下。

### A. Project

- [ ] project_id 有效且唯一
- [ ] 專案狀態允許進入 closing_review
- [ ] 已有實際完工日

### B. Inspection

- [ ] 已建立驗收紀錄
- [ ] 所有 blocking inspection items 已完成
- [ ] 客戶驗收確認完成，或有主管 override reason

### C. Customer Finance

- [ ] contract_amount 已確認
- [ ] 所有追加減已進入 company_confirmed 或 void
- [ ] receivable_total 已計算
- [ ] approved received_total 已計算
- [ ] outstanding_amount = 0，或存在主管核准的 outstanding override

### D. Vendor / Cost

- [ ] 沒有 pending vendor payment request 屬於本案
- [ ] 已知成本均已入帳／分攤
- [ ] 若仍有預估未請款成本，必須列入 accrued cost 或主管 override

### E. Task / Schedule

- [ ] 無 blocking open tasks
- [ ] 無逾期且未關閉的重要施工任務

### F. Margin

- [ ] Current Margin 已完成重算
- [ ] 收入、支出來源均可追蹤
- [ ] 產生 Close Snapshot v1

### G. Approval

- [ ] 指定權限者確認 close readiness
- [ ] 記錄 approved_by / approved_at

完成後：

```text
closing_review
↓
Close Snapshot
↓
closed
↓
Bonus Calculation
```

---

## 7. Override 原則

實務上不能要求所有案子百分之百無例外才能結案。

因此每個 blocking check 應支援：

```text
passed
failed
approved_override
```

override 必須保存：

- reason
- actor
- approved_by
- approved_at

不能只把 checkbox 勾掉。

---

## 8. 新增正式決策

### D-023｜建立 Inspection Domain

驗收與缺失改善需結構化，不再只依賴日誌／LINE／照片判斷。

### D-024｜Receipt 與 Accounts Receivable 分離

`CustomerReceipts` 是實收事件，不等於專案應收主檔。

TOS 必須建立 authoritative contract amount + confirmed adjustments，才能計算 outstanding balance。

### D-025｜Project Lifecycle Event 採 append-only audit

Cancel、Close、Reopen 等敏感 transition 必須留下事件紀錄，不能只覆寫目前狀態。

### D-026｜Accounting Project Status 為 projection

Finance 可顯示專案狀態與結案日，但 authoritative source 屬 Project Domain。

### D-027｜Close Readiness 支援有理由的 override

結案檢查採 blocking check + auditable override，不採僵硬的絕對禁止。

---

## 9. 下一輪

優先盤點：

1. Contract / Quote 是否已有 authoritative contract_amount
2. 追加減 confirmed 金額如何形成 receivable_total
3. Vendor pending payment / accrued cost 是否可查
4. Task blocking 狀態來源
5. 建立第一版 Close Snapshot schema
6. 接 Project Bonus schema
