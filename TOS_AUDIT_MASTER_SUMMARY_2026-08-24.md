# TOS 系統盤點｜Master Summary｜2026-08-24

> 本文件整併 `TOS_AUDIT.md` 與 Round 3～12 的盤點結果，並以後續發現修正前期過度簡化的判斷。它不是取代各 Round 原始紀錄，而是作為目前最新的 TOS 架構基準。

---

## 0. 結論先行

添心目前不是「沒有系統」，而是已經有一套相當完整、但跨 Google Sheets、GAS、Firebase、Dropbox、LIFF/Web/Electron 分散成長的營運系統。

目前最正確的策略不是重寫，而是：

1. 固定 canonical identity：`project_id`、`employee_id`。
2. 明確定義每個 Domain 的 Source of Truth。
3. 用 Adapter 保留既有 Sheet / API / UI，不一次改表頭與歷史資料。
4. 將 `project-console` 從大型 integration gateway 逐步整理成清楚的 Domain Services。
5. 補上「正式狀態交易」與「歷史快照」，尤其是 Project Lifecycle / Close / Margin Snapshot / Bonus。
6. 釐清 Firebase quotation 與 Dropbox 正式合約之間的權威關係，完成 Quote → Contract → AR。

目前最大的問題不是施工回報或財務計算能力不足，而是：

```text
Project / Quote / Contract / Lifecycle / Close
```

這幾個核心商業語意尚未完全 canonical 化。

---

# 1. 現有系統總架構

## 1.1 GitHub

主要程式來源：

- `nephi4377/Backend_GAS`
- `nephi4377/liff-checkin`

已確認可存取的其他 repositories：

- `ts-leave-request-system`
- `TAUpdata`
- `diet-ai-secretary`
- `travel-yt`

目前沒有發現另一套獨立的添心 Quote / Contract backend repository。

### Backend_GAS 已確認主要模組

- `CheckinSystem`
- `ProjectSchedule`
- `project-console`
- `accounting-gas`
- `core_library`
- Firebase / Dropbox / LINE / AI 等整合邏輯

### liff-checkin 角色

已不只是單純打卡 LIFF；目前同時承載：

- Web / LIFF 前端
- 系統規格
- Agent / Cursor 規則
- Project Map
- TOS Audit / Decision Log

---

# 2. Source of Truth Matrix

目前最合理的資料權威分工如下。

| Domain / 資料 | 目前主要來源 | TOS 判斷 |
|---|---|---|
| Project Master | CheckinSystem「案場資料」Sheet | Source of Truth |
| Employee Master | CheckinSystem「員工資料」 | Source of Truth |
| Project Schedule | project-console 結構化 schedule + ProjectSchedule 木作格狀排程 | 尚未統一；需 Adapter |
| Project Log / Site Report | ProjectLog / Fast Report 流程 | Source / operational record |
| Task | NotificationCenter + CustomerFinanceTodos 等 | 多套重疊；需統一 Domain |
| Customer Receipt | accounting-gas / CustomerReceipts | Source of Truth |
| Contract Adjustment | accounting-gas / ContractAdjustments | Source of Truth |
| Vendor Payment / Cost | accounting-gas | Source of Truth |
| Current Margin | accounting-gas Margin | Calculated projection |
| Project Lifecycle | Project Master「專案狀態」 | 應是 Source of Truth，但目前不是正式 state machine |
| Close Snapshot | 尚未存在 | 必須新建 |
| Bonus | 尚未確認完整專案獎金引擎 | 必須新建 Domain |
| Quotation Context | Firebase `quotations/{案號}` | 已存在、正在使用；權威性尚待確認 |
| 正式 Contract 文件 | Dropbox | Document Source of Truth |
| 施工照 | Dropbox 案件資料夾 `施工照` + 上傳中繼 | Media Source of Truth |
| 完工行銷媒體 | Dropbox「完工照」類資料夾 | Completion Media |
| 即時通知 | Firebase `notifications/{UID}` | Notification Bus |
| 圖片上傳暫存 | Firebase Storage | Upload Staging |
| 程式 / 架構決策 | GitHub | Source of Truth |

關鍵原則：

```text
Google Sheets = 結構化營運資料
Dropbox       = 正式文件與案件媒體
Firebase      = 即時 / 中繼 / quotation context / 部分鏡像
GitHub        = 程式碼、規格與 Decision Log
```

