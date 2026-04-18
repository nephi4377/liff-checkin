# 互動式室內設計規劃工具（LayoutPlanner）規格書

**文件版本**：1.0  
**對應程式**：`modules/InteriorDesigned/LayoutPlanner.html` + `LayoutPlanner.js` + `utils.js`  
**關聯工具**：`LayoutSheetViewer.html`（僅檢視／編輯試算表預覽，不寫回 Sheet）  
**撰寫日期**：2026-04-18  

---

## 一、本文件應涵蓋之內容（SPEC 撰寫檢查清單）

一份完整的 LayoutPlanner 類工具規格書，建議至少包含下列區塊，以利維運、交接與測試對照：

| 區塊 | 說明 |
|------|------|
| **目的與範圍** | 解決什麼問題、不涵蓋什麼（例如：非正式合約報價、非 BIM） |
| **使用者與情境** | 設計師／業主自助、主要操作流程（底圖→擺件→區域→估價→匯出） |
| **功能需求** | 依模組條列可驗收行為（含快捷鍵、錯誤提示） |
| **資料字典** | Google Sheet 欄位、佈局 JSON 結構、版本欄位 |
| **計價規則** | 尺／才／坪換算、預設單價、損耗、合併列規則、總價為 0 是否列出 |
| **外部依賴** | CDN（Tailwind、html2canvas、JSZip、OpenCV）、公開 Sheet gviz API |
| **非功能需求** | 瀏覽器限制、本機伺服器需求（ES module）、效能與儲存上限 |
| **安全與隱私** | 底圖與資料皆在使用者端；localStorage 內容；第三方 URL 圖片 |
| **已知限制與風險** | 見本文第八節 |
| **測試建議** | 關鍵路徑與迴歸項目 |
| **改版與相容** | `version` 欄位、舊版 JSON 載入策略 |

本文以下章節即依上述架構整理**現況實作**（以程式碼為準），並標註與說明文件／註解不一致處。

---

## 二、產品定位與目標使用者

- **定位**：單頁式（SPA 風格）室內平面**互動排版**工具，結合 Google 試算表驅動之**元件庫與單價**，產出**視覺平面圖**與**粗估報價**（含免責聲明）。
- **目標使用者**：需快速在平面底圖上配置櫃体／家具、標註工程項、圈選天花／地板施工區並試算費用之內部或客戶端使用情境。
- **明確非目標**：非專業 CAD／非即時協作編輯、非經正式簽核之工程契約報價。

---

## 三、執行環境與技術架構

### 3.1 執行環境

- **建議**：以本機或網站 **HTTP(S) 伺服器**開啟；**不建議**以 `file://` 直接開啟（ES `import`、部分 API 行為可能異常）。
- **模組**：`LayoutPlanner.html` 以 `<script type="module" src="./LayoutPlanner.js">` 載入，依賴同目錄之 `utils.js`（`showGlobalNotification`）。
- **行動裝置**：以 **User-Agent 含 `Mobi`** 判斷為行動裝置時，顯示全畫面提示並**中止主程式初始化**（避免小螢幕操作）；另備註：曾修正 iframe 內寬度誤判，改以 UA 為主。

### 3.2 前端技術棧（CDN）

- **Tailwind CSS**（`cdn.tailwindcss.com`）
- **html2canvas**：畫布匯出 PNG、ZIP 內截圖
- **JSZip**：打包 PNG + JSON + CSV
- **OpenCV.js**（`docs.opencv.org/4.8.0/opencv.js`）：HTML 註解標示用於「牆壁偵測」等影像處理；**於 `LayoutPlanner.js` 中未檢索到 `cv`／OpenCV API 呼叫**（屬**未使用或預留**之依賴，見第八節）。

### 3.3 遠端資料來源

- **Google Sheets**：透過 **gviz** 公開 JSON（`tqx=out:json&gid=0`）讀取元件清單。
- **試算表 ID**（寫死於 `LayoutPlanner.js`）：`1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q`  
- **LayoutSheetViewer** 使用相同 ID 與 `gid=0`，僅供預覽／編輯 I 欄文字，**不寫回** Sheet。

---

## 四、功能規格（現況行為）

### 4.1 工作區與檢視

- **畫布尺寸**：固定 **2000×2000**（單位與網格對應為 **cm 邏輯空間**；標頭顯示 2000cm×2000cm）。
- **網格**：50px 間距視覺網格（`#grid-layer`）。
- **縮放**：`viewScale`；**Ctrl + 滾輪**、縮放按鈕、重置；縮放套用於 `#design-canvas` 之 transform。
- **捲動**：外層 `#canvas-wrapper` 捲動；載入後會嘗試將視圖捲至畫布中心。

### 4.2 底圖（平面圖）

- **上傳**：本機圖檔 → `data:` URL 顯示於 `#bg-img`。
- **底圖調整模式**：勾選後可調整縮放（slider／數字）；**未勾選時控制區** `opacity-50 pointer-events-none`。
- **比例**：說明文件（使用手冊）建議搭配「比例尺 90CM」元件與門寬比對；屬**操作指引**，非自動校正演算法。

