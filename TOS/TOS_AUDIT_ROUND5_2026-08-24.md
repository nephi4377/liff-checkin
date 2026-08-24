# TOS 系統盤點｜Round 5｜財務閉環

日期：2026-08-24

## 本輪範圍

盤點 `Backend_GAS/accounting-gas` 的客戶收款、追加減、廠商請款、成本分攤與案件毛利之間的資料流，確認是否能以既有 `案號 / project_no` 收斂為 TOS Finance Domain。

## 核心結論

### D-011｜Finance Domain 以 `project_no` 對齊 TOS `project_id`

現有會計模組多數核心 entity 已經用 `project_no` 關聯案件；TOS canonical model 繼續採 `project_id`，Adapter 層將 `project_no` 映射為 `project_id`。

### D-012｜客戶收款與廠商請款不另建第二套帳，統一回寫案件毛利

`CustomerFinanceModule` 的客戶收款在確認後會用 `ingest_id` 寫入案件毛利明細，類型為「收入」，並觸發案件毛利重新彙總。

廠商請款則以 `vendor_payment_request` + `vendor_payment_allocation` 表達請款與多案件分攤，後續進入收支 / 毛利成本。

因此 TOS 財務主線可以定義為：

```text
Customer Receipt -> Income
Vendor Payment Request -> Expense Allocation -> Expense
                              \             /
                               Project Margin
```

### D-013｜既有 `ingest_id` 應保留為財務冪等／追蹤鍵

客戶收款透過 `cfrec:<receipt_id>` 產生 ingest id，寫入前會先檢查是否已存在，避免重複入帳。此設計應保留，未來 TOS Finance Event / Ledger Entry 應明確保留 `source_id` / `ingest_id`。

### D-014｜Accounting Master Schema 可作為 TOS Entity Schema 的參考標準

`ACCOUNTING_ENTITY_DEFS_` 已經把 entity 的 sheet、idField、headers、權限門檻與 spreadsheet source 集中定義。相較其他歷史模組，這套做法最接近可維護的 Domain Schema Registry。

建議未來 TOS 新增 Domain 時優先比照這種結構，而不是散落讀寫欄位。

## 已確認資料結構

### Customer Finance

`ContractAdjustments`
- adjustment_id
- project_no
- item_no / item_name
- quantity / total_price
- type
- status
- customer / company confirmation fields

`CustomerReceipts`
- receipt_id
- project_no
- receipt_no
- stage_label
- received_at
- amount
- method
- status
- ingest_id
- income_review_status

`CustomerFinanceAudit`
- event_id
- entity_type
- entity_id
- project_no
- action
- actor
- occurred_at
- before_status / after_status

`CustomerFinanceTodos`
- todo_id
- type
- project_no
- entity_id
- assignee_role
- status

`ClientPortalAccess`
- binding_id
- project_no
- customer_line_user_id
- status

### Vendor Payment

`vendor_payment_request`
- payment_request_id
- vendor_id / vendor_name
- review_status
- payment_status
- amount
- project_no
- order_no
- store
- txn_date
- ingest_id
- payment / review audit fields

`vendor_payment_allocation`
- allocation_id
- payment_request_id
- project_no
- amount
- item_desc
- sort_order

### Project Margin

`project_margin / 總覽`
- 案號
- 訂編
- 客戶名
- 店別
- 分頁名稱
- 收入合計
- 支出合計
- 毛利
- 最後更新
- 專案狀態
- 結案日

案件明細以每 100 案 shard：`明細_X00全部`，主要欄位：
- 案號
- 日期
- 收支
- 費用類別
- 項目名稱
- 金額
- 來源
- ingest_id
- 備註

## 新風險

### R-008｜`project_no` 與 `project_id` 命名差異仍存在

會計端已高度一致使用 `project_no`，其他模組則使用 `案號`、`ProjectName`、`RelatedProjectID`。

處理：不急著改舊表；TOS Adapter 統一輸出 `project_id`。

### R-009｜財務狀態與專案結案狀態可能存在雙向耦合

毛利總覽已直接保存 `專案狀態` 與 `結案日`，但 Project Master 也有專案生命週期資料。需要下一輪確認哪一邊是 authoritative source，避免結案狀態雙主檔。

### R-010｜財務 Domain 已有 Audit / Todo / Portal Access，但尚未確定是否與全域 Task / Notification 重疊

CustomerFinanceTodos 與 project-console NotificationCenter 的 Task 功能可能存在責任重疊。建議後續盤點時統一到 TOS Task Domain，而不是保留多套待辦模型。

## 財務閉環初版

```text
Project Master (案號)
   │
   ├─ ContractAdjustments
   │    └─ 追加 / 減項
   │
   ├─ CustomerReceipts
   │    └─ 客戶確認
   │         └─ ingest_id
   │              └─ Margin Detail: 收入
   │
   ├─ VendorPaymentRequest
   │    └─ review / approve / paid
   │         └─ VendorPaymentAllocation
   │              └─ project_no
   │                   └─ Margin Detail: 支出
   │
   └─ Project Margin Overview
        ├─ 收入合計
        ├─ 支出合計
        ├─ 毛利
        ├─ 專案狀態
        └─ 結案日
```

## 下一輪

1. 追 `VendorPaymentModule` 寫入收支 / 毛利的精確函式與時點。
2. 追 `CustomerFinanceModule` 收款審核狀態與何時視為正式收入。
3. 確認 `MarginModule` 的 `專案狀態 / 結案日` 是來源還是鏡像。
4. 盤 `LedgerPostIngest`、`LedgerReviewModule`，確認總帳與案件毛利的關係。
5. 確認獎金計算是否已有直接依毛利 / 結案資料讀取的模組。