Firebase 不應被視為 TOS 唯一資料庫。

---

# 3. Identity Mapping

## 3.1 Project Identity

目前跨模組其實大多已用「案號」當 join key，但名稱不一致：

- `案號`
- `project_no`
- `ProjectName`（實際存案號）
- `專案號碼`
- `RelatedProjectID`
- `projectId`

TOS canonical：

```text
project_id = legacy 案號
```

短期不修改所有舊 Sheet header，統一由 Adapter mapping。

### 尚未完成

仍需確認：

- 案號的真正生成入口
- 唯一性約束
- 是否可能重複 / 重用
- 歷史案號格式差異

## 3.2 Employee Identity

CheckinSystem「員工資料」目前是最成熟的 Employee roster。

現有主要外部識別：

- LINE `userId`
- userName
- pcName
- 未來可能還有 device / email / Google identity

已確認 `pcName` 可反查 Employee，再補 `userId` / userName，因此 pcName 是 alias，不是主鍵。

短期：

```text
employee_id = legacy userId
```

長期應增加 immutable internal id：

```text
EmployeeIdentity
employee_id
provider = line | pc | device | google | email
external_id
active
is_primary
```

---

# 4. Project Domain

## 4.1 Project Master

已確認：

`CheckinSystem/SiteLogic.js` 操作 Checkin Spreadsheet 的 `案場資料` Sheet。

案件更新優先以 `案號` 尋找，找不到才 fallback 案場名稱。

目前 Project Master 已包含／涉及：

- 案號
- 案場名稱
- 地址
- 地理位置
- 客戶資料
- 店別 / 區域
- 負責人
- 專案狀態
- 專案起始日
- 預計完工 / 結案資料等

地址變更會重新 geocoding。

更新後已有跨 GAS cache invalidation：

```text
CheckinSystem
 → project-console cache invalidation
 → accounting-gas margin site map invalidation
```

目前屬 eventual consistency；未來可補 sync audit / reconciliation，不必立即導入 message queue。

## 4.2 Project Lifecycle

目前 `專案狀態` 還只是一般可寫欄位，不是真正 State Machine。

`已結案` 最明確的系統效果只是讓 `_getAllSites_()` 不再把該案件列入 active sites。

尚缺：

- transition validation
- permission gate
- close / cancel / reopen command
- lifecycle event audit
- close readiness transaction

建議 canonical lifecycle：

```text
lead
→ design
→ quoted
→ contracted
→ construction
→ inspection
→ closing
→ closed
```

另：

```text
suspended
cancelled
```

正式 `closeProject()` 不能使用 generic `update_site` 直接覆寫狀態。

---

# 5. Schedule / Task Domain

## 5.1 兩套排程模型已確認

### project-console

偏結構化 row：

- 案號
- 預計開始日
- 預計完成日
- 狀態
- Hub 可聚合

### ProjectSchedule

目前是木作／工班產能排程器：

- `待辦任務池`
- `2026木作排程記錄表`
- `System_Holidays`

以「日期 × 人員／排程欄」的格子表示安排，案號直接寫入日期格，再反掃計算實際工日。

### TOS 策略

短期保留現場習慣。

長期：

```text
Task / Schedule row = Source of Truth
木作年度排程表 = View / Planning UI
```

不要讓 spreadsheet cell 永久成為唯一資料庫。

## 5.2 Task 已有雛形，但散在 NotificationCenter

`NotificationCenter` 已包含：

- TaskID
- Sender / Recipient
- Title / Content
- ActionDeadline
- RelatedProjectID
- Status
- Reply / Complete 等 action

因此不是從零做 Task，而是將：

```text
Task = 業務資料
Notification = 配送 / 提醒
```

邏輯拆開。

另外 `CustomerFinanceTodos` 也形成另一套待辦，需要後續收斂到 TOS Task Domain。

---

# 6. Project Log / Construction Reporting

已確認 `ProjectLog.ProjectName` 欄名語意錯置：實際儲存的是 projectId / 案號。

Canonical 應拆：

```text
project_id
project_name
```

開工日目前有兩個來源：

1. `案場資料.專案起始日`
2. 若不存在，從木作／保護／油漆／系統工程第一則已發布 ProjectLog 推導

