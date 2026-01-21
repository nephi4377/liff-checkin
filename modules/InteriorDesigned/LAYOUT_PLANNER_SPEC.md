# LayoutPlanner.html - 互動式室內設計規劃工具 規格書

## 📋 文件信息

| 項目 | 內容 |
|------|------|
| **模組名稱** | 互動式室內設計規劃工具 - 專業版 |
| **檔案** | LayoutPlanner.html + LayoutPlanner.js + utils.js |
| **語言** | HTML5 / CSS3 / JavaScript ES6+ |
| **框架** | Vanilla JS + Tailwind CSS |
| **目標受眾** | 室內設計師 / 業主 |
| **部署環境** | 瀏覽器 (支援 Chrome, Firefox, Safari, Edge) |

---

## 🎯 核心功能概述

本工具是一個專業的互動式室內設計規劃系統，主要功能包括：

1. **平面圖編輯** - 匯入、縮放、調整平面圖背景
2. **家具配置** - 從 Google Sheets 動態載入元件，拖曳放置、調整尺寸、旋轉
3. **區域繪製** - 繪製天花板、地板、牆壁區域，用於面積計算
4. **動態計價** - 根據元件尺寸和計價類型自動計算費用
5. **預算管理** - 生成詳細的報價單、匯出 CSV / PDF、下載設計檔案
6. **撤銷重做** - Ctrl+Z / Ctrl+Y 支援最多 50 個歷史狀態
7. **資料保存** - 支援 JSON 佈局存檔、PNG 圖片匯出、ZIP 打包
8. **用戶聯繫** - 整合 LINE 官方帳號聯繫方式
9. **工程標註** - 新增獨立圖層的工程項目標註（如拆除、水電），支援拖曳指示點與計價。

---

## 🏗️ 架構設計

### 系統架構圖

```
┌──────────────────────────────────────────────────────┐
│           LayoutPlanner.html (檢視層)              │
├──────────────────────────────────────────────────────┤
│  • CSS 樣式 (Tailwind + Custom)                     │
│  • HTML 結構 (工具箱、畫布、資訊視窗、Modal)        │
│  • 裝置偵測 (手機端提示)                            │
└────────────────────┬─────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────┐
│       LayoutPlanner.js (邏輯層 + 事件層)            │
├──────────────────────────────────────────────────────┤
│  ✓ 元件管理 (加載、渲染、選取、拖曳)              │
│  ✓ 畫布操作 (背景調整、縮放、平移)                │
│  ✓ 繪圖系統 (區域繪製、頂點編輯)                  │
│  ✓ 計價引擎 (尺寸轉換、價格計算)                  │
│  ✓ 狀態管理 (Undo/Redo、locaStorage)             │
│  ✓ 事件監聽 (滑鼠、鍵盤、拖曳)                    │
└────────────────────┬─────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────┐
│           utils.js (工具函式庫)                     │
├──────────────────────────────────────────────────────┤
│  • showGlobalNotification() - 通知提示             │
│  • loadImageInBatches() - 批量加載圖片              │
│  • 其他輔助函式                                    │
└──────────────────────────────────────────────────────┘
                     │
                     ↓
┌──────────────────────────────────────────────────────┐
│          外部資源 & API                             │
├──────────────────────────────────────────────────────┤
│  📊 Google Sheets (元件庫、配置)                   │
│  📦 CDN Library (Tailwind, html2canvas, jsPDF)     │
│  🖼️ SVG / Image Assets (元件圖示)                 │
│  💾 Browser Storage (LocalStorage)                 │
└──────────────────────────────────────────────────────┘
```

### 模組劃分

