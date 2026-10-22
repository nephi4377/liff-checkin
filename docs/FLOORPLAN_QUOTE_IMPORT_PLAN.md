# 平面規劃 → 正式報價／估價單匯入計畫（FLOORPLAN-QUOTE-1）

> **狀態**：草案（2026-10-22）  
> **範圍**：`modules/InteriorDesigned/LP_LayoutPlanner` 物件匯出至既有報價生態；**本階段不寫後端、不寫 Firebase**。

---

## 1. 現況盤點：本 repo 內的報價／估價系統

### 1.1 LayoutPlanner（平面 2D）— 已內建「粗估報價」

| 項目 | 說明 |
|------|------|
| **入口** | `modules/InteriorDesigned/LP_LayoutPlanner.html` |
| **計價引擎** | `LP_LayoutPlanner.js` → `calculateFullQuotation()`、`getQuotationForDisplay()` |
| **資料來源** | Google 試算表元件庫（寬深、單價、`pricingType`、群組、副屬性）；畫布上 `placedCabinets`、`drawnAreas`、`placedAnnotations` |
| **計價型別** | `width`（預設以寬度換 **尺**）、`depth`、`area`／`cai`（才）、`fixed`／`number`、`cm`、`none`；1 尺 = 30 cm、0.5 尺進位（`cmToFeet`） |
| **合併規則** | 櫃體／標註每實例一列；天花／地板依 spatialCluster（≤55cm）可併列；見 `SPEC/04_互動式室內設計規劃工具規格書.md` §3.6 |
| **既有匯出** | 預算 Modal：列印／PDF、**匯出 CSV**（項次／項目／單位／數量／總價／備註）；ZIP 內亦含 CSV |
| **手動覆寫** | `quotationManualOverrides` 隨佈局 JSON 儲存 |

**物件 → 計價列（摘要）**

| 畫布來源 | 主要欄位 | 報價列欄位 |
|----------|----------|------------|
| `placedCabinets[]` | `data.name/group/unitPrice/pricingType/addonsConfig`；`currentW/currentH`；`addons`、`note` | `name`、`group`、`unit`、`quantity`、`totalPrice`、`sizeLabel`（寬×高 cm） |
| `drawnAreas[]`（非 wall） | `areaInPing`、`linkedComponent`、地板損耗 | 坪數、`unit=坪`、單價來自連結元件或預設 |
| `placedAnnotations[]` | `data.name/group/unitPrice`、`customAddons` | 多為「式」或可自訂單價／數量 |

### 1.2 BudgetWeb（Excel 報價解析 → Firebase 草稿）

| 項目 | 說明 |
|------|------|
| **檔案** | `tools/BudgetWeb_Standalone.html`、`tools/budget-quote-parser-lib.js` |
| **Hub** | `#/budget-web`（iframe） |
| **輸入** | 上傳 **781 估價單** 等 Excel；解析為 `items[]`（`type: item`）＋區段 `header` |
| **工項欄位** | `id`、`zone`、`category_tag`、`name`、`spec`、`qty`、`unit`、`price`、`raw_line`、`sheet_source`、驗收用 `completion_percent`／`verification` |
| **雲端寫入** | `quotations/{案號}` → `{ context: finalExport, last_updated, sync_by }`（**正式管線**） |
| **下游** | 開啟 `BudgetAuditor_Standalone_V2.html?projectNo=...` |

規格：`SPEC/12_報價單審核與主控台整合規格書.md`。

### 1.3 BudgetAuditor V2（驗收／進度，非產生報價）

| 項目 | 說明 |
|------|------|
| **檔案** | `tools/BudgetAuditor_Standalone_V2.html` |
| **讀取** | Firebase `quotations/{projectNo}` |
| **寫回** | Firebase 全量 JSON ＋ GAS `action: updateAuditSummary` → 試算表「案場資料」`audit_*` 欄 |

### 1.4 快速報價（清單式，非平面）

| 項目 | 說明 |
|------|------|
| **檔案** | `tools/QuickRenovationQuote_v2.html`、`tools/quick-renovation-quote/*` |
| **邏輯** | 空間坪數 ＋ 勾選工項（尺／坪／式）；單價可對試算表／Firebase RTDB `quickRenovationQuote/settingsV2` |
| **與 LP 關係** | **平行產品**：不讀畫布幾何；語意上窗簾盒等與 `CurtainQuote` 分離（見全域資料字典） |

