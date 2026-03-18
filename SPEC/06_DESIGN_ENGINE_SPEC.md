# 06_DESIGN_ENGINE_SPEC.md：2D 空間設計與自動報價系統規格

本文件解構 `modules/InteriorDesigned/LayoutPlanner.js` 的核心架構，該模組提供完整的 2D CAD 編輯能力與即時工程計價邏輯。

## 1. 核心幾何運算引擎 (Core Geometry Engine)

### 1.1 座標系統與視圖縮放
- **畫布模型**: 2000x2000px 座標空間，採用 top-left 座標系。
- **ViewScale 變換**: 透過 `updateViewZoom` 實現視覺縮放，但不改變原始資料座標。所有滑鼠事件（Drag, Click）皆須除以 `viewScale` 以還原真實座標。
- **底圖 (Background) 變換**: 獨立的 `bgScale` 與 `bgPosition`，支援底圖平移縮放以進行「照圖描繪」。

### 1.2 高階碰撞反應 (@core)
採用 **分離軸定理 (Separation Axis Theorem, SAT)** 進行精確碰撞偵測，支援旋轉矩形。
- **MTV 修正**: 透過 `getMTV` (Minimum Translation Vector) 計算最小推離位移，實現物件「硬碰撞」與「自動貼齊」效果。
- **AllowOverlap**: 支援圖元層級的碰撞豁免（如地攤、標註類物件）。

## 2. 工程繪製系統 (Drawing System)

### 2.1 多邊形區域 (Drawn Areas)
- **類別**: 天花板 (Ceiling)、地板 (Floor)。
- **渲染邏輯**: 基於質心 (Centroid) 計算標籤顯示位置，並依據地板損耗規則（+20%, 進位至 0.5 坪）自動計算數量。

### 2.2 牆壁引擎 (Wall Engine)
- **外擴演算法**: 透過 `offsetPolygon` 將路徑點向法向量外擴。
- **路徑組合**: 使用 `evenodd` 填充規則組合內外圈路徑，模擬具厚度的牆體。
- **Ortho Snap**: 支援正交鎖定（Shift/Alt 控制），確保牆線精確垂直。

## 3. 動態計價與報價引擎 (Pricing System)

### 3.1 資料驅動架構
- **Sheets 連動**: 透過 `loadFromSheets` 抓取 Google Sheet 元件定義、SVG 代碼、單價及計價類型。
- **計價算式**:
  - `width`: 寬度、`depth`: 深度、`area`: 面積（尺）、`cai`: 才數、`fixed`: 固定單價。
  - **副屬性 (Addons)**: 支援「預設副屬性」與「自訂副屬性」的累積計價。

### 3.2 報價單生成流程
1. **收集數據**: 遍歷 `placedCabinets`, `drawnAreas`, `placedAnnotations`。
2. **分組對齊**: 根據 `name`, `unitPrice`, `note`, `addons` 進行智慧歸類合併。
3. **分組排序**: 依據預設的工程順序（保護 → 拆除 → ... → 清潔）自動重排。

## 4. 持續性與容錯機制
- **歷史紀錄**: 50 層 Undo/Redo 棧（`saveState`）。
- **自動存檔**: 每 60 秒 LocalStorage 自動備份。
- **封裝匯出**: ZIP 格式一次打包 PNG、佈局 JSON、預算 CSV。