| 模組 | 職責 | 關鍵函式 |
|------|------|---------|
| **元件管理** | 載入、分類、渲染元件列表 | `loadFromSheets()`, `renderComponentList()`, `addCabinet()` |
| **平面圖管理** | 背景圖上傳、縮放、平移 | `uploadBackground()`, `updateBgScale()`, `dragBackground()` |
| **繪圖系統** | 多邊形繪製、頂點編輯 | `startDrawing()`, `finishDrawing()`, `dragVertex()` |
| **計價系統** | 尺寸計算、價格計算、預算管理 | `calculatePrice()`, `cmToFeet()`, `updateQuotation()` |
| **狀態管理** | Undo/Redo、LocalStorage 備份 | `saveState()`, `undo()`, `redo()`, `loadLayout()` |
| **UI 互動** | 視窗管理、拖曳、選取反饋 | `selectCabinet()`, `rotateSelected()`, `duplicateCabinet()` |
| **輸出系統** | PDF / CSV 匯出、ZIP 打包 | `savePDF()`, `exportCSV()`, `downloadDesignFiles()` |

---

## 📱 UI 組件清單

### 1. 工具箱視窗 (Toolbox Window)

**HTML ID:** `#toolbox-window`  
**位置:** 左上角 (20px, 20px)  
**尺寸:** 340px 寬

#### 設定頁籤 (Settings Tab)