### 4.3 元件庫（櫃体／家具等）

- **載入**：自 Sheet 解析後依 **群組（J 欄）** 分類，渲染於「元件」頁籤。
- **拖放**：由元件庫拖入畫布，建立 `placedCabinets` 項目（位置、旋轉、實際寬深、透明度、備註、才數、鏡像、副屬性數量等）。
- **互動**：點選、拖曳、**四向縮放**（resize handles）、**旋轉（R）**、**鏡像（M）**、**圖層上下**（`[` `]`）、**方向鍵微移**、**刪除（D／Delete）**、**複製（Ctrl+D）**。
- **碰撞**：以 SAT（分離軸）類演算法做 OBB 重疊偵測；**允許重疊**可由 Sheet **M 欄**控制；碰撞時視覺標示 `collision-warning`。
- **圖像來源**：I 欄可為 **內嵌 SVG** 或 **http(s) 圖片 URL**；內嵌 SVG 經 `autoFixSvgGeometry`／`processSvgStr` 等處理以減少邊界與拉伸問題。

### 4.4 區域繪製（天花板／地板／牆壁）

- **模式**：按鈕進入繪圖模式；**點擊**加頂點；**Enter** 完成；**Esc** 取消。
- **天花／地板**：多邊形面積 → 換算 **坪數**（程式以面積除以 **30000** 再 `Math.ceil` 作為 `areaInPing`）。
- **地板損耗**：`calculateFloorAreaWithLoss`：先 ×1.2，再**無條件進位至 0.5 坪**。
- **連結元件**：完成後會連結 Sheet 中名稱為「平釘天花板」「超耐磨木地板」之列（若存在），否則使用程式內建預設單價與副屬性表。
- **牆壁**：至少 3 點；依厚度做路徑偏移（`calculateWallPath`）；**牆壁不列入 `calculateFullQuotation` 計價**（`type === 'wall'` 直接 return）。
- **圖層開關**：可切換顯示天花／地板／牆壁；可**鎖定牆壁／鎖定繪圖**以免誤選。

### 4.5 工程標註

- **新增**：在畫布約中央建立帶**文字方塊**與**指示點**之標註（預設名稱「隱藏門」等）。
- **計價**：標註可走「主項目 + 副屬性」邏輯；`calculateFullQuotation` 中若 `source === 'annotation'` 且 `customAddons[0]` 存在，可用其覆寫主項目單價／數量／單位（見程式內註解）。

### 4.6 預算與報價

- **總價顯示**：右側面板即時顯示（`updateQuotation` → `calculateFullQuotation` 之 `grandTotal`）。
- **明細 Modal**：依**工程分組**插入標題列，再列項目；合併規則為同名／同單價／同備註／同副屬性組合之 key。
- **分組排序**：使用內建 `preferredOrder`（含「保護工程」「拆除工程」…等）；**實際是否出現「保護工程」**取決於 Sheet 或標註資料是否含有該群組之可計價項目。
- **匯出**：**列印／PDF**（透過 `@media print` 針對 `#budget-modal`）、**CSV**、ZIP 內含 CSV。
- **免責聲明**：Modal 內建文字聲明僅供參考。

### 4.7 輸出與檔案

| 動作 | 內容 |
|------|------|
| **另存圖片 (PNG)** | html2canvas 截取 `#design-canvas`，可選顯示浮水印 |
| **儲存佈局 (.json)** | 見第五節資料模型 |
| **載入佈局 (.json)** | 解析後 `loadLayoutFromData` |
| **下載 ZIP** | PNG + JSON + 預算 CSV（UTF-8 BOM） |

### 4.8 復原／重做與自動備份

- **歷史**：`history`／`historyIndex`，最多約 50 步（`MAX_HISTORY_STATES`）。
- **自動儲存**：每 **60 秒** 將狀態寫入 `localStorage`（key：`layoutPlanner_autosave_v1`）；**啟動時**若 24 小時內有備份，以 `confirm` 詢問是否還原。

### 4.9 聯絡與行銷

- **LINE**：官方連結、複製 LINE ID（`utils` 通知）。
- **Email**：介面中標示 **`tanxintainan002@gmail.com`** 作為客戶寄件參考。

---

## 五、資料模型

### 5.1 佈局 JSON（`version: '2.0'`）

主要欄位（實作）：

- `placedCabinets`：陣列
- `drawnAreas`：陣列（含 `type`: `ceiling` | `floor` | `wall`、`points`、`areaInPing`、`linkedComponent`、`addons`…）
- `placedAnnotations`：陣列
- `background`：`position`、`scale`、`src`（常為 `data:image/...`）
- `constructionArea`：字串（見第八節 **DOM 缺失**）
- `timestamp`／`prettyTime`：自動備份用

### 5.2 Google Sheet 欄位對應（`gid=0`，列從第二列起為資料）

