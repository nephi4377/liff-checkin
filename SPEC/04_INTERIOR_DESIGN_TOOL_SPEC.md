# 室內設計規劃工具 - 幾何引擎規格書 (LayoutPlanner) (v2.0)

## 1. 核心定位
`LayoutPlanner.js` 是一個超過 3800 行的複雜幾何處理模組，負責處理基於 Canvas 的 2D 空間配置與動態決策。

## 2. 幾何座標與狀態管理

### 2.1 三級座標系統
1. **畫布坐標 (Canvas space)**: 滑鼠事件觸發的直接位置。
2. **世界坐標 (World space)**: 考慮到 `viewScale`（畫布縮放比）後的相對座標。
3. **物理尺寸 (Physical space)**: 透過 `pixelsPerMeter` 轉換為公分/尺的實際單位。
    - **轉換轉換公式**: `1 尺 = 30 cm`；系統自動無條件進位至 **0.5 尺** 進行計價運算。

### 2.2 動態計價邏輯 (`calculatePrice`)
支持多種幾何驅動的計價方式：
- **線性計價 (`width`/`depth`)**: 依據元件長度換算尺數。
- **面積計價 (`area`/`cai`)**: 依據多邊形頂點計算出的坪數/才數。
- **副屬性 (Addons)**: 支持動態加價項目，透過 `addonsConfig` 進行擴展。

## 3. 繪圖與圖層架構 (Layered Rendering)
系統落實「三層渲染」機制以維持高效互動：
1. **Drawn Areas Layer (SVG)**: 處理地板、天花板與牆體的高度填充。具備 `fill-rule: evenodd` 的內孔扣除能力。
2. **Placed Cabinets (DOM)**: 家具物件使用 DOM 元素包覆 SVG，便於利用 CSS3 `transform` 處理旋轉與鏡像。
3. **Drawing Preview/Interaction Layer**: 專責顯示頂點控點 (Vertex Handles) 與選取框。

## 4. 物件操作精確度
- **牆體鎖定 (Wall Lock)**: 分離「繪圖鎖定」與「牆體鎖定」，確保在佈置家具時不會誤觸已定案的結構。
- **SVG 幾何自動校正 (`autoFixSvgGeometry`)**: 自動偵測邊框 (StrokeWidth) 並向內縮進，避免 Canvas 邊緣裁切問題。

---
> [!IMPORTANT]
> 修改渲染循時，務必確保 `viewScale` 全域變數的同步更新，以免發生滑鼠選取偏位問題。