因此未來應保存：

```text
start_date
start_date_source = manual | first_site_log
```

## Fast Report / 圖片處理

目前圖片流程已有成熟 infrastructure：

- batchId 冪等
- chunk
- UploadQueue
- Script Lock
- retry / exponential backoff
- time-based trigger
- Firebase Storage staging
- 搬運到正式儲存

這一段應保留，不建議重寫。

---

# 7. Finance Domain

accounting-gas 是目前最接近「正式 Domain Schema Registry」的模組之一。

`ACCOUNTING_ENTITY_DEFS_` 已集中描述 entity：

- sheet
- idField
- headers
- permission
- spreadsheet source

這種模式值得成為 TOS 新 Domain 的參考。

## 7.1 Customer Finance

已確認：

### ContractAdjustments

管理追加減：

- project_no
- item
- amount / total_price
- type
- customer / company confirmation
- status

### CustomerReceipts

管理實收事件：

- receipt_id
- project_no
- stage_label
- received_at
- amount
- method
- status
- customer confirmation
- income review
- ingest_id

確認後會寫入 Margin Income。

`cfrec:<receipt_id>` 類 ingest id 已具財務冪等能力，應保留並升格為 TOS lineage 規則。

## 7.2 Vendor / Cost

已存在：

- vendor_payment_request
- vendor_payment_allocation

可表達請款與跨案分攤，再進入 Project Margin 成本。

## 7.3 Current Margin

Margin Overview 可重算：

```text
revenue_total
expense_total
gross_profit = revenue - expense
```

因此目前 Margin 是：

```text
Current Calculated Margin
```

不是正式結案快照。

Finance 裡的 `專案狀態 / 結案日` 應只是 Project lifecycle projection，不是 authoritative source。

---

# 8. Close / Snapshot / Bonus

## 8.1 現有重大風險

案件「已結案」後，財務 line 仍可能因後補成本、退款、晚請款等改變，因此 Current Margin 會漂移。

如果直接用 Current Margin 發歷史獎金，會無法稽核。

## 8.2 正確模型

### Current Margin

永遠反映最新帳務。

### Close Snapshot

正式結案時建立不可覆寫版本：

```text
snapshot_id
project_id
close_date
revenue_at_close
cost_at_close
gross_profit_at_close
gross_margin_rate_at_close
version
created_by
created_at
```

結案後仍可新增 post-close adjustment，但不能改寫舊 snapshot；需要時建立 re-close snapshot v2。

## 8.3 Bonus

目前尚未確認有完整的 Project Bonus Engine。

Payroll 的 bonus_amount 等欄位不能等同案件毛利獎金計算。

因此建議：

```text
Close Snapshot
 → BonusRule Version
 → ProjectBonus
 → ProjectBonusAllocation
 → Payroll 負責實際支付
```

Bonus Domain 負責「為什麼產生、怎麼算、誰分多少」；Payroll 只負責「怎麼支付」。

---

# 9. Close Readiness

第一版應檢查：

### Project

- project_id 有效
- lifecycle 可進 closing
- 實際完工日存在

### Inspection

- blocking items 已完成
- 客戶確認，或主管 override

### Customer Finance

- contract base 已確認
- 追加減已確認 / void
- AR 可計算
- outstanding = 0，或主管 override

### Vendor / Cost

- 無 blocking pending payment request
- 已知成本已入帳
- 未請款成本已 accrued 或 override

### Task

- 無 blocking open task

### Margin

- Current Margin 已重算
- 資料來源可追蹤
- 產生 Close Snapshot

### Approval

- approved_by / approved_at

每項 blocking check 應允許：

```text
passed
failed
approved_override
```

但 override 必須可稽核。

---

# 10. Quotation / Contract / Accounts Receivable

這是目前最需要校正前期結論的區域。

## 10.1 不是「完全沒有 Quotation」

後續已確認 `project-console/SiteReportAcceptance.js` 會讀：

```text
Firebase /quotations/{project_no}
```

其中已有：

- items
- price
- work_type
- category_tag
- completion_percent
- status
- total_summary.overall_completion

程式甚至會：

- 排除 cancelled items
- 加總 price
- 產生 `contract_amount_auto`
- 推導工種 / vendor slots
- 列出未完成驗收工項

