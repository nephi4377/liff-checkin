# IMPROVEMENT_PLAN

## v8.0 - v8.20 更新重點紀錄 (2025-12-07)

### 1. 全局畫布縮放功能 (Global Canvas Zoom)
- **功能描述**：實作畫布的 Zoom In / Zoom Out 功能，允許使用者放大檢視細節或縮小查看全貌。
- **關鍵修正**：
    - 採用 CSS `transform: scale()` 對 `canvas` 進行無損縮放，確保底圖與所有元件同步縮放。
    - **捲動條修復**：動態計算 `margin`，解決縮放後 Scrollbar 不出現或無法捲動到邊緣的問題。
    - **座標系統重構**：所有滑鼠事件 (拖曳、點擊、繪圖) 的座標計算皆引入 `viewScale` 修正，防止放大時游標與物件位置不同步。

### 2. 繪圖工具修復與優化 (Drawing Tool)
- **鍵盤控制修復**：
    - 將 `keydown` 監聽器移至事件綁定函式的最上層，確保 **Enter (完成)** 和 **Esc (取消)** 鍵在任何情況下都能優先被偵測到。
    - 新增支援數字鍵盤 Enter (`NumpadEnter`)。
- **互動邏輯鎖定**：
    - 在 `startCabDrag` 中加入 `isDrawing` 檢測，**強制**在繪圖模式下禁止選取或拖曳任何櫃體元件，避免誤觸。
- **點擊座標修正**：
    - 修正 `handleDrawingClick`，加入 `viewScale` 除法運算，解決縮放狀態下節點位置偏移的問題。

### 3. 底圖與元件拖曳優化 (Drag & Drop)
- **底圖拖曳**：改為在 `canvas` 層級監聽 `mousedown`，解決底圖縮小後難以點擊選取的問題。
- **元件拖曳保護**：在 `startCabDrag` 加入 `isNaN` 檢查，防止因縮放比例未初始化導致元件座標變為 `NaN` 而消失。
- **元件磁吸貼合 (Magnetic Snap)**：
    - **功能描述**：拖曳元件靠近其他元件時，透過計算分離軸 (MTV, Minimum Translation Vector)，自動將元件「推」至邊緣貼合，防止重疊並輔助對齊。
    - **實作原理**：在 `handleGlobalMove` 中即時計算碰撞修正向量，若發生重疊則強制位移至無重疊的最近位置，形成吸附效果。

### 4. 程式碼結構與穩定性修正
- **語法錯誤修復**：修復因多次編輯導致的函式合併 (`toggleWindow` / `initDraggable`) 與括號遺失 (`bindEventListeners`) 問題。
- **變數宣告清理**：移除重複宣告的 `canvas`, `isDragging` 等變數，消除 TypeScript 警告。


### 5. 元件拉伸改進與文件化 (v9.0)
- **多方向拉伸重構**：
    - **方向性控點**：捨棄舊版單一右下角控點，改為根據 `adjustable` (width/depth/both) 自動生成對應的邊緣控點 (上/下/左/右)。
    - **雙向拉伸邏輯**：
        - 實作「中心位移補償」演算法：當向左或向上拉伸時，自動調整元件 `x`, `y` 座標，使對側邊緣保持固定，符合直覺操作。
        - 支援 `viewScale` 修正：拉伸量自動除以 `safeScale`，確保在縮放狀態下鼠標與控點同步。
    - **視覺優化**：更新 CSS，將控點改為白色圓點藍框樣式，並根據拉伸方向顯示正確的游標 (w-resize, n-resize 等)。

- **程式碼文件化 (Documentation)**：
    - 為核心函式 (`renderCabinet`, `startResize`, `handleGlobalMove` 等) 添加 JSDoc 格式註解，明確定義輸入參數與功能。
    - 加入關鍵動作的 `console.log`，輔助追蹤 Resize 與 Drag 事件。

### 6. 自動儲存與防崩潰機制 (v9.1)
- **LocalStorage 快取**：建立 `saveToLocalCache()`，將目前完整狀態 (元件、繪圖、底圖) 存入瀏覽器快取。
- **定時觸發**：每 60 秒自動執行一次儲存，降低意外關閉導致的損失。
- **意外還原**：在頁面載入時檢查快取，若發現未儲存的進度 (且在 24 小時內)，主動彈出確認視窗詢問使用者是否還原。

### 7. 未來升級藍圖 (Future Roadmap: v10.0+)
以下為建議的十大改進方向，皆以提升「專業度」與「操作效率」為核心：

1.  **多重選取與群組功能 (Multi-select & Grouping)**
    - 允許框選多個元件，或按住 Shift 連選。
    - 建立「群組 (Group)」，移動桌子時椅子一併移動 (如：餐桌組)。