| 索引 | 欄位（概念） | 用途 |
|------|----------------|------|
| 0 (A) | 名稱 | 元件名稱 |
| 1 (B) | 寬 | cm |
| 2 (C) | 深 | cm |
| 3 (D) | 單價 | 整數解析 |
| 4 (E) | 計價型別 | `fixed`、`number`、`width`、`depth`、`area`、`cai`、`cm`、`none` 等 |
| 5 (F) | 可調整 | `adjustable` |
| 6 (G) | 深度選項 | 文字 |
| 7 (H) | 預設透明度 | 數值 |
| 8 (I) | 圖示 | SVG 字串或圖片 URL |
| 9 (J) | 群組 | 分類／報價群組 |
| 10 (K) | 預設備註 | |
| 12 (M) | 允許重疊 | 布林（`=== true`） |
| 13–15, 16–18, 19–21 | 副屬性 1～3 | 名稱、單位、單價 |

---

## 六、計價與單位換算（摘要）

- **尺**：`cmToFeet`：1 尺 = 30 cm，並以 **0.5 尺**為最小進位單位（`Math.ceil(rawFeet * 2) / 2`）。
- **才（面積）**：`pricingType === 'area'` 時以寬深換算尺數相乘（見 `calculatePrice`）。
- **單一元件價格**：`calculatePrice` 合併主計價與 Sheet 副屬性、自訂副屬性。
- **全案報價**：`calculateFullQuotation` 合併元件、繪製區域、標註，再合併同質行；**總價為 0 之項目不列入**。

---

## 七、錯誤點、不一致與改進措施

### 7.1 文件／UI 與程式不一致

| 項目 | 說明 | 建議 |
|------|------|------|
| **施工面積（坪）** | 使用手冊與註解提到「施工面積」影響保護工程；`saveLayout`／ZIP 亦讀取 `#construction-area` | 現行 **HTML 無 `id="construction-area"` 元素**，欄位永遠為空字串，相關說明與資料**無法透過 UI 輸入**。應補上輸入框並接入 `calculateFullQuotation`（若商業規則仍需要），或移除／修正文件與死碼。 |
| **另存圖片格式** | 說明寫「JPG」 | 實際為 **PNG**（`toDataURL`／檔名 `design-layout-*.png`）。應統一文案。 |
| **OpenCV.js** | HTML 載入 | **LayoutPlanner 主流程未使用**，徒增下載與初始化成本；若無短期路線圖應移除或改按需載入。 |
| **finishDrawing debug** | `console.log` | 量產可改為開發旗標或移除，避免主控台噪音。 |

### 7.2 架構與維護性

| 項目 | 說明 | 建議 |
|------|------|------|
| **單檔過大** | `LayoutPlanner.js` 極長，職責混合 | 依「資料載入／幾何與碰撞／繪圖／計價／匯出」拆模組，並補單元測試於純函式（如 `calculateFullQuotation`、`cmToFeet`）。 |
| **狀態變數** | 工程標註與元件**共用 `selectedCabId`** | 可運作但易誤讀；建議改名為 `selectedEntityId` 或分開 ID 並集中選取邏輯。 |
| **魔術數字** | 如 `30000`（面積→坪） | 抽成具名常數並註明換算假設（1px=1cm 等）。 |
| **Sheet ID 寫死** | 不利多環境 | 改為設定檔、查詢參數或建置時注入。 |

### 7.3 相容與安全

| 項目 | 說明 | 建議 |
|------|------|------|
| **內嵌 SVG／第三方圖** | 來自 Sheet 的 SVG 字串與 URL | 需認知 **XSS 風險**若 Sheet 可被他人竄改；正式環境應簡化、消毒或僅允許圖片 URL 白名單。 |
| **localStorage 配額** | 底圖 `data:` 可能很大 | 已有 try／catch；可提示使用者改用小圖或改存檔案連結策略。 |

---

## 八、未來發展方向（建議路線圖）

1. **補齊「施工面積／保護工程」閉環**：UI 欄位、計價公式、與 Sheet 列定義一致；並更新本 SPEC 與使用手冊。
2. **釐清 OpenCV**：若要自動牆線辨識，需定義輸入（底圖／筆畫）與輸出（vector path）並實作；否則移除依賴。
3. **協作與帳號**：專案儲存於雲端、版本歷史、權限管理（超出目前純前端本機模型）。
4. **效能**：大量 DOM 元件時考慮 Canvas／WebGL 或虛擬化；html2canvas 可針對匯出解析度做選項。
5. **無障礙與國際化**：鍵盤可操作完整流程、ARIA、文案抽離。
6. **測試**：關鍵計價與合併列、JSON 往返、Sheet 解析錯誤之降級策略。

---

## 九、建議驗收測試清單（摘錄）

- Sheet 載入失敗時通知與頁面不崩潰。
- 拖入元件、旋轉、縮放、碰撞標示、允許重疊屬性。
- 天花／地板／牆壁繪製與 Enter／Esc；地板損耗與坪數顯示。
- 預算 Modal 分組、CSV／列印、ZIP 三檔內容正確。
- JSON 儲存再載入：底圖、物件、區域、標註一致。
- 自動備份提示與「還原／略過」流程。
- 行動裝置：僅顯示提示頁。

---

## 十、文件修訂紀錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2026-04-18 | 初版：依原始碼盤點功能、資料欄位、風險與路線圖 |