所以真正缺口不是「沒有報價」，而是：

1. Firebase quotation 從哪裡產生？
2. 是否有版本？
3. 哪一版是客戶接受版？
4. 是否等同正式簽約內容？
5. `contract_amount_auto` 是否與 Dropbox 正式合約金額一致？

目前不能把 `contract_amount_auto` 直接當 authoritative contract amount。

## 10.2 Contract

GitHub 程式碼裡仍未找到正式的 canonical Contract Master。

正式合約文件由營運實務確認主要存在 Dropbox，因此正確說法是：

> 添心有正式合約文件，但結構化 Contract Master 尚未 canonical 化。

未來 Contract 應保存：

```text
contract_id
project_id
quotation_id / source_id
signed_at
base_contract_amount
payment_terms
status
source_document_ref
```

Legacy 案允許 import，但要保存 migration source。

## 10.3 Accounts Receivable

`CustomerReceipts` 只能回答「收到多少」，不能單獨回答「是否收清」。

Canonical：

```text
receivable_total
= base_contract_amount
+ confirmed additions
- confirmed deductions

outstanding
= receivable_total
- approved receipts
```

AR 應是 derived projection，而不是任意手填總額。

---

# 11. Inspection / Acceptance

前期曾判定「未找到 Inspection Domain」，此結論已修正。

目前系統確實已有驗收相關能力：

`SiteReportAcceptance.js` 可從 Firebase quotation items 讀取：

- completion_percent
- status
- overall_completion
- 未完成工項

因此正確判斷是：

> 已有「驗收 / 工項完成度讀取」，但尚未確認存在完整 canonical 的 Inspection Event / Defect / Customer Acceptance Transaction。

後續仍需找：

- 驗收日期
- 缺失 item
- 缺失責任人
- 改善前後照片
- verified_at
- customer_confirmed_at
- inspection close event

---

# 12. Dropbox / Media / Documents

## 12.1 Dropbox 是案件正式文件與媒體層

正式營運資訊已確認：

- 正式合約與重要文件主要放 Dropbox
- Project Console 也已經真實連接 Dropbox API

## 12.2 施工照是主要預設路徑

`config_.js` 預設：

```text
/添心設計/設計圖/{project}/施工照
```

`DBX_ROOT` 推導為：

```text
/添心設計/設計圖
```

因此「完工照」不是 Dropbox 的主要用途；它只是後來針對 FB / 行銷另做的 Completion Media reader。

### Construction Media

工程紀錄、施工佐證、日誌、保固追溯。

### Completion Media

行銷案例、完工作品照片。

兩者共用 Dropbox transport，但 Domain 語意必須分離。

## 12.3 案號 → Dropbox folder resolver 已存在

`findProjectFolder_(projectCode)`：

- 只在 DBX_ROOT 第一層找
- 去前導 0
- 以案號開頭，後面必須是非數字或結尾

例如 734 可匹配：

- `734 王宅`
- `734-王宅`
- `734_王宅`
- `734`

不會把 `7341` 當成 `734`。

## 12.4 Dropbox primitives 已成熟

已存在：

- OAuth refresh
- token cache
- retry
- metadata
- download
- upload / upload session
- list folder
- list files
- temporary/shared link
- ensure folder
- find project folder

因此 Document Gateway 不應重寫 Dropbox SDK，只需在既有 primitives 上包安全 API。

建議：

```text
list_project_documents(project_id)
search_project_documents(project_id, keyword)
get_project_document_metadata(project_id, path)
fetch_project_document(project_id, path)
```

安全原則：

- 只能讀指定 project folder 底下
- AI 不接觸 Dropbox OAuth token
- read-only
- 大檔限制
- audit log

---

# 13. project-console 的架構定位

`project-console/WebApp.js` 已成為大型 integration gateway，至少混合：

- Project
- Schedule
- Log
- Task / Notification
- LINE
- Facebook
- Accounting bridge
- Material Selection
- AI
- Media
- Customer Portal
- Dropbox

不建議現在拆成多個部署。

先建立程式內 Domain boundary：

```text
ProjectService
LifecycleService
TaskService
EmployeeService
CommunicationService
MediaService
DocumentService
FinanceBridge
MaterialService
```

