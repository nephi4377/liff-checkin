# 互動式室內設計規劃工具（LayoutPlanner）規格書

**文件版本**：1.7  
**對應程式**：`modules/InteriorDesigned/LP_LayoutPlanner.html` + `LP_LayoutPlanner.js` + `LP_utils.js`  
**關聯工具**：`LP_LayoutSheetViewer.html`（僅檢視／編輯試算表預覽，不寫回 Sheet）  
**撰寫日期**：2026-04-18（v1.7 修訂）  

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
| **外部依賴** | CDN（Tailwind、html2canvas、JSZip）、公開 Sheet gviz API |
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
- **模組**：`LP_LayoutPlanner.html` 以 `<script type="module" src="./LP_LayoutPlanner.js">` 載入，依賴同目錄之 `LP_utils.js`（`showGlobalNotification`）。
- **行動裝置**：以 **User-Agent 含 `Mobi`** 判斷為行動裝置時，顯示全畫面提示並**中止主程式初始化**（避免小螢幕操作）；另備註：曾修正 iframe 內寬度誤判，改以 UA 為主。

### 3.2 前端技術棧（CDN）

- **Tailwind CSS**（`cdn.tailwindcss.com`）
- **html2canvas**：畫布匯出 PNG、ZIP 內截圖
- **JSZip**：打包 PNG + JSON + CSV
- **已移除**：先前曾載入 **OpenCV.js** 但未於本工具呼叫；已自 `LP_LayoutPlanner.html` 移除以減少體積。若未來要做底圖牆線辨識，宜另開頁或按需載入並寫入規格。

### 3.3 遠端資料來源

- **Google Sheets**：透過 **gviz** 公開 JSON（`tqx=out:json&gid=0`）讀取元件清單。
- **試算表 ID**（寫死於 `LP_LayoutPlanner.js`）：`1y8iD3Pe8AvYxDYFGYVOZ0afsdW10j1GSnDXqUCyEh-Q`  
- **LP_LayoutSheetViewer** 使用相同 ID 與 `gid=0`，僅供預覽／編輯 I 欄文字，**不寫回** Sheet。

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
- **碰撞**：以 SAT（分離軸）類演算法對**旋轉矩形**（OBB）做重疊偵測；**允許重疊**可由 Sheet **M 欄**控制；碰撞時視覺標示 `collision-warning`。拖曳時以 **MTV** 嘗試推開；**邊緣貼齊**（僅接觸）刻意不視為碰撞（見第七節「碰撞幾何」）。
- **手動改寬深**：變更尺寸後以 **`applyCabinetVisualUpdate`** 僅更新單一元件 DOM，避免整批 `renderAllCabinets` 造成右側輸入框失焦（實作細節見程式註解）。
- **圖像來源**：I 欄可為 **內嵌 SVG** 或 **http(s) 圖片 URL**；內嵌 SVG 經 **`sanitizeSvgString`**、`autoFixSvgGeometry`（合併為 **`normalizeSheetSvg`** 於載入）、`processSvgStr` 等處理，以減少惡意標籤、邊界與拉伸問題。

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
- `constructionArea`：字串（設定頁 **`#construction-area`**，備註／匯出用，**不連動計價**）
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

## 七、碰撞偵測（實作摘要）

- **形狀**：每個元件為矩形，經旋轉後以四頂點做 **SAT（分離軸定理）** 與其他元件比對；`overlap` 使用 **嚴格大於 + epsilon**，使**邊對邊貼齊**不計為碰撞。
- **拖曳**：除布林偵測外，以 **MTV** 對被拖物件做最小平移修正，減少穿模；若仍卡住則顯示 `collision-warning`。
- **鏡像（`mirrored`）**：視覺上以 CSS `scaleX(-1)` 呈現；**`getVertices` 已依 `mirrored` 交換局部四角再旋轉**，與 SAT 一致（若日後改 `transform` 順序或 `transform-origin`，需再對照）。
- **拉曳控點縮放**：`handleGlobalMove` 縮放分支在套用新寬高後若 **`checkCollision` 為真**，則**還原為本次縮放起始狀態**（與右側輸入寬深阻擋重疊對齊）；仍可能出現短暫 `collision-warning` 標示。