### 1.5 其他

- `tools/CurtainQuote.html`：窗簾自助估價（布簾），與木作窗簾盒工項分離。  
- `modules/help/budget.html`：說明頁。  
- `tools/BudgetAuditor_Standalone.html`：舊版，以 V2 為準。

---

## 2. Backend_GAS（project-console）— 雲端 Agent 唯讀調查結果

**嘗試**：`git clone https://github.com/nephi4377/Backend_GAS`、 `gh repo view nephi4377/Backend_GAS`  
**結果**：此環境無法存取該 repo（404／無權限）。以下僅依 **本 repo SPEC 與前端呼叫** 整理後端契約，實作前請在 Backend_GAS 內再對照 `backend/project-console/WebApp.js`。

| action／路徑 | 用途 | 前端來源 |
|--------------|------|----------|
| `updateAuditSummary` | 更新案場資料 `audit_items_total`、`audit_percent` 等 | BudgetAuditor V2 POST |
| Firebase `quotations/{案號}` | 工項 JSON 權威（驗收細節層） | BudgetWeb `set()`、Auditor 讀寫 |

**本任務限制**：不新增 GAS action、不部署 clasp、不寫 Script Properties。

---

## 3. 欄位對照：LayoutPlanner → BudgetWeb 工項

| LayoutPlanner（`getQuotationForDisplay`） | BudgetWeb／Auditor `items[]` | 備註 |
|-------------------------------------------|------------------------------|------|
| 分組標題 `isHeader` → `name` | （不匯出為工項；僅決定 `zone`） | 與 Excel 區段標題類似 |
| `group` | `zone`（優先） | 若與 header 不一致，以 **header 區段** 為匯出 zone |
| `name` | `name` | 副屬性列名含 `└` 保留 |
| `quotationDisplaySpecNote()` | `spec` | 已對齊「備註／規格」單欄 |
| `unit` | `unit` | |
| `quantity` | `qty`（字串） | |
| `totalPrice` | `price`（字串、整數元） | BudgetWeb 為**列總價**非單價 |
| — | `category_tag` | 關鍵字推斷（與 BudgetWeb `getCategory` 同規則族） |
| `lineKey` | `id` 前綴 `LP_{lineKey}` | 追溯用；正式案號匯入時可 remap |
| — | `sheet_source` | 固定 `LayoutPlanner` |
| — | `raw_line` | `LayoutPlanner|lineKey|name` |
| `layoutPlanner.sourceType` 等 | （草稿 JSON 內 `layoutPlanner` 擴充） | **不上傳 Firebase 前應 strip**（見原型模組 `sanitizeDraftItemForBudgetWeb`） |

**未自動對應（需 Nephi 決策）**

- **材料／門片／品牌**：試算表欄位未進 LP 報價列 → 需擴充元件 metadata 或僅留在 `spec` 手打。  
- **正式 781 品名**：LP 元件「名稱」≠ 估價單標準品名 → 需 **對照表**（`priceSheetItem` 類似快速報價）。  
- **稅／未稅／建議方案列**：BudgetWeb 解析有 suggest／adjust 區；LP 草稿無此區。  
- **案號／工地名**：BudgetWeb 強制案號；LP 草稿 `案號` 留空。

---

## 4. 方案選項

### 方案 A — 檔案橋接（**建議第一階段**）

1. LP 匯出 **BudgetWeb 相容 JSON 草稿**（＋ CSV 給人類檢查）。  
2. 內勤在 BudgetWeb **補案號**、必要時改品名／單價，再「同步至雲端」。  
3. 驗收仍走 Auditor V2。

**優點**：零後端風險、與現有雙軌儲存一致、可人工審核。  
**缺點**：多一步、無法一鍵綁 `project_id`。

### 方案 B — BudgetWeb「匯入 LP JSON」按鈕

在 `BudgetWeb_Standalone.html` 增加「載入 LayoutPlanner 草稿」，合併進 `processedData.items` 再同步。

