# TOS 系統盤點｜Round 9（2026-08-24）

## 本輪主題

Quote / Contract / 合約總額 / 應收基準盤點。

## 核心結論

目前在主要兩個 Repository（`nephi4377/Backend_GAS`、`nephi4377/liff-checkin`）中，未找到一個明確、獨立、可作為 authoritative source 的 Quote / Contract backend domain，也未找到穩定的 `contract_amount` / `amount_due` / `receivable_total` 等主欄位。

現有 Customer Finance 已從以下階段開始：

- ContractAdjustments（追加減）
- CustomerReceipts（收款）
- CustomerFinanceAudit
- CustomerFinanceTodos
- ClientPortalAccess

也就是目前資料能力較偏向「合約成立後的追加減與實收管理」，但缺少「原始合約應收基準」。

## 已確認資料能力

### CustomerReceipts

可記錄：

- project_no
- stage_label
- received_at
- amount
- method
- 客戶確認
- 收入審核
- ingest_id

客戶確認且收入審核完成後，可寫入 Project Margin 成為正式收入。

### ContractAdjustments

可記錄：

- project_no
- item_no
- item_name
- quantity
- total_price
- type（追加／減項）
- customer_signed_at
- company_confirmed_at
- status

因此系統已能可靠保存「合約後變更」，但缺少一筆原始 Contract Base Amount 作為 AR 起點。

## 主要缺口

### R-015｜缺少 authoritative Contract Master

目前無法可靠回答：

- 原始簽約金額是多少？
- 哪一版報價成為正式合約？
- 簽約日？
- 合約版本？
- 付款條件／期別？
- 是否有設計費另計？
- 合約是否取消／終止？

### R-016｜Accounts Receivable 無法由 Receipt 單獨推導

只有 CustomerReceipts 可得「已收」，但要知道「未收」還需要：

`原始合約金額 + 已確認追加減 - 已確認收款`

目前第一項缺少 authoritative source。

## TOS 建議模型

### Contract

- contract_id
- project_id
- quotation_id
- contract_version
- signed_at
- base_contract_amount
- design_fee_amount
- status
- payment_terms_json
- effective_from
- cancelled_at
- cancellation_reason
- created_by
- approved_by

### ContractAdjustment

沿用既有 ContractAdjustments，canonical mapping 至：

- adjustment_id
- project_id
- contract_id（新增）
- signed_amount
- status
- customer_confirmed_at
- company_confirmed_at

### AccountsReceivable

AR 不應人工另存總額，而應由 Contract + confirmed adjustments + receipts 推導：

`receivable_total = base_contract_amount + confirmed_adjustments`

`received_total = sum(approved_customer_receipts)`

`outstanding = receivable_total - received_total`

必要時可做快取／projection，但 Contract 與 Receipt 才是 source of truth。

## 決策紀錄

### D-028｜建立 Contract Domain

TOS 必須正式建立 Contract Domain，不能只依賴 CustomerReceipts 與 ContractAdjustments 反推合約。

### D-029｜Quotation 與 Contract 分離

Quotation 是「提案／報價版本」，Contract 是「被客戶接受並生效的商業承諾」。

一個 Project 可有多版 Quotation，但同一時間應只有一份 active Contract（除非後續正式換約）。

### D-030｜AR 採推導模型

Accounts Receivable 以 Contract + Confirmed Adjustments + Approved Receipts 推導，不另建可任意修改的 `應收總額` 手工欄位。

### D-031｜Close Readiness 的尾款條件改用 AR outstanding

正式結案檢查應使用：

`AR.outstanding == 0`

或存在具權限的 `approved_override`。

## 建議下一輪

1. 盤點是否存在外部／歷史報價來源（Sheet、Firebase、前端頁面、舊程式）。
2. 找出現有報價資料是否只是未納入 Backend_GAS。
3. 若仍無 authoritative quote source，設計 TOS Quotation v0.1 schema。
4. 接著銜接 CRM → Quotation → Contract → AR。