等 API contract 穩定後再考慮是否物理拆服務。

---

# 14. 技術債 / 風險總表

目前優先風險可整理為：

### P0

1. Project Status generic write：`update_site` 缺正式 lifecycle gate。
2. Closed Project 沒有 immutable Close Snapshot。
3. Quotation / Contract authority 尚未釐清，AR 無可靠 base。
4. Project key 欄名不一致，靠隱含語意 join。
5. LINE UID 仍被當永久 Employee key。

### P1

6. Task / Notification / Finance Todo 多套待辦模型重疊。
7. 木作排程格狀資料與 project-console row schedule 雙模型。
8. project-console Domain 過多，逐漸 monolith。
9. Finance / Project cache sync 只有 eventual consistency，缺 reconciliation audit。
10. Inspection 資訊已存在，但缺正式驗收事件與客戶簽認模型。

### P2

11. `ProjectLog.ProjectName` 欄名語意錯置。
12. start_date 有 manual / derived 雙來源但未明示 source。
13. Firebase 多角色混用，文件上需要明確 namespace / ownership。
14. Dropbox folder resolver 多個命中時用名稱長度排序，未來可能需要 explicit exception mapping。

---

# 15. 應保留、應重構、應新建

## 應保留

- CheckinSystem Employee Master
- CheckinSystem Project Master
- Fast Report / UploadQueue / Lock / Retry
- accounting-gas entity registry
- CustomerReceipts / ContractAdjustments
- Vendor payment / allocation
- Current Margin 計算
- ProjectSchedule 現有排程 UI 習慣
- Dropbox API primitives
- `findProjectFolder_()`
- Firebase notification / upload staging

## 應重構

- generic Project status write → Lifecycle commands
- NotificationCenter → Task + Notification 邏輯分層
- ProjectSchedule spreadsheet cells → Schedule Adapter / row model
- project-console → 清楚 Domain boundary
- Firebase quotation → 明確來源 / version / accepted state
- Finance project status → 明確 projection only

## 應新建

- ProjectLifecycleEvent
- Close Readiness
- ProjectCloseSnapshot
- ProjectBonus / BonusAllocation / BonusRuleVersion
- Contract Master / legacy contract import mapping
- AR projection
- canonical Inspection / Defect / Customer Acceptance transaction（若後續確認現有資料不足）
- Project-scoped read-only Dropbox Document Gateway
- Canonical Schema / Data Dictionary

---

# 16. D-001 ～ D-044 決策總表

## 基礎架構

- D-001：不從零重寫。
- D-002：TOS 採漸進式整併。
- D-003：保留既有案號，建立 canonical `project_id`。
- D-004：木作排程短期保留，長期成為 View。
- D-005：Employee canonical source 沿用 CheckinSystem。
- D-006：Task 與 Notification 邏輯分離。
- D-007：project-console 暫不拆部署，先拆 Domain boundary。
- D-008：Project Master 沿用 CheckinSystem「案場資料」。
- D-009：Identity 短期以 legacy `userId` 為 employee key。
- D-010：跨 GAS 同步先做 reconciliation / audit，不立即 message queue。

## Finance / Close / Bonus

- D-011：Finance `project_no` 映射 TOS `project_id`。
- D-012：Receipt / Vendor Payment 直接銜接既有 Margin，不另建第二套帳。
- D-013：保留 `ingest_id` 作冪等與 lineage key。
- D-014：Accounting Entity Registry 作 TOS schema 設計參考。
- D-015：Project Master 管 lifecycle；Finance 僅 projection。
- D-016：獎金以 Close Snapshot 為歷史依據。
- D-017：Closed 後允許 auditable adjustment，不改寫歷史 snapshot。
- D-018：Project Bonus 獨立 Domain，Payroll 只負責支付。

## Lifecycle / Inspection / AR

- D-019：Project Lifecycle authority 屬 Project Domain。
- D-020：正式 close / reopen / cancel 不得使用 generic `update_site`。
- D-021：正式結案是一個 Business Transaction。
- D-022：Legacy 中文專案狀態由 Adapter 映射 canonical enum。
- D-023：建立 canonical Inspection Domain（後續因 Round 12 修正為「先整合既有驗收能力，再補缺失」）。
- D-024：Receipt 與 AR 分離。
- D-025：Lifecycle Event 採 append-only audit。
- D-026：Accounting Project Status 為 projection。
- D-027：Close Readiness 支援可稽核 override。