| 組件 | ID | 功能 | 備註 |
|------|----|----|------|
| 平面圖上傳 | `#bg-upload` | 上傳底圖 | 接受 image/* |
| 底圖調整模式 | `#bg-edit-mode` | 切換底圖編輯 | 配合 `#bg-scale` 調整 |
| 底圖縮放滑桿 | `#bg-scale` | 0.2 ~ 3.0 倍 | 實時更新 |
| 底圖縮放輸入 | `#bg-scale-num` | 數值輸入框 | 同步 `#bg-scale` |
| 新增標註 | `#add-annotation-btn` | 新增工程項目 | 預設拆除工程 |
| 顯示家具 | `#show-cabinets-toggle` | 圖層開關 | 隱藏家具 |
| 顯示標註 | `#show-annotations-toggle` | 圖層開關 | 隱藏標註 |
| 繪製天花板 | `#draw-ceiling-btn` | 區域繪製 | 藍色邊框 |
| 繪製地板 | `#draw-floor-btn` | 區域繪製 | 黃色邊框 |
| 繪製牆壁 | `#draw-wall-btn` | 區域繪製 | 灰色邊框 |
| 牆壁厚度 | `#wall-thickness-input` | 5~50 cm | 預設 15 cm |
| 顯示開關 | 多個 toggle | 控制圖層顯示 | ceiling, floor, walls, lock |
| 另存圖片 | `#save-canvas-as-image-btn` | PNG 匯出 | html2canvas |
| 儲存佈局 | `#save-layout-btn` | JSON 匯出 | 包含所有元件信息 |
| 載入佈局 | `#layout-upload` | JSON 導入 | 恢復先前設計 |

#### 元件頁籤 (Components Tab)

| 組件 | ID | 功能 | 數據源 |
|------|----|----|--------|
| 元件容器 | `#cabinet-components` | 動態元件列表 | Google Sheets |
| 單一元件 | `.placed-cabinet` | 可拖曳的元件卡片 | JSON 序列化 |

---

### 2. 資訊視窗 (Info Window)

**HTML ID:** `#info-window`  
**位置:** 右上角 (20px)  
**尺寸:** 320px 寬

#### 已選取元件資訊

| 組件 | ID | 功能 |
|------|----|----|
| 元件名稱 | `#selected-name` | 顯示選取元件名稱 |
| 旋轉按鈕 | `#selected-rotate-btn` | R 鍵快捷 |
| 複製按鈕 | `#selected-duplicate-btn` | Ctrl+D 快捷 |
| 刪除按鈕 | `#selected-delete-btn` | D 鍵快捷 |
| 透明度滑桿 | `#opacity-slider` | 0~100% |
| 分類群組 | `#selected-group-input` | 自由輸入/選單 | 報價單分類 |
| 寬度輸入 | `#selected-width` | cm 單位 |
| 深度輸入 | `#selected-height` | cm 單位 (深度) |
| 價格顯示 | `#selected-price` | 動態計算 |
| 備註輸入框 | `#note-input` | 自由文字輸入 |

#### 預算統計區塊

| 組件 | ID | 功能 |
|------|----|----|
| 總金額 | `#total-price-display` | 藍色大字 |
| 查看明細 | `#show-budget-modal-btn` | 打開 Modal |
| 施工面積 | `#construction-area` | 輸入 (坪) |
| 天花板費用 | `#ceiling-cost` | 動態計算 |
| 地板費用 | `#floor-cost` | 動態計算 |
| 保護工程費 | `#protection-cost` | 面積 × 單價 |

---

### 3. 畫布區域 (Canvas Area)

**HTML ID:** `#canvas-wrapper`  
**尺寸:** 100vw × 100vh

| 組件 | ID | 功能 |
|------|----|----|
| 工作區標題 | `#canvas-header` | 固定頂部工具列 |
| 設計畫布 | `#design-canvas` | 2000cm × 2000cm |
| 背景圖層 | `#bg-layer` | 平面圖 |
| 網格圖層 | `#grid-layer` | 50cm × 50cm 網格 |
| 繪圖預覽 | `#drawing-preview-layer` | SVG (繪圖中) |
| 繪圖最終 | `#drawn-areas-layer` | SVG (已完成) |
| 標註圖層 | `#annotation-layer` | 標註元件 |
| 浮水印 | `#canvas-watermark` | 淡灰色文字 |
| 元件容器 | `.placed-cabinet` | 動態元件 |

---

### 4. 最小化列 (Minimized Bar)

**HTML ID:** `#minimized-bar`  
**位置:** 右下角 (bottom: 20px, right: 20px)

| 組件 | ID | 功能 |
|------|----|----|
| 縮小按鈕 | `#zoom-out-btn` | Ctrl+滾輪 |
| 縮放等級 | `#zoom-level-display` | 百分比顯示 |
| 放大按鈕 | `#zoom-in-btn` | Ctrl+滾輪 |
| 重置按鈕 | `#zoom-reset-btn` | 回到 100% |
| 工具箱按鈕 | `#toggle-toolbox-btn` | 切換顯示 |
| 預算按鈕 | `#toggle-info-btn` | 切換顯示 |
| 聯繫按鈕 | `#contact-designer-btn` | LINE 官方帳號 |
| 復原按鈕 | `#undo-btn` | Ctrl+Z |
| 重做按鈕 | `#redo-btn` | Ctrl+Y |
| 下載按鈕 | `#download-design-files-btn` | ZIP 打包 |
| 使用說明 | `#help-btn` | Help Modal |

---

### 5. Modal 對話框

#### 預算明細 Modal

**HTML ID:** `#budget-modal`

| 組件 | ID | 功能 |
|------|----|----|
| 關閉按鈕 | `#budget-modal-close-btn` | ✕ |
| 預算表格 | `#budget-table-body` | 動態行 |
| 總計金額 | `#modal-total-price` | 藍色加粗 |
| 匯出 CSV | `#export-csv-btn` | CSV 下載 |
| 儲存 PDF | `#save-pdf-btn` | jsPDF 輸出 |
| LINE 聯繫 | `#modal-contact-line-btn` | 推薦詢價 |
| 下載檔案 | `#modal-download-design-files-btn` | ZIP 打包 |

#### 使用說明 Modal

**HTML ID:** `#help-modal`

| 組件 | 內容 | 功能 |
|------|------|------|
| 步驟 0 | 基礎操作與快捷鍵 | 快速參考 |
| 步驟 1 | 匯入與校正 | 比例尺校正 |
| 步驟 2 | 配置家具 | 拖放操作 |
| 步驟 3 | 繪製區域 | 多邊形繪製 |
| 步驟 3.5 | 施工面積輸入 | 費用計算 |
| 步驟 4 | 輸出與分享 | 檔案導出 |
| FAQ | 常見問題 | 疑難排解 |

#### 手機警告 Modal

**HTML ID:** `#mobile-warning`

- 檢測到行動裝置時顯示
- 提示使用電腦開啟
- LINE 聯繫方式

---

## 🎨 CSS 樣式規範

### 色彩系統

| 用途 | 顏色 | Hex | 說明 |
|------|------|-----|------|
| 選取框 | 藍色 | #3b82f6 | 發光效果 |
| 碰撞警告 | 紅色 | #ef4444 | 深色背景 |
| LINE 官方 | 綠色 | #06C755 | 漸層效果 |
| 背景淺色 | 灰色 | #f3f4f6 | 畫布背景 |
| 文字主色 | 深灰 | #1f2937 | 標準文字 |
| 邊框 | 淺灰 | #e5e7eb | 分隔線 |

### 漸層設計

- **工具箱標題:** `linear-gradient(to right, #f8fafc, #f1f5f9)`
- **LINE 按鈕:** `linear-gradient(135deg, #06C755 0%, #00B900 100%)`
- **聯絡卡片:** `linear-gradient(135deg, #f0fdf4 0%, #f0fffe 100%)`

### 尺寸規範

| 元素 | 寬度 | 高度 | 備註 |
|------|------|------|------|
| 工具箱 | 340px | 70vh max | 可捲動 |
| 資訊視窗 | 320px | 80vh max | 可捲動 |
| 設計畫布 | 2000cm | 2000cm | 固定尺寸 |
| 網格單元 | 50cm × 50cm | - | 視覺參考 |
| 元件卡片 | 自適應 | - | 2 列網格 |
| Modal | 90% | 80vh max | 響應式 |

### Z-Index 層級

| 層級 | 元素 | 值 |
|------|------|-----|
| 最高 | Modal 背景 | 9999 |
| 高 | 浮動視窗 | 100 |
| 中高 | 最小化列 | 90 |
| 中 | 選取元件 | 50 |
| 低 | 元件 | 20 |
| 極低 | 背景圖層 | 1 |

---

## 📊 數據結構

### Cabinet 對象

```javascript
{
  id: "cab-1234567890",              // 唯一識別符
  data: {
    id: "sheets-xyz",
    name: "三人沙發",
    width: 210,                       // cm
    depth: 90,                        // cm
    unitPrice: 12000,                 // NT$
    pricingType: "area",              // fixed | width | depth | area
    adjustable: "both",               // width | depth | both | none
    depthOptions: "75,90,105",        // 可選深度 (cm)
    defaultOpacity: 80,               // 百分比
    allowOverlap: false,              // 是否允許重疊
    note: "預設備註",                // 元件備註
    img: "<svg>...</svg>"             // SVG 或圖片 URL
  },
  x: 100,                             // X 座標 (cm)
  y: 150,                             // Y 座標 (cm)
  rotation: 0,                        // 旋轉角度 (度)
  currentW: 210,                      // 當前寬度 (cm)
  currentH: 90,                       // 當前深度 (cm)
  opacity: 80,                        // 透明度 (%)
  note: "額外備註"                    // 用戶輸入的備註
}
```

### DrawnArea 對象

```javascript
{
  id: "area-1234567890",
  type: "ceiling",                    // ceiling | floor | wall
  points: [                           // 多邊形頂點陣列
    { x: 100, y: 100 },
    { x: 500, y: 100 },
    { x: 500, y: 400 },
    { x: 100, y: 400 }
  ],
  area: 90000,                        // 面積 (cm²)
  areaInPing: 2.5,                    // 面積 (坪)
  fillColor: "rgba(59, 130, 246, 0.2)",
  strokeColor: "rgba(59, 130, 246, 0.8)",
  strokeDasharray: "5,5"              // 虛線樣式
}
```

### Layout JSON 格式

```json
{
  "version": "3.0",
  "timestamp": "2026-01-15T10:30:00Z",
  "settings": {
    "bgScale": 1.0,
    "bgPosition": { "x": 0, "y": 0 },
    "constructionArea": 25,
    "wallThickness": 15
  },
  "cabinets": [
    { "id": "cab-123", "data": {...}, "x": 100, "y": 150, ... }
  ],
  "drawnAreas": [
    { "id": "area-456", "type": "ceiling", "points": [...], ... }
  ],
  "quotation": {
    "totalPrice": 450000,
    "items": [...]
  }
}
```

### 預算項目結構

```javascript
{
  index: 1,
  name: "三人沙發",
  unit: "組",
  quantity: 2,
  totalPrice: 24000,
  note: "客廳",
  cabId: "cab-123"
}
```

---

## ⌨️ 快捷鍵與熱鍵

### 鍵盤快捷鍵

| 快捷鍵 | 功能 | 適用情景 |
|--------|------|---------|
| **R** | 旋轉選取元件 | 元件已選取 |
| **D** | 刪除選取元件 | 元件已選取 |
| **Delete** | 刪除選取元件 | 元件已選取 |
| **Ctrl+Z** | 復原 | 任何時刻 |
| **Ctrl+Y** | 重做 | 任何時刻 |
| **Ctrl+D** | 複製選取元件 | 元件已選取 |
| **↑ ↓ ← →** | 移動選取元件 (5cm) | 元件已選取 |
| **Ctrl+滾輪** | 縮放畫布 | 畫布區域 |
| **Enter** | 完成繪圖 | 繪圖模式中 |
| **Esc** | 取消繪圖 | 繪圖模式中 |

### 滑鼠操作

| 操作 | 功能 |
|------|------|
| 左鍵拖曳元件 | 移動位置 |
| 左鍵拖曳邊框圓點 | 調整尺寸 |
| 左鍵點擊畫布 | 取消選取 |
| 左鍵雙擊元件 | 開始繪圖時，完成繪製 |
| 中鍵 / Spacebar 拖曳 | 平移畫布 |
| 滾輪 | 垂直捲動 |

---

## 🔌 API & 外部資源

### Google Sheets 整合

**API 端點:**
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:json&gid=0
```

**Sheet ID:**
```
1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q
```

**欄位對應 (0-indexed):**

| 欄位 | 索引 | 名稱 | 說明 |
|------|------|------|------|
| A | 0 | name | 元件名稱 |
| B | 1 | width | 寬度 (cm) |
| C | 2 | depth | 深度 (cm) |
| D | 3 | unitPrice | 單價 (NT$) |
| E | 4 | pricingType | fixed \| width \| depth \| area |
| F | 5 | adjustable | width \| depth \| both \| none |
| G | 6 | depthOptions | 可選深度 (逗號分隔) |
| H | 7 | defaultOpacity | 預設透明度 (%) |
| I | 8 | img | SVG 代碼或圖片 URL |
| J | 9 | group | 元件分類 |
| K | 10 | note | 預設備註 |
| M | 12 | allowOverlap | 允許重疊 (TRUE/FALSE) |

**範例行:**
```
三人沙發 | 210 | 90 | 12000 | area | both | 75,90,105 | 80 | <svg>...</svg> | 沙發 | 客廳推薦 | | TRUE
```

### 外部 CDN 庫

| 庫 | 版本 | URL | 用途 |
|----|------|-----|------|
| Tailwind CSS | - | https://cdn.tailwindcss.com | 樣式框架 |
| html2canvas | 1.4.1 | cdnjs | 將 DOM 轉為圖片 |
| jsPDF | 2.5.1 | cdnjs | 生成 PDF |
| JSZip | 3.10.1 | cdnjs | 壓縮 ZIP |
| OpenCV.js | 4.8.0 | docs.opencv.org | 影像處理 (未啟用) |

---

## 🎯 核心邏輯函式說明

### 1. 元件管理相關

#### `loadFromSheets()` 
從 Google Sheets 動態載入元件庫

**參數:** 無  
**回傳:** Promise  
**副作用:** 填充 `cabinetCategories` 全域變數

```javascript
await loadFromSheets();
// 會觸發 renderComponentList()
// 顯示成功/失敗通知
```

#### `addCabinet(data, x, y)`
在指定座標添加元件

**參數:**
- `data` (Object) - 元件數據
- `x` (Number) - X 座標 (cm)
- `y` (Number) - Y 座標 (cm)

**邏輯流程:**
1. 檢查碰撞
2. 若碰撞，顯示錯誤通知，不添加
3. 若通過，添加至 `placedCabinets`
4. 重新渲染所有元件
5. 自動選取新元件
6. 更新預算
7. 保存狀態 (Undo/Redo)

#### `selectCabinet(cabId)`
選取指定元件，更新 UI

**參數:**
- `cabId` (String) - 元件 ID

**副作用:**
- 更新 `selectedCabId`
- 顯示元件資訊視窗
- 更新選取框樣式
- 啟用操作按鈕

#### `calculatePrice(cabinet)`
計算單一元件的價格

**參數:**
- `cabinet` (Object) - Cabinet 物件

**回傳:** Number (NT$)

**邏輯:**
```javascript
// 如果固定價格類型
if (pricingType === 'fixed') return unitPrice;

// 否則根據尺寸計算
widthFeet = cmToFeet(width);
depthFeet = cmToFeet(depth);

switch(pricingType) {
  case 'width': return unitPrice * widthFeet;
  case 'depth': return unitPrice * depthFeet;
  case 'area': return unitPrice * widthFeet * depthFeet;
}
```

#### `cmToFeet(cm)`
公分轉尺 (1尺=30cm)，無條件進位到 0.5 尺

**參數:**
- `cm` (Number) - 公分

**回傳:** Number (尺)

**例子:**
- 30 cm → 1 尺
- 45 cm → 1.5 尺
- 50 cm → 2 尺 (無條件進位)

---

### 2. 繪圖系統相關

#### `startDrawing(type)`
開始繪圖模式

**參數:**
- `type` (String) - "ceiling" | "floor" | "wall"

**副作用:**
- 設定 `isDrawing = true`, `currentDrawingType = type`
- 顯示繪圖遮罩
- 隱藏工具箱和資訊視窗

#### `finishDrawing()`
完成繪圖，轉換為永久區域

**邏輯:**
1. 驗證點數 ≥ 3
2. 計算多邊形面積
3. 建立 DrawnArea 物件
4. 加入 `drawnAreas` 陣列
5. 渲染至 SVG 圖層
6. 清空臨時繪圖數據

#### `dragVertex(areaId, vertexIndex, x, y)`
編輯已繪製區域的頂點

**邏輯:**
1. 找到對應區域
2. 更新頂點座標
3. 重新計算面積
4. 重新渲染

---

### 3. 計價與預算相關

#### `updateQuotation()`
更新整體預算統計

**邏輯:**
1. 遍歷所有 `placedCabinets`
2. 計算每個元件價格
3. 累加總金額
4. 計算施工相關費用 (天花板、地板、保護工程)
5. 更新 UI 顯示

**計費邏輯:**
- **天花板費用** = 繪製天花板面積 × $500/坪
- **地板費用** = 繪製地板面積 × $800/坪
- **保護工程** = 施工面積 (輸入) × $200/坪

#### `generateBudgetTable()`
生成預算表的 HTML 行

**回傳:** 預算項目陣列

**結構:**
```javascript
[
  { index: 1, name: "三人沙發", unit: "組", quantity: 2, totalPrice: 24000, note: "客廳", cabId: "cab-123" },
  { index: 2, name: "天花板", unit: "坪", quantity: 2.5, totalPrice: 1250, note: "平釘", cabId: null },
  ...
]
```

---

### 4. 狀態管理相關

#### `saveState()`
保存當前狀態至歷史堆疊 (Undo/Redo)

**邏輯:**
1. 若歷史索引 < 長度，刪除後續狀態 (新操作前清除 Redo)
2. 序列化當前狀態 (cabinets, drawnAreas, settings)
3. 推入歷史堆疊
4. 若堆疊 > 50，移除最舊狀態
5. 更新 Undo/Redo 按鈕狀態

#### `undo()`
復原至上一個狀態

#### `redo()`
重做至下一個狀態

#### `loadLayout(jsonFile)`
從 JSON 檔案載入整個佈局

**邏輯:**
1. 解析 JSON
2. 驗證版本相容性
3. 恢復 `placedCabinets`, `drawnAreas`, `settings`
4. 重新渲染
5. 顯示成功通知

#### `saveLayoutAsJSON()`
匯出當前佈局為 JSON 檔案

**輸出:**
```json
{
  "version": "3.0",
  "timestamp": "2026-01-15T10:30:00Z",
  "settings": {...},
  "cabinets": [...],
  "drawnAreas": [...],
  "quotation": {...}
}
```

---

### 5. 輸出與分享相關

#### `savePDF()`
使用 jsPDF 生成預算報表 PDF

**邏輯:**
1. 建立 PDF 文件 (A4 橫式)
2. 製表預算明細表
3. 添加免責聲明
4. 下載檔案 (`budget-${timestamp}.pdf`)

#### `exportCSV()`
匯出預算表為 CSV

**格式:**
```
項次,項目,單位,數量,總價,備註
1,三人沙發,組,2,24000,客廳
2,天花板,坪,2.5,1250,平釘
```

#### `downloadDesignFiles()`
打包所有檔案為 ZIP

**包含內容:**
- `design.png` - 設計圖
- `layout.json` - 佈局檔案
- `budget.csv` - 預算表
- `budget.pdf` - 預算報告

**使用:** JSZip 庫

---

### 6. 視覺輸出相關

#### `saveCanvasAsImage()`
將設計畫布導出為 PNG 圖片

**邏輯:**
1. 使用 html2canvas 轉換 DOM
2. 設定背景為白色
3. 下載檔案 (`design-${timestamp}.png`)

#### `drawWatermark()`
在畫布上添加浮水印

**內容:** "添心設計" (淡灰色、旋轉 -45°)

---

## ⚙️ 配置項與常數

### 全域常數

```javascript
// LINE 聯繫
const LINE_ID = '@uis9604v';
const LINE_OFFICIAL_URL = 'https://line.me/R/ti/p/@uis9604v';

// Google Sheets
const SHEET_ID = '1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q';

// 尺度
const CANVAS_WIDTH = 2000;      // cm
const CANVAS_HEIGHT = 2000;     // cm
const GRID_SIZE = 50;           // cm
const CM_TO_FEET = 30;          // 1 尺 = 30 cm

// 歷史管理
const MAX_HISTORY_STATES = 50;  // Undo/Redo 最多記錄

// 費用計算
const CEILING_PRICE = 500;      // 天花板 $500/坪
const FLOOR_PRICE = 800;        // 地板 $800/坪
const PROTECTION_PRICE = 200;   // 保護工程 $200/坪
```

### 用戶可配置項

| 項目 | 儲存位置 | 預設值 | 範圍 |
|------|---------|--------|------|
| 底圖縮放 | `bgScale` | 1.0 | 0.2 ~ 3.0 |
| 牆壁厚度 | `#wall-thickness-input` | 15 | 5 ~ 50 cm |
| 施工面積 | `#construction-area` | 0 | 0 ~ 999 坪 |
| 元件透明度 | `#opacity-slider` | 80 | 0 ~ 100 % |
| 縮放比例 | `viewScale` | 1.0 | 自適應 |

---

## 🔒 安全與效能考量

### 安全考量

1. **XSS 防護**
   - SVG 代碼未經清理直接插入 DOM (風險)
   - 建議使用 DOMPurify 庫進行過濾

2. **檔案上傳**
   - 只接受 image/* 和 .json 格式
   - 無檔案大小限制 (建議限制 < 5MB)

3. **Google Sheets API**
   - 使用公開 Sheet，無需認證
   - 若 Sheet 含敏感資訊，建議改用 OAuth

### 效能最佳化

1. **事件節流**
   - 滑鼠移動、縮放事件應節流處理
   - 建議添加 throttle / debounce

2. **圖片批量載入**
   - 使用 `loadImageInBatches()` 限制並發
   - 預設批次大小 5，延遲 100ms

3. **渲染優化**
   - 使用 `requestAnimationFrame` 平滑動畫
   - SVG 圖層使用 `pointer-events: none` 避免事件捕獲

4. **記憶體管理**
   - 限制歷史堆疊至 50 個狀態
   - 大尺寸圖片應壓縮

---

## 📝 開發與維護指南

### 本地調試

**啟用 DEBUG 模式:**
```javascript
// 在 LayoutPlanner.js 頂部
const DEBUG = true;
```

**查看日誌:**
```javascript
if (DEBUG) console.log('[標籤]', 信息);
```

### 版本管理

**版本格式:** `v{主版本}.{功能版本} - {日期}`

**例:** `v3.0 - 2025-11-24 16:30`

**更新日誌應包含:**
- 新增功能
- 修復 Bug
- 效能改進
- Breaking Changes

### 測試清單

- [ ] 元件動態載入 (Google Sheets)
- [ ] 拖曳 & 調整尺寸
- [ ] 碰撞檢測
- [ ] 旋轉 & 複製 & 刪除
- [ ] 繪圖模式 (天花板、地板、牆壁)
- [ ] 預算計算 (多種計價方式)
- [ ] Undo / Redo (最多 50 步)
- [ ] 儲存 & 載入佈局
- [ ] 導出 PNG / PDF / CSV / ZIP
- [ ] 手機版偵測
- [ ] 快捷鍵 (所有列出的快捷鍵)
- [ ] LINE 聯繫功能
- [ ] 視窗最小化 & 拖曳

### 常見問題排查

| 問題 | 原因 | 解決方案 |
|------|------|---------|
| 元件不顯示 | Sheet 無法載入 | 檢查 SHEET_ID，測試 API 端點 |
| 圖片未加載 | SVG 格式錯誤 | 驗證 SVG 語法，使用 safeScaleSvg |
| 計價不正確 | 尺寸單位混亂 | 確認公分單位，檢查 cmToFeet 邏輯 |
| Undo 不工作 | 歷史堆疊滿 | 檢查 saveState() 是否被調用 |
| 繪圖卡頓 | 點數過多 | 簡化多邊形或優化渲染 |
| 記憶體洩漏 | Event Listener 未清理 | 使用 removeEventListener() |

---

## 📚 檔案結構

```
modules/InteriorDesigned/
├── LayoutPlanner.html          # 主要 UI
├── LayoutPlanner.js            # 核心邏輯 (2660 行)
├── utils.js                    # 工具函式
├── LAYOUT_PLANNER_SPEC.md      # 本規格書
├── IMPROVEMENT_PLAN.md         # 改進方案
├── RENOVATION_CHECKER_PLAN.md  # 施工檢查工具規劃
├── backend_script.js           # Google Apps Script
├── images/                     # 資源圖片
└── BAK/                        # 備份檔案
```

---

## 🔗 相關資源

- **Google Sheets API:** https://developers.google.com/sheets/api
- **Tailwind CSS 文檔:** https://tailwindcss.com/docs
- **jsPDF 文檔:** https://parallax.github.io/jspdf/
- **html2canvas 文檔:** https://html2canvas.hertzen.com/
- **JSZip 文檔:** https://stuk.github.io/jszip/

---

## 👥 聯繫方式

**公司:** 添心設計  
**LINE:** @uis9604v  
**Email:** tanxintainan002@gmail.com

---

**最後更新:** 2026 年 1 月 15 日  
**規格書版本:** 1.0
