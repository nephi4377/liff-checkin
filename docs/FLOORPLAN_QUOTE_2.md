# FLOORPLAN-QUOTE-2：櫃體匯出 → BudgetWeb 草稿合併

> 分支：`cursor/floorplan-quote-2-11ea`（基底 `#204` / `cursor/floorplan-integrate-1`）  
> 不 merge、不覆蓋 `main` 與 info.tanxin.space 正式版。

## 流程

1. **LayoutPlanner**（`?lpPreview=1`）放置櫃體 → 預算 Modal → **匯出報價明細** → 下載 `layout-quote-draft-*.json`
2. **BudgetWeb**（`?lpPreview=1`）→ Step 0b 選 JSON → **確認合併**（僅追加、同 `id` 略過）→ 人工檢查後再同步雲端（既有行為，需案號）

## 獨立預覽連結（commit 後請改 SHA）

- LayoutPlanner：`/modules/InteriorDesigned/LP_LayoutPlanner?lpPreview=1`
- BudgetWeb：`/tools/BudgetWeb_Standalone.html?lpPreview=1`

jsDelivr 範本：

`https://cdn.jsdelivr.net/gh/nephi4377/liff-checkin@0263a76/modules/InteriorDesigned/LP_LayoutPlanner?lpPreview=1`

`https://cdn.jsdelivr.net/gh/nephi4377/liff-checkin@0263a76/tools/BudgetWeb_Standalone.html?lpPreview=1`

## 計價規則（集中設定）

檔案：`modules/InteriorDesigned/LP_quote_pricing_rules.js`

- 各 `pricingType`（width／depth／area／cai／fixed／number／cm／none）的**單位與數量算法**已定義
- **`unitPrice` 一律 `null`**，列總價留空；規格備註標「單價：待豪哥定價」
- 豪哥填價後：在該檔對應 `PRICING_RULES_BY_TYPE.*.unitPrice` 填入數字即可（仍不寫 Script Properties）

### 待豪哥決定項目（摘要）

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

## 測試

`npm test --prefix modules/InteriorDesigned`（Vitest 97 + Playwright 23）
