# FLOORPLAN-QUOTE-2：櫃體匯出 → BudgetWeb 草稿合併

> **基底 PR**：[#204](https://github.com/nephi4377/liff-checkin/pull/204)（`cursor/floorplan-integrate-1`）  
> **本 PR 分支**：`cursor/floorplan-quote-2-11ea`（不 merge、不覆蓋 `main` / info.tanxin.space 正式版）

## 本 PR 在 #204 之上變更的檔案

（不含 #204 已整合的 2D／3D／#186 原型等歷史）

| 檔案 | 說明 |
|------|------|
| `docs/FLOORPLAN_QUOTE_2.md` | 本說明與預覽連結 |
| `modules/InteriorDesigned/LP_quote_pricing_rules.js` | 集中計價規則（待豪哥定價） |
| `modules/InteriorDesigned/LP_quote_pricing_rules.test.js` | 單元測試 |
| `modules/InteriorDesigned/LP_cabinet_quote_lines.js` | 櫃體清單 → 草稿列 |
| `modules/InteriorDesigned/LP_cabinet_quote_lines.test.js` | 單元測試 |
| `modules/InteriorDesigned/LP_budgetweb_import_merge.js` | BudgetWeb 合併（僅追加） |
| `modules/InteriorDesigned/LP_budgetweb_import_merge.test.js` | 單元測試 |
| `modules/InteriorDesigned/LP_preview_hosts.js` | githack 預覽 URL／`?v=` 釘選 |
| `modules/InteriorDesigned/LP_preview_hosts.test.js` | 單元測試 |
| `modules/InteriorDesigned/LP_quotation_budgetweb_export.js` | 支援 `categoryTag` |
| `modules/InteriorDesigned/LP_LayoutPlanner.js` | 櫃體匯出、BudgetWeb 交接連結 |
| `modules/InteriorDesigned/LP_LayoutPlanner.html` | UI、module `?v=` 載入 |
| `modules/InteriorDesigned/LP_vitest.config.cjs` | 新增測試檔 |
| `modules/InteriorDesigned/e2e/LP_layout-planner.spec.cjs` | 地板段長 e2e 重置縮放 |
| `modules/InteriorDesigned/e2e/LP_githack-quote-smoke.spec.cjs` | githack 端到端煙霧測 |
| `tools/BudgetWeb_Standalone.html` | Step 0b 匯入 LP JSON（`lpPreview=1`） |

## 流程

1. **LayoutPlanner**（`?lpPreview=1`）放置櫃體 → 預算 Modal → **匯出報價明細** → 下載 `layout-quote-draft-*.json`（或點「開啟 BudgetWeb 預覽」）
2. **BudgetWeb**（`?lpPreview=1`）→ Step 0b 選 JSON → **確認合併**（僅追加、同 `id` 略過）→ 人工檢查後再同步雲端（既有行為，需案號）

## 獨立預覽（raw.githack.com）

**勿用 jsDelivr 開 `.html`**（常回 `text/plain` + `nosniff`，瀏覽器會顯示原始碼）。  
**路徑須含 `.html`**（無 `.html` 會 404）。

釘選 commit（與 `LP_preview_hosts.js` 的 `PINNED_GITHACK_COMMIT` 同步）：

- LayoutPlanner：  
  https://raw.githack.com/nephi4377/liff-checkin/1a85ec60be828a8c6d3900a90e736498e027269b/modules/InteriorDesigned/LP_LayoutPlanner.html?lpPreview=1
- 含示範 fixture：  
  https://raw.githack.com/nephi4377/liff-checkin/1a85ec60be828a8c6d3900a90e736498e027269b/modules/InteriorDesigned/LP_LayoutPlanner.html?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json
- BudgetWeb：  
  https://raw.githack.com/nephi4377/liff-checkin/1a85ec60be828a8c6d3900a90e736498e027269b/tools/BudgetWeb_Standalone.html?lpPreview=1

主程式載入：`LP_LayoutPlanner.html` 以 `import('./LP_LayoutPlanner.js?v=<commit-prefix>')` 避免 githack 快取舊 JS。  
從 LayoutPlanner 匯出 modal 的「開啟合併頁」會依**目前主機**推算同源 BudgetWeb URL（githack 或本機 `serve`）。

**首次開啟 githack 連結**時，站台可能顯示「One more step」→ 請點 **Open the page**（第三方 HTML 安全閘門，非本 repo 錯誤）。

## 計價規則（集中設定）

檔案：`modules/InteriorDesigned/LP_quote_pricing_rules.js`

- 各 `pricingType` 的**單位與數量算法**已定義；**`unitPrice` 一律 `null`**，列總價留空；規格備註標「單價：待豪哥定價」
- 豪哥填價：在 `PRICING_RULES_BY_TYPE.*.unitPrice` 填入數字（仍不寫 Script Properties）

### 待 Nephi／豪哥決定（計價）

| pricingType | 說明 | 單位 | 單價狀態 |
|-------------|------|------|----------|
| width | 櫃體寬邊（尺） | 尺 | 待豪哥定價 |
| depth | 櫃體深邊（尺） | 尺 | 待豪哥定價 |
| area | 立面才數 | 才 | 待豪哥定價 |
| cai | 試算表才數 | 才 | 待豪哥定價 |
| fixed | 一式 | 式 | 待豪哥定價 |
| number | 按件 | 個 | 待豪哥定價 |
| cm | 公分長度 | cm | 待豪哥定價 |
| none | 不計價 | — | 待豪哥定價 |
| addon | 櫃體副屬性 | 依元件表 | 待豪哥定價 |

程式內完整清單：`listPricingDecisionsForOwner()`（亦寫入匯出 JSON `meta.pendingPricingDecisions`）。

### 待 Nephi 決定（雲端同步）

BudgetWeb「同步至雲端」對 `quotations/{案號}` 使用 Firebase **`set()` 寫入整份 `context`**（含當前畫面上的 `items` 陣列），**不是**逐筆 merge。

| 風險 | 說明 |
|------|------|
| 會不會丟別台加的列？ | **會。** 若 A 裝置先從雲端載入或手動編輯後同步，其 `processedData` 未含 B 裝置稍早同步上去的工項，A 再 `set()` 會以 A 的清單**覆蓋**雲端，B 加的列會消失。 |
| 與本 PR LP 匯入的關係 | 本 PR 僅保護 **BudgetWeb 本機**「匯入 LP 草稿」時**追加**、不刪 Excel 解析列；**不保護**同步雲端時的覆寫。 |

**建議最小防護（本 PR 不實作）**：同步前 `once('value')` 讀取現有 `context.items`，以 `id`（或 `raw_line` fingerprint）做 **union 合併** → 顯示「將新增／將保留／將從雲端移除」diff → **第二次確認**後才 `set()`；若雲端 item 不在本機清單，預設**保留**雲端列除非使用者勾選覆蓋。

## 測試

- `npm test --prefix modules/InteriorDesigned`：Vitest + Playwright（含 `LP_githack-quote-smoke.spec.cjs` 對釘選 githack URL）
- 釘選 SHA 變更後請同步更新 `LP_preview_hosts.js` 與本文件連結