**優點**：單一工具完成對照與上雲。  
**缺點**：要改 BudgetWeb UI／合併邏輯；需處理 id 衝突與 suggest 區。

### 方案 C — GAS 新 action `importLayoutQuotation`

LP POST 至 project-console，伺服器寫 Firebase／或產生 Google Sheet 新 tab。

**優點**：可綁案號、權限集中。  
**缺點**：需 Backend_GAS 開發與部署；超出 FLOORPLAN-QUOTE-1 限制。

### 方案 D — 與快速報價合流

將 LP 幾何摘要（尺數、坪數）填入 QuickRenovationQuote 表單。

**優點**：重用 QR 單價表。  
**缺點**：兩套計價規則易不一致；窗簾／全室木作等仍難自動勾選。

### **建議路線**

**A（已完成原型）→ B（小改 BudgetWeb）→ 視需求再評估 C**。  
D 僅作「現場初估」補充，不作平面匯入主線。

---

## 5. 本 PR 原型（方案 A）

| 項目 | 說明 |
|------|------|
| 模組 | `modules/InteriorDesigned/LP_quotation_budgetweb_export.js` |
| UI | 預算 Modal → **匯出報價明細**：預覽表 ＋ 下載 JSON／CSV |
| Schema | `layout-planner-quote-draft-v1` |
| 測試 | `LP_quotation_budgetweb_export.test.js`（Vitest） |

**刻意不做**：Firebase、`案號` 必填、GAS、ZIP 內自動附帶（可下一階段加入佈局 ZIP）。

---

## 6. 僅 Nephi 可決策的問題

1. **權威報價**：對客／對廠以 **781 Excel**、**Firebase quotations** 還是 **LP 粗估** 為準？匯入時是否一律標「草案／待審」？  
2. **單價來源**：LP 試算表單價 vs 快速報價 `priceSheetItem` vs 最新 781 — 衝突時以誰為準？  
3. **品名對照**：是否建立「LP 元件名 → 781 品項」對照表（放試算表新欄或 JSON）？  
4. **計價單位**：櫃體預設 **寬邊尺**；深度計價、才、坪是否要在匯出時強制重算或信任 LP？  
5. **合併列**：天花／地板併列後，正式報價要 **一列** 還是 **拆回各區**？  
6. **案號與 project_id**：Hub 案件是否統一 `project_id`？LP 草稿是否應允許選案（讀主控台列表）？  
7. **材料／門片**：是否在元件庫加「材質／門片」並寫入 `spec` 或獨立欄？  
8. **副屬性**：匯出為獨立工項（現狀）還是合併進主項 `spec`？  
9. **增減／建議方案區**：LP 匯入是否一律進「主工程」區，不進 adjust？  
10. **客戶可見性**：草稿 JSON 是否允許含單價（內部）還是匯出時脫敏？

---

## 7. 風險與相依

| 風險 | 說明 |
|------|------|
| 計價不一致 | LP 與 781 品項／單價不同步 → 需對照表與人工審核 |
| 合併幾何 | spatialCluster 55cm 與現場「一條跑」認知可能不同 |
| 分支衝突 | 2D 分組／鏡像修正於 `cursor/floorplan-2d-audit-5950`；本功能僅觸報價匯出，避開幾何核心 |
| Backend 未驗 | GAS 實際路由需在本機 Backend_GAS 再讀一次 |
| 隱私 | 草稿勿含客戶 PII；案號由人補 |

---

## 8. 驗收與測試

- 單元：`npm test --prefix modules/InteriorDesigned`（含 `LP_quotation_budgetweb_export.test.js`）。  
- 手動：開 LayoutPlanner → 放置元件 → 預算 Modal → **匯出報價明細** → 下載 JSON，於 BudgetWeb 結構比對（不需上雲）。  
- 靜態預覽：commit 後使用 raw.githack 連結（見 PR 說明）。

---

## 9. 參考文件

- `SPEC/04_互動式室內設計規劃工具規格書.md`  
- `SPEC/12_報價單審核與主控台整合規格書.md`  
- `SPEC/14_室內裝修快速報價系統規格書.md`  
- `SPEC/專有名詞白話對照.md`（報價合併列、BudgetWeb／Auditor）
