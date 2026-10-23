# FLOORPLAN-2D-PRINT-1（LayoutPlanner 平面出圖）

**分支**：`cursor/floorplan-2d-print-1-576d`  
**日期**：2026-10-23

## 既有功能盤點（main／#200／#191／#204／#211 相關）

| 能力 | 狀態 |
|------|------|
| 2D 平面編輯、牆／地板／天花、元件拖放 | 已有 |
| 選取元件上 `寬×深 cm` 小標 | 已有（非鏈式尺寸線） |
| 繪製時牆段即時段長標籤 | 已有（FLOORPLAN-2D-3） |
| `html2canvas` 整張畫布 PNG（ZIP／單張） | 已有，無圖框／比例尺／圖例 |
| 預算 Modal `window.print()` PDF | 已有，僅報價表 |
| 3D 櫃體分色（`LP_3D_CATEGORY_COLORS`） | 已有，本次用於 2D 圖例 |
| BudgetWeb 報價匯出草稿 | 已有，**本次未改** |

## 本次補強

1. **尺寸標註層**（`#lp-2d-dimension-layer`）  
   - 牆段長度（cm）  
   - 櫃體 `W×D×H`（H 沿用 3D 顯示高度規則）  
   - 門／窗：淨寬 + 離最近牆段起點距離（cm）  
   - 工具箱勾選「顯示尺寸標註」；簡單 tier 偏移避讓  
   - 無 `drawnAreas.floor` 時選「房間視線」類需求屬 3D，與本任務無關  

2. **A3／A4 橫式出圖**（`LP_2d_print.js` + `LP_2d_print_render.js`）  
   - 圖框佔位：案號、案名、日期、比例、繪圖者（不預填客戶資料）  
   - 比例尺（100 cm 尺條）、指北／方位佔位、櫃體分色圖例  
   - PNG 下載；`@media print` +「列印／存 PDF」  

3. **測試**  
   - `LP_2d_print.test.js`（Vitest）  
   - `e2e/LP_2d-print.spec.cjs`（標註開關、PNG 尺寸／非空白）  

## 操作方式

1. 開啟 LayoutPlanner，完成平面配置。  
2. 工具箱 **「4. 平面出圖」** → 勾選 **顯示尺寸標註**（可選）。  
3. 點 **A3／A4 平面出圖** 或底列 **📄 平面出圖**。  
4. 選紙張、填圖框佔位 → **下載 PNG** 或 **列印／存 PDF**（瀏覽器「另存 PDF」）。  

## 預覽（獨立連結）

`modules/InteriorDesigned/LP_LayoutPlanner_2d_print_preview.html`  
→ `LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json`

## 風險

- 大畫布（3500²）出圖可能較慢或占記憶體。  
- 門窗「離牆角」為最近牆段投影近似，複雜斜牆需人工核對。  
- 列印 PDF 依瀏覽器列印對話框，邊界可能因瀏覽器而異。