## Quote / Contract

- D-028：建立 Contract Domain。
- D-029：Quotation 與 Contract 分離。
- D-030：AR 採 derived model。
- D-031：Close Readiness 使用 AR outstanding。
- D-032：新建 Quote / Contract 前先盤既有 Drive / Sheets / 文件資產。
- D-033：Quotation 必須版本化。
- D-034：Contract 必須有 accepted quotation 或 approved legacy source。
- D-035：Legacy Contract import 必須保留來源。

## Dropbox / Documents / Media

- D-036：Dropbox 透過 GAS Proxy，AI 不拿 OAuth token。
- D-037：Dropbox 為正式 Document Source of Truth。
- D-038：沿用 `findProjectFolder_(project_id)`。
- D-039：建立 project-scoped 唯讀 Document Gateway。
- D-040：Construction Media 與 Completion Media 分開。
- D-041：沿用現有 Dropbox project-folder resolver，例外再 explicit mapping。
- D-042：Document Gateway 建於既有 Dropbox primitives。
- D-043：Quotation 缺口修正：已有 Firebase quotation context，缺 canonical source/version/accepted lock。
- D-044：Inspection 缺口修正：已有工項完成度與未完成項目讀取，缺完整正式驗收 transaction 的確認。

---

# 17. 建議實作優先順序

目前不建議立刻大規模改程式。第一階段應先完成「資料權威與契約」。

## Priority 1｜TOS Canonical Schema + Data Dictionary

先把目前所有核心資料列成：

```text
Canonical Field
Legacy Sheet / Field
Owner Domain
Source of Truth
Read / Write API
Transformation Rule
```

至少涵蓋：

- Project
- Employee
- Schedule
- Task
- ProjectLog
- Quotation
- Contract
- Receipt
- Adjustment
- Vendor Cost
- Margin
- Lifecycle
- Inspection

## Priority 2｜Quote → Contract Authority Verification

追查 Firebase `quotations/{案號}` 的產生端與 version / accepted 規則。

再用 Dropbox 正式合約做交叉驗證：

```text
Firebase quotation total
vs
Dropbox signed contract amount
vs
Accounting receipts / adjustments
```

這一步完成後，AR 才能正式成立。

## Priority 3｜Project Lifecycle Command Layer

建立：

```text
transitionProjectStatus()
closeProject()
reopenProject()
cancelProject()
```

先把敏感狀態從 generic update 分離。

## Priority 4｜Close Snapshot

在不影響現有 Current Margin 的前提下新增 Snapshot。

這是未來結案獎金與歷史報表可靠性的基礎。

## Priority 5｜Document Gateway

沿用現有 Dropbox primitives，新增 project-scoped read-only API，讓 TOS 可以安全取得正式合約與案件文件。

---

# 18. 下一批尚未完成的盤點項目

依目前盤點成熟度，下一批應優先：

1. 追 Firebase `quotations/{案號}` 寫入端，確認 quotation source / version / accepted semantics。
2. 盤 Google Sheets 實際資料字典，尤其 Project Master / Employee / ProjectLog / Schedule / Finance。
3. 找案號生成規則與唯一性約束。
4. 完成 CheckinSystem WebApp API inventory，找出所有 Project / Employee write entry points。
5. 盤 accounting-gas Ledger / Vendor pending / accrued cost，補足 Close Readiness 的 Cost gate。
6. 確認現有 Inspection customer sign-off / defect data 是否其實藏在 Firebase quotation context 或其他 Sheet。
7. 盤 LIFF / Electron 前端 identity flow，完成 employee identity mapping。

---

## 目前 TOS 一句話架構

```text
Project Master（Sheets）
      │
      ├─ Employee / Schedule / Task / Log
      ├─ Firebase Quotation / Acceptance Context
      ├─ Dropbox Contract / Documents / Construction Media
      └─ Accounting Receipt / Cost / Current Margin
                    │
              Close Readiness
                    │
              Close Snapshot
                    │
             Bonus / KPI / BI
```

TOS 的任務不是把這些系統全部換掉，而是讓它們開始講同一種 `project_id / employee_id / lifecycle / finance event` 語言。