---

## 八、已處理與待處理項目（對照表）

### 8.1 已反映於程式／手冊者（v1.1 前後）

| 項目 | 說明 |
|------|------|
| **使用手冊** | 步驟 3.5 與「繪製區域坪數」一致；並註明設定頁「施工面積」為選填備註／匯出、不連動計價；步驟 4 為 **PNG**；步驟 2 補充右側寬深輸入。 |
| **OpenCV** | 已自 `LP_LayoutPlanner.html` 移除未使用之腳本。 |
| **手機偵測** | 保留極簡 `DOMContentLoaded` 先顯示遮罩；主邏輯仍在 `LP_LayoutPlanner.js` `onload`。 |
| **改寬深失焦** | 以 `applyCabinetVisualUpdate` 取代整批重繪；熱鍵在表單欄位內略過；全域點擊排除 `#minimized-bar`、`#canvas-header`。 |

### 8.2 近期實作與持續項目（原「待處理」）

| 項目 | 說明 | 建議方向 |
|------|------|----------|
| **`constructionArea`** | 已補 **設定頁** `#construction-area`；佈局 JSON／ZIP／自動備份／復原歷史皆會帶此欄。 | **不實作**與保護工程之自動連動計價（依產品決策）。 |
| **鏡像與碰撞** | `getVertices` 已依 `mirrored` 調整局部四角順序再旋轉，與 SAT 一致。 | 若未來改 `transform` 順序或 `transform-origin`，需再對照幾何。 |
| **縮放控點與碰撞** | 拉邊調整時若 `checkCollision` 為真則 **還原為縮放前尺寸**（與右側輸入寬深邏輯對齊）。 | — |
| **除錯輸出** | 已以 **`DEBUG`**（預設 `false`）+ `dbgLog` 包裝原 `console.log`。 | 開發時將 `DEBUG` 改為 `true` 即可。 |
| **鍵盤復原** | 已綁定 **Ctrl+Z**→`undo`、**Ctrl+Y**／**Ctrl+Shift+Z**→`redo`（表單欄位內不攔截，維持瀏覽器預設）。 | — |

---

## 九、後續改進（僅下列四項）

本專案之**排程範圍**僅限以下四類；其餘（例如：Sheet ID／query、gviz 快取、匯出 hash／基準日、CSP、無障礙、雲端協作、施工面積自動連動計價、牆線碰撞／吸附、模組化分檔等）**不納入排程**。

1. **SVG 消毒**（**已導入**）：`LP_sanitizeSvg.js` 之 `sanitizeSvgString`；Sheet 載入與 `processSvgStr`、佈局 JSON 載入時經 **`normalizeSheetSvg`**（消毒 + `autoFixSvgGeometry`）寫回元件之 `img`。
2. **大量元件效能**（**已部分導入**）：`.placed-cabinet` 使用 **`contain: layout`** 縮小版面連動重算範圍；若仍不足再評估 Canvas／可見區重繪／虛擬化。
3. **單元測試**（**已導入**）：`lib/LP_geometry.js` 匯出 `cmToFeet`、`getAxes`、`project`、`overlap`（主程式改為 import）；**Vitest** 見 `lib/LP_*.test.js`，指令 `npm run test:unit`。
4. **更廣的 Playwright**（**已部分導入**）：除原 3 項外，新增 **`e2e/LP_layout-planner.more.spec.cjs`**（開啟／關閉預算 Modal）；**仍待**：拖元件、下載 ZIP 等（見第十節未涵蓋）。

---

## 十、建議驗收測試清單（摘錄）

