# TOS 系統盤點｜Round 6｜結案、毛利鎖定與獎金前置

日期：2026-08-24

## 本輪目標

追查：

`Ledger → Margin → Project Close → Margin Freeze → Bonus`

確認案件何時視為正式結案、毛利是否會鎖定，以及後續獎金模組應以什麼資料為基礎。

---

## 1. 已確認：案件毛利是動態重算，不是固定快照

`MarginModule.recalcMarginOverviewForProject_()` 會直接掃描案件全部收入／支出明細，重新計算：

- revenue_total
- expense_total
- gross_profit
- updated_at

計算公式：

`gross_profit = revenue - expense`

並直接覆寫總覽的收入、支出、毛利與最後更新時間。

### TOS 判斷

目前的 `project_margin` 應視為 **Current Calculated Margin（即時毛利）**，而不是正式結案後不可變的財務快照。

---

## 2. 已確認：結案狀態在 Margin 是同步／鏡像欄位

Margin 總覽存在：

- `專案狀態`
- `結案日`

但 `handleMarginListOverview_()` 的註解與流程顯示，缺少狀態時會「對案場補一次」，並提供 `backfillMissingOverviewSiteFields_()`。

### TOS 判斷

Margin 的 `專案狀態／結案日` 不應視為 Project Lifecycle 的 authoritative source。

應定義：

- Project Master = lifecycle source of truth
- Margin Overview = financial projection / mirror

### 新決策 D-015

**專案生命週期狀態由 Project Master 管理，Finance 只同步顯示。**

Margin 不自行決定專案是否結案。

---

## 3. 高風險：目前「結案」不等於「毛利鎖定」

`handleMarginAddLine_()`、`handleMarginUpdateLine_()`、`handleMarginDeleteLine_()` 目前均會：

1. 接受案件 project_no
2. 直接異動收入／支出明細（受來源型態限制）
3. 呼叫 `recalcMarginOverviewForProject_()`
4. 改變案件毛利

目前盤到的程式中，這三個操作沒有在異動前檢查：

- project_status 是否 closed
- close_date 是否存在
- margin 是否 frozen

### R-010｜結案後毛利仍可能變動

風險：

案件已結案並依毛利發放獎金後，如果有人新增／修改／刪除支出，毛利會重新計算。

可能造成：

- 結案毛利與歷史獎金不一致
- 月／季／年度報表事後漂移
- 員工獎金已發，但案件後補成本後變成低毛利
- 無法稽核「當時為什麼發這個獎金」

---

## 4. 建議增加 Margin Snapshot / Close Snapshot

不建議把現有即時 Margin 改成鎖死，因為案件結案後仍可能遇到：

- 廠商晚請款
- 保固支出
- 客戶尾款
- 退款
- 追加減帳
- 財務更正

因此建議保留兩層：

### A. Current Margin

持續依最新 Ledger / Margin Lines 計算。

欄位概念：

- project_id
- current_revenue
- current_cost
- current_gross_profit
- current_margin_rate
- updated_at

### B. Close Snapshot

專案正式結案時建立不可覆寫版本：

- snapshot_id
- project_id
- close_date
- revenue_at_close
- cost_at_close
- gross_profit_at_close
- gross_margin_rate_at_close
- created_by
- created_at
- version

### 新決策 D-016

**獎金不得直接以會持續變動的 Current Margin 作為歷史依據。**

獎金應綁定 `close_snapshot_id`。

---

## 5. 結案後財務異動建議

不要完全禁止結案後新增成本，而應採「調整」模式。

建議：

```text
Project Closed
   ↓
Close Snapshot v1
   ↓
Bonus Calculation

之後發生晚到成本
   ↓
Post-close Adjustment
   ↓
Current Margin 改變
   ↓
Close Snapshot v1 不變
   ↓
必要時建立 Re-close Snapshot v2
```

並留下：

- adjustment_id
- project_id
- related_snapshot_id
- type
- amount
- reason
- approved_by
- created_at

### 新決策 D-017

**結案不是禁止財務異動，而是將異動納入可稽核的 post-close adjustment。**

---

## 6. 已確認：Margin 的自動列已有部分保護

目前：

- `source === 自動` 的明細不可直接改金額
- `source === 自動` 的明細不可直接刪除
- 必須回原收支來源修正後重新同步

這是一個好的 data lineage 設計，應保留。

### TOS 建議

延伸成統一規則：

每筆財務 line 都有：

- source_domain
- source_entity_id
- ingest_id
- edit_policy

避免下游直接破壞上游來源資料。

---

## 7. 已確認：案件毛利已具備適合獎金引擎的基本輸入

目前可取得：

- project_no
- revenue_total
- expense_total
- gross_profit
- project_status
- close_date

因此獎金系統不需要重新計算案件收入／成本。

它應在 Close Snapshot 之上處理：

```text
Close Snapshot
   ↓
Gross Margin Rate
   ↓
Bonus Rule Version
   ↓
Bonus Pool
   ↓
Project Participant Allocation
   ↓
70% Closing Payout
   ↓
30% Quarterly Reserve
```

---

## 8. 獎金模組目前盤點結論

在目前已檢查的 `Backend_GAS` 核心 Finance / Project 模組與程式搜尋中，尚未確認存在完整的「專案結案獎金引擎」。

已確認的 `bonus_amount` 類欄位主要屬於 Payroll Request／薪資請款用途，不能直接視為專案毛利獎金系統。

因此目前判斷：

**Project Bonus Domain 仍屬 TOS 待補核心模組。**

> 此結論為目前程式盤點範圍所得；後續仍會繼續檢查其他 Repo／歷史模組，若找到既有實作再修正。

---

## 9. 建議 TOS Bonus Schema

### BonusRule

- rule_id
- version
- effective_from
- effective_to
- min_margin_rate
- max_margin_rate
- bonus_pool_rate
- is_active

### ProjectCloseSnapshot

- snapshot_id
- project_id
- close_date
- revenue
- cost
- gross_profit
- gross_margin_rate
- snapshot_version
- created_by
- created_at

### ProjectBonus

- project_bonus_id
- project_id
- snapshot_id
- rule_id
- gross_profit
- gross_margin_rate
- bonus_pool_rate
- bonus_pool_amount
- closing_portion
- quarterly_portion
- status

### ProjectBonusAllocation

- allocation_id
- project_bonus_id
- employee_id
- role
- allocation_weight
- amount
- status

---

## 10. 新增正式決策

### D-015｜Project Master 管專案生命週期

Finance 的專案狀態與結案日只作同步／查詢用途。

### D-016｜獎金以 Close Snapshot 為依據

不可直接使用會持續重算的 Current Margin 作歷史獎金依據。

### D-017｜結案後允許 Adjustment，但不可改寫歷史

使用 Post-close Adjustment / Re-close Version 機制保留稽核軌跡。

### D-018｜Project Bonus 獨立成 Domain

Payroll 負責「支付」，Bonus Domain 負責「為何產生、怎麼計算、誰可分多少」。

兩者不可混成一張薪資請款表。

---

## 11. 下一輪盤點方向

1. 追查案場資料中的正式 `專案狀態`／`結案日` schema 與更新入口。
2. 確認 Project lifecycle 狀態目前有哪些值與狀態轉移。
3. 追查 Payroll Request 與薪資發放流程，確認未來 Bonus → Payroll 的接點。
4. 搜尋前端／歷史 Repo 是否已有專案獎金、結案或績效實作。
5. 盤點 KPI／績效資料是否已有可重用來源。