2.  **進階圖層管理 (Advanced Layer System)**
    - 實作類似 CAD/PS 的圖層面板。
    - 可鎖定 (Lock)、隱藏 (Hide) 特定類別 (例如：一鍵隱藏所有水電符號，只看木工)。
3.  **智慧尺寸標註 (Smart Dimensioning)**
    - 選取元件時，自動顯示與最近牆面或鄰近元件的距離。
    - 提供「測距儀」工具，點擊兩點即顯示精確距離。
4.  **材質與紋理貼圖 (Material & Texture Mapping)**
    - 地板與天花板不再只有顏色，可上傳或選擇材質圖片 (如：木紋、大理石、磁磚) 並設定拼接比例。
5.  **DXF/AutoCAD 匯出 (CAD Interoperability)**
    - 將目前的佈局轉換為標準 .dxf 格式，讓設計師能匯入 AutoCAD 進行精修與出圖。
6.  **2.5D 空間預覽 (2.5D Visualization)**
    - 根據元件的「高度」屬性，將平面圖長出簡易的 3D 模型 (Extrusion)，提供空間感的初步檢視。
7.  **施工圖例自動生成 (Construction Symbols)**
    - 內建水電符號庫 (插座、開關、冷氣排水)。
    - 拖曳至牆面自動吸附並轉向。
8.  **雲端專案庫與分享 (Cloud Library & Sharing)**
    - 對接 Firebase/Supabase 資料庫。
    - 產生「唯讀分享連結」，直接傳給業主用手機查看佈局與報價，無需截圖。
9.  **自訂元件繪製器 (Custom Component Builder)**
    - 簡單的向量繪圖工具，讓使用者在工具內直接繪製不規則形狀的家具 (如：L型櫃、異形吧台) 並存入庫。
10. **專業報價單匯出 (Professional PDF Quote)**
    - 將報價資訊排版為正式 PDF。
    - 支援自訂頁首/Logo/條款，直接作為合約附件使用。

---

## 新增與修改的關鍵函式列表 (Key Functions)

### 縮放控制相關
| 函式名稱 | 作用描述 |
| :--- | :--- |
| **`initZoomControls()`** | 初始化縮放按鈕事件，包含放大、縮小、重置及顯示比例。 |
| **`updateViewZoom(newScale)`** | 核心縮放邏輯。設定 Canvas 的 `transform` 並動態調整 `margin` 以確保捲動範圍正確。 |

### 繪圖功能相關
| 函式名稱 | 作用描述 |
| :--- | :--- |
| **`startDrawing(type)`** | 啟動繪圖模式。鎖定元件互動 (`pointerEvents = 'none'`) 並初始化繪圖狀態。 |
| **`handleDrawingClick(e)`** | 處理繪圖點擊。**[修正]** 引入 `viewScale` 計算精確的畫布座標。 |
| **`updateDrawingPreview()`** | 即時繪製預覽線段與閉合區域，提供更好的視覺回饋。 |
| **`finishDrawing()`** | 完成繪圖。計算面積、轉換坪數並儲存區域資料。 |
| **`cancelDrawing()`** | 取消繪圖。清除暫存點與預覽圖層，恢復游標狀態。 |

### 互動與事件處理
| 函式名稱 | 作用描述 |
| :--- | :--- |
| **`bindEventListeners()`** | **[重構]** 集中管理所有事件監聽。將 `keydown` 移至最上方以確保優先權。 |
| **`startCabDrag(e, cab)`** | **[修正]** 加入 `isDrawing` 阻擋邏輯；加入 `viewScale` 座標轉換；加入 `NaN` 防護。 |
| **`handleGlobalMove(e)`** | **[重構]** 整合元件拖曳 (Move) 與多方向縮放 (Resize) 邏輯。實作 MTV 碰撞修正與中心位移補償。 |
| **`startResize(id, e, dir)`** | **[重構]** 新增 `direction` 參數，支援紀錄拉伸方向 ('n', 's', 'w', 'e')。 |
| **`renderCabinet(cab)`** | **[重構]** 根據 `adjustable` 動態生成多個方向的拉伸控點，並綁定對應事件。 |
| **`toggleWindow(windowId)`** | **[修復]** 修復顯示/隱藏視窗的邏輯，與 `initDraggable` 分離。 |
| **`initDraggable(windowId)`** | **[修復]** 獨立的視窗拖曳初始化函式。 |
| **`getMTV(cab1, cab2)`** | **[新增]** 計算最小推移向量 (Minimum Translation Vector)，核心磁吸防撞邏輯。 |
| **`getAxes(vertices)`** | **[新增]** 取得多邊形的投影軸向量 (用於分離軸定理 SAT)。 |
| **`checkCollision(cab, ...)`** | **[優化]** 基於 SAT (Separating Axis Theorem) 的精確碰撞偵測。 |