- **自動化（可選）**
  - **單元測試**：`npm run test:unit`（Vitest，`lib/LP_geometry.test.js`、`lib/LP_sanitizeSvg.test.js`；設定檔 `LP_vitest.config.cjs`）。
  - **E2E**：`npm run test:e2e`（Playwright；`LP_playwright.config.cjs` 啟動靜態伺服器）。
  - **一鍵**：`npm test`＝`test:unit` + `test:e2e`。
  - **Playwright 涵蓋（共 4 項）**：
    1. **載入**：桌面 User-Agent（非 `Mobi`）下開啟 `LP_LayoutPlanner.html`，`#mobile-warning` 為隱藏、`#toolbox-window` 與 **`#construction-area` 可見**，載入後約 2 秒內無未捕捉之 **`pageerror`**。
    2. **復原**：在 `#construction-area` 輸入文字並觸發 `change` 後，`#undo-btn` 應可復原；焦點離開欄位後按 **Ctrl+Z**，欄位清空且復原鈕回到 **disabled**（與 `saveState`／`loadState` 含施工面積一致）。
    3. **重做**：同上情境後按 **Ctrl+Y**，欄位應回到先前輸入內容。
    4. **預算 Modal**：點「檢視預算」開啟 `#budget-modal`，關閉鈕可關閉。
  - **未涵蓋**（仍依下列手動／後續擴充）：Google Sheet 載入、元件拖曳、旋轉／鏡像／碰撞、繪製區域、ZIP／JSON 匯出、行動裝置遮罩等。
- Sheet 載入失敗時通知與頁面不崩潰。
- 拖入元件、旋轉、縮放、碰撞標示、允許重疊屬性；**鏡像開啟時**碰撞與視覺是否合理。
- 右側**寬深數字**連續修改：選取不應異常消失、焦點合理。
- 天花／地板／牆壁繪製與 Enter／Esc；地板損耗與坪數顯示。
- 預算 Modal 分組、CSV／列印、ZIP 三檔內容正確。
- JSON 儲存再載入：底圖、物件、區域、標註一致。
- 自動備份提示與「還原／略過」流程。
- 行動裝置：僅顯示提示頁。

---

## 十一、文件修訂紀錄

| 版本 | 日期 | 說明 |
|------|------|------|
| 1.0 | 2026-04-18 | 初版：依原始碼盤點功能、資料欄位、風險與路線圖 |
| 1.1 | 2026-04-18 | 同步 OpenCV 移除、手冊與 UX 修正；新增碰撞摘要、待處理表、後續改進滾動清單；章節重編（驗收為第十一節） |
| 1.2 | 2026-04-18 | 施工面積欄位、鏡像頂點、縮放碰撞還原、DEBUG、Ctrl+Z／Y 快捷鍵、自動備份含 `constructionArea`；更新 §8.2 |
| 1.3 | 2026-04-18 | §11 補充 `npm run test:e2e` 之目錄、檔案與三項涵蓋／未涵蓋說明 |
| 1.4 | 2026-04-18 | §7 碰撞摘要與實作對齊（鏡像頂點、縮放碰撞還原）；§9 測試項註記已部分導入 Playwright |
| 1.5 | 2026-04-18 | §9 僅保留 SVG 消毒／大量元件效能／單元測試／擴充 Playwright；刪除原 §10 與其餘路線圖；§5.1／§8.2 施工面積敘述更新；章節重編（驗收為第十節） |
| 1.6 | 2026-04-18 | §9 四項落地：`sanitizeSvg.js`、`normalizeSheetSvg`、`lib/geometry.js`、Vitest、`.placed-cabinet` contain、E2E 預算 Modal；§10 補單元測與 `npm test` |
| 1.7 | 2026-04-18 | LP 專用檔名加 `LP_` 前綴（`LP_LayoutPlanner.html/js`、`LP_utils.js`、`LP_sanitizeSvg.js`、`lib/LP_geometry.js`、測試與設定檔、`LP_LayoutSheetViewer.html`）；`spa/app.js` 路由同步 |
