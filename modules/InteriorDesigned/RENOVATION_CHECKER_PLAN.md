# 專案計劃書：裝修工料檢核小幫手 (Renovation Material & Tool Checker) v2.0

**版本更新日期**：2025-12-16 23:39 (Asia/Taipei)  
**狀態**：✅ 已實現核心功能（購物車、材料彙整、工具清單、配方管理、圖片搜尋、後端持久化）  
**下一步**：待優化資安風險 (API 金鑰外洩) 與 UX 改善 (自動測試資料、錯誤處理)

## 1. 專案目標
建立一個輕量級的網頁工具，協助工務、設計師或師傅在進場施工前，針對**多個施工項目**進行混合計算。系統需自動彙整所需材料總量，並產生對應的工具清單（支援合併重複工具），減少「漏帶工具」或「叫料不足/過剩」的狀況。

## 2. 核心功能（目前實現狀況）

### ✅ 已實現功能
1.  **多工項清單 (Shopping Cart Mode)**  
    *   ✅ 使用者可連續加入多個工項，儲存於 `cart.value[]` 陣列  
    *   ✅ 支援刪除已加入工項（`removeTask(index)`）  
    *   ✅ 實現位置：`renovation_checker.html` 第 1946–1957 行 (`addTask()`, `removeTask()`)

2.  **材料自動彙整**  
    *   ✅ 系統於前端記憶體自動計算所有工項的材料總和  
    *   ✅ 依 `mat_id` + `spec` 進行合併，支援損耗率與耗材標記  
    *   ✅ 實現位置：`renovation_checker.html` 第 2065 行 (`calculatedMaterials` computed)

3.  **智慧工具清單**  
    *   ✅ 工具計算與分類（動力/手工）  
    *   ⚠️ **部分實現**：合併邏輯簡化，未完整實現 `alloc_rule` 與多人配置邏輯  
    *   ✅ 實現位置：`renovation_checker.html` 第 2118 行 (`calculatedTools` computed)

4.  **施工/檢測要點彙整**  
    *   ✅ 依據已選工項動態產生 SOP 檢查表  
    *   ✅ 實現位置：`renovation_checker.html` 第 400+ 行 (SOP tab)

5.  **配方管理（CRUD）UI**  
    *   ✅ 新增/修改/刪除材料配方（`addMaterialRecipe()`, `updateMatRecipe()`, `deleteMatRecipe()`）  
    *   ✅ 新增/修改/刪除工具配方（`addToolRecipe()`, `updateToolRecipe()`, `deleteToolRecipe()`）  
    *   ✅ 實現位置：`renovation_checker.html` 第 600–800 行

6.  **圖片搜尋與預覽**  
    *   ✅ 使用 Google Custom Search API 搜尋材料圖片  
    *   ✅ 圖片 Modal 與切換功能（`openImageModal()`, `cycleImage()`）  
    *   ✅ 實現位置：`renovation_checker.html` 第 1000–1100 行

7.  **資料庫讀取**  
    *   ✅ 使用 **GViz JSONP** 方式平行讀取 5 張 Google Sheet  
    *   ✅ 實現位置：`renovation_checker.html` 第 1962+ 行 (`fetchSheet()`)

8.  **配方寫回持久化** ⭐ **v2.0 新增**
    *   ✅ 實現 `saveAllRecipes()` - 完整實作寫回 Google Sheets  
    *   ✅ 調用後端 `callBackend()` 函數，使用 GAS 的 `updateSheet()` 接口  
    *   ✅ 實現位置：`renovation_checker.html` 第 1721 行

9.  **圖片儲存持久化** ⭐ **v2.0 新增**
    *   ✅ 實現 `saveSelectedImage()` - 更新本地資料後呼叫後端寫回  
    *   ✅ 同步將圖片 URL 寫入 Google Sheets `DB_Materials` 表  
    *   ✅ 實現位置：`renovation_checker.html` 第 1897 行

### ⚠️ 待實現/已知限制
1.  **API 金鑰安全風險** 🔴 高優先：`GOOGLE_API_KEY` 與 `GOOGLE_CX` 硬編碼在前端，可被控制台查看；建議移至後端代理  
2.  **匯出功能**：計劃中的「CSV 下載」、「分階段匯出」尚未實現  
3.  **自動測試資料**：onMounted 自動載入測試工項，應改為開發旗標控制  
4.  **錯誤處理貧弱**：若 GViz 載入失敗，整個 app 會卡住；需降級或重試機制  

---

## 3. 問題與風險評估

### 🔴 高優先風險
| 問題 | 影響範圍 | 嚴重程度 | 說明 |
|------|--------|--------|------|
| **API 金鑰外洩** | 圖片搜尋 | 高 | `GOOGLE_API_KEY` 與 `GOOGLE_CX` 硬編碼在前端（renovation_checker.html 第 985–986 行），可被瀏覽器控制台查看；API key 暴露造成配額被濫用與計費風險 |
| **Google Sheet 隱私** | 資料讀取 | 中 | `SHEET_ID` 硬編碼（第 1132 行），要求 Sheet 必須「公開檢視」；雖然已確認使用公開模式，但任何知道 ID 的人都可存取 |
| **GViz JSONP 脆弱性** | 資料載入 | 中 | 使用 `<script>` 插入與 callback 依賴 Google 終端格式；若 Google 改變欄位名稱或終端停用，解析會破壞（`fetchSheet()` 第 1137–1169 行） |
| **配方修改未持久化** | 資料持久化 | 中 | `saveAllRecipes()` (977–982 行) 與 `saveSelectedImage()` (1091–1097 行) 均只為 alert；使用者修改後認為已儲存，實際未寫回 Sheet |

### 🟡 中優先風險
| 問題 | 影響範圍 | 嚴重程度 | 說明 |
|------|--------|--------|------|
| **前端記憶體壓力** | 效能 | 中 | `seedSampleData()` 在 sheet_initializer.js 中產生 200+ 材料、100+ 工具（demo 用），全載入到前端記憶體；大資料集時可能造成延遲或瀏覽器卡頓 |
| **自動載入測試工項** | UX | 低 | onMounted 內自動 `cart.value.push(...)` 以初始化（第 1247–1250 行），會污染正式測試；應改為開發旗標控制 |
| **圖片授權與版權** | 法規 | 中 | Google Custom Search 回傳的圖片來自第三方，直接使用/下載可能有版權問題；未保留作者/來源資訊 |
| **錯誤處理貧弱** | 可靠性 | 低 | 若 GViz 載入失敗或部分表無法讀取，整個 app 會卡住；無降級或重試機制 |

---

## 5. 優先改進方案（高→低）

### 方案 A：API 金鑰安全化與圖片來源改進（高優先）

**目標**：移除前端硬編碼金鑰；改用後端代理呼叫圖片 API（可選用 Pexels/Unsplash 或保留 Google Custom Search）

**受影響檔案與符號**：
- `modules/InteriorDesigned/renovation_checker.html`：`GOOGLE_API_KEY`, `GOOGLE_CX`, `searchImages()`, `imageModal` state
- 新增後端：`modules/InteriorDesigned/image_proxy.gs` (Apps Script) 或自建 Node.js API

**可執行步驟**：

1. **後端設定（Apps Script 範例）**
   - 在 `sheet_initializer.gs` 同目錄新增 `image_proxy.gs`，於頂部定義：
     ```javascript
     const PEXELS_API_KEY = PropertiesService.getScriptProperties().getProperty('PEXELS_API_KEY');
     // 或改用 Unsplash / Google Custom Search API key（存於 Script Properties，非硬編碼）
     ```
   - 實作 `doGet()` 路由：`/search?query=...&limit=10`，呼叫第三方 API 並快取結果（TTL 1hr）
   - 返回 JSON：`{images: [{url, photographer, source}]}`
   - 部署為「Web App（執行身份為『我』，允許任何人匿名存取）」，取得 deployed URL

2. **修改前端 `searchImages()` 與移除硬編碼金鑰**
   - 刪除 `GOOGLE_API_KEY` 與 `GOOGLE_CX` 常數（renovation_checker.html 第 985–986 行）
   - 改 `searchImages()` (1047–1071 行)：
     ```javascript
     const searchImages = async () => {
         imageModal.loading = true;
         const query = `${imageModal.material.name} ${imageModal.material.spec || ''}`.trim();
         const proxyUrl = 'https://script.google.com/macros/d/{DEPLOYED_ID}/usercallback?query=' + encodeURIComponent(query);
         
         try {
             const response = await fetch(proxyUrl);
             const data = await response.json();
             imageModal.imagePool = data.images.map(img => ({
                 url: img.url,
                 photographer: img.photographer,
                 source: img.source
             }));
             imageModal.currentIndex = 0;
             imageModal.currentImage = imageModal.imagePool[0]?.url;
         } catch (err) {
             console.error('[ImageSearch Error]', err);
             alert('圖片搜尋失敗，請稍後重試');
         }
         imageModal.loading = false;
     };
     ```
   - 在 `imageModal` state 中加入 `photographer`, `source` 欄位

3. **修改 `saveSelectedImage()`，保存授權資訊**
   - 改為寫入 `material` 物件的 metadata 欄位：
     ```javascript
     imageModal.material.image_url = imageModal.currentImage;
     imageModal.material.image_photographer = imageModal.images[imageModal.currentIndex]?.photographer;
     imageModal.material.image_source = imageModal.images[imageModal.currentIndex]?.source;
     ```
   - 標記 `recipeManager.hasChanges = true` 以便稍後寫回

4. **選擇圖片來源（延後決定）**
   - 若選 **Pexels**：
     - 申請 API key 於 https://www.pexels.com/api/
     - 免費配額：約 200 req/hr
     - 在 `image_proxy.gs` 內實作：`https://api.pexels.com/v1/search?query=...`
     - 返回欄位映射：`imagePool[].url`, `imagePool[].photographer.name`, `imagePool[].photographer.url`
   - 若選 **Unsplash**：
     - 申請 API key 於 https://unsplash.com/oauth/applications
     - 免費配額：約 50 req/hr（可升級）
     - 實作：`https://api.unsplash.com/search/photos?query=...`
     - 返回欄位映射：`imagePool[].urls.regular`, `imagePool[].user.name`, `imagePool[].user.links.html`
   - 若保留 **Google Custom Search**：
     - 申請計費帳號於 Google Cloud Console
     - 配額：首 100 queries/日免費，超出約 US$5/1000 queries
     - 風險較高，不建議長期使用

5. **測試與部署**
   - 在開發環境測試後端代理 24–48 小時（監控 API 配額使用量）
   - 在前端 console 驗證圖片搜尋與授權資訊是否正確回傳
   - 將代理 URL 記錄於此計劃書備註欄

**估時**：5–10 小時（含後端 WebApp 開發、前端改寫、部署、測試）  
**難度**：中等  
**備註**：延後決定圖片來源，建議先實作方案 B（配方寫回）以確保數據持久化；本方案可並行或稍後進行

---

### 方案 B：實作配方寫回機制（高優先）

**目標**：把 `saveAllRecipes()` 與 `saveSelectedImage()` 改為實際寫回 Google Sheets

**受影響檔案與符號**：
- `modules/InteriorDesigned/renovation_checker.html`：`saveAllRecipes()` (977–982 行), `saveSelectedImage()` (1091–1097 行), `recipeManager.hasChanges`
- 改進 `modules/InteriorDesigned/sheet_initializer.gs`：新增 `doPost()` endpoint

**可執行步驟**：

1. **後端實作 doPost() endpoint**
   - 在 `sheet_initializer.gs` 底部加入：
     ```javascript
     function doPost(e) {
         try {
             const payload = JSON.parse(e.postData.contents);
             const ss = SpreadsheetApp.getActiveSpreadsheet();
             
             // 驗證簡單 token（防止任意寫入，可選）
             if (payload.token !== 'YOUR_SECRET_TOKEN') {
                 return ContentService.createTextOutput(JSON.stringify({error: 'Unauthorized'})).setMimeType(ContentService.MimeType.JSON);
             }
             
             // 寫入 Map_Task_Materials
             if (payload.mapExMaterials && payload.mapExMaterials.length > 0) {
                 const matSheet = ss.getSheetByName('Map_Task_Materials');
                 matSheet.clearContents(); // 清空舊資料
                 const headers = ['task_id', 'mat_id', 'spec', 'qty_per_unit', 'loss_rate', 'is_consumable', 'tool_target'];
                 matSheet.appendRow(headers);
                 payload.mapExMaterials.forEach(row => {
                     matSheet.appendRow([row.task_id, row.mat_id, row.spec, row.qty_per_unit, row.loss_rate, row.is_consumable, row.tool_target]);
                 });
             }
             
             // 寫入 Map_Task_Tools
             if (payload.mapExTools && payload.mapExTools.length > 0) {
                 const toolSheet = ss.getSheetByName('Map_Task_Tools');
                 toolSheet.clearContents(); // 清空舊資料
                 const headers = ['task_id', 'tool_id', 'type', 'qty_avg', 'calc_method'];
                 toolSheet.appendRow(headers);
                 payload.mapExTools.forEach(row => {
                     toolSheet.appendRow([row.task_id, row.tool_id, row.type, row.qty_avg, row.calc_method]);
                 });
             }
             
             return ContentService.createTextOutput(JSON.stringify({success: true})).setMimeType(ContentService.MimeType.JSON);
         } catch (err) {
             Logger.log('[doPost Error] ' + err.message);
             return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
         }
     }
     ```
   - 部署為「Web App（執行身份為『我』，允許任何人匿名存取）」，取得 deployed URL

2. **修改前端 `saveAllRecipes()`**
   - 改為 POST 到後端（renovation_checker.html 第 977–982 行）：
     ```javascript
     const saveAllRecipes = async () => {
         if (db.mapExMaterials.length === 0 && db.mapExTools.length === 0) {
             alert('無變更內容可儲存');
             return;
         }
         
         const payload = {
             token: 'YOUR_SECRET_TOKEN', // 防止濫用
             mapExMaterials: db.mapExMaterials,
             mapExTools: db.mapExTools
         };
         
         try {
             const response = await fetch('https://script.google.com/macros/d/{DEPLOYED_ID}/usercallback', {
                 method: 'POST',
                 body: JSON.stringify(payload)
             });
             const result = await response.json();
             
             if (result.success) {
                 alert('配方已成功儲存至 Google Sheets');
                 recipeManager.hasChanges = false;
             } else {
                 alert('儲存失敗：' + (result.error || '未知錯誤'));
             }
         } catch (err) {
             console.error('[SaveRecipes Error]', err);
             alert('網路錯誤，請稍後重試');
         }
     };
     ```

3. **修改 `saveSelectedImage()`，改為只標記變更**
   - 先暫存圖片資訊於本地（待方案 A 完成後再整合到配方寫回）：
     ```javascript
     const saveSelectedImage = () => {
         if (!imageModal.material || !imageModal.currentImage) return;
         
         const matId = imageModal.material.mat_id;
         const matInDb = db.materials.find(m => m.mat_id === matId);
         if (matInDb) {
             matInDb.image_url = imageModal.currentImage;
             matInDb.image_photographer = imageModal.images[imageModal.currentIndex]?.photographer;
             matInDb.image_source = imageModal.images[imageModal.currentIndex]?.source;
         }
         
         alert('圖片已暫存（重新整理前不會遺失）\n點擊「儲存配方」按鈕可永久保存');
         imageModal.show = false;
     };
     ```

4. **加入錯誤重試與 UI 提示**
   - 在 `saveAllRecipes()` 加入 retry 邏輯（最多 3 次）與進度指示器
   - 加入 `recipeManager.savingInProgress` flag 以防止重複點擊

5. **部署為 Web App**
   - 開啟 Apps Script Editor，點選「Deploy」→「New Deployment」
   - 選「Web app」，設定執行身份為「您的帳戶」
   - 允許存取權限為「任何人（包括匿名者）」
   - 複製 deployed URL（格式：`https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercallback`）
   - 更新前端 `saveAllRecipes()` 與方案 A 的 `searchImages()` 中的 URL

**估時**：4–8 小時（含後端 doPost 開發、前端整合、部署、錯誤處理與測試）  
**難度**：中等

---

### 方案 C：改為穩定 JSON 資料來源（中優先）

**目標**：由 GViz JSONP 改為 Apps Script JSON API 或發布 CSV，降低解析脆弱性

**受影響檔案與符號**：
- `modules/InteriorDesigned/renovation_checker.html`：`fetchSheet()` (1137–1169 行), `parseGVizData()` (1177–1182 行)
- 新增或改進 `modules/InteriorDesigned/sheet_initializer.gs`：新增 `doGet()` endpoint

**選項**：
- **選項 C1（推薦）**：改用 Apps Script `doGet()` 提供 JSON
  - 優點：完全掌控格式、易於擴展、支援 write-back 同時處理
  - 缺點：需要多一個 Apps Script 部署
  
- **選項 C2**：改為 Google Sheets 發布 CSV
  - 優點：簡單，無需額外後端
  - 缺點：發布 CSV 每更新需 15–30 分鐘延遲；無欄位驗證

**可執行步驟（以 C1 為例）**：

1. **在 `sheet_initializer.gs` 新增 `doGet()` endpoint**
   ```javascript
   function doGet(e) {
       try {
           const ss = SpreadsheetApp.getActiveSpreadsheet();
           const sheetName = e.parameter.sheet || 'DB_Materials';
           const sheet = ss.getSheetByName(sheetName);
           
           if (!sheet) {
               return ContentService.createTextOutput(JSON.stringify({error: 'Sheet not found'})).setMimeType(ContentService.MimeType.JSON);
           }
           
           const data = sheet.getDataRange().getValues();
           const headers = data[0];
           const rows = data.slice(1).map(row => {
               const obj = {};
               headers.forEach((h, i) => {
                   obj[h] = row[i] || '';
               });
               return obj;
           });
           
           return ContentService.createTextOutput(JSON.stringify({
               sheet: sheetName,
               count: rows.length,
               data: rows
           })).setMimeType(ContentService.MimeType.JSON);
       } catch (err) {
           return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
       }
   }
   ```

2. **修改前端 `fetchSheet()`**
   - 改為呼叫 `doGet?sheet={sheetName}` 而非 GViz JSONP

3. **簡化 `parseGVizData()`**
   - 由於已是標準 JSON，可直接使用 `response.json().data`

4. **加入欄位驗證**
   - 檢查必要欄位（如 `mat_id`, `task_id`）是否存在，若缺失則警示

**估時**：3–6 小時  
**難度**：簡單→中等

---

### 方案 D：改善前端效能與 UX（中優先）

**目標**：移除自動測試載入、改善錯誤訊息、加入進度指示、降低 console.log 雜訊

**受影響檔案與符號**：
- `modules/InteriorDesigned/renovation_checker.html`：onMounted auto-add (1247–1250 行)、大量 console.log、錯誤提示、`calculatedMaterials` / `calculatedTools` computed 優化

**可執行步驟**：

1. **移除或條件化 auto-add 測試工項**
   - 加入開發旗標：
     ```javascript
     const DEBUG_AUTO_ADD = false; // 改為 true 時自動載入測試
     onMounted(async () => {
         // ... 資料載入邏輯
         if (DEBUG_AUTO_ADD) {
             cart.value.push({...}); // 測試工項
         }
     });
     ```

2. **改善錯誤處理**
   - 為每張表的載入加入獨立 loading 與 error 狀態
   - 若某張表無法讀取，顯示警示但允許繼續（降級策略）
   - 改進 alert 訊息為具體的「何處失敗」與「建議動作」

3. **降低 console.log**
   - 使用 `DEBUG_MODE` flag 包裝所有 console.log，預設為 false

4. **計算優化**
   - 為 `calculatedMaterials` 與 `calculatedTools` 加入 debounce（防止過頻計算）

**估時**：2–4 小時  
**難度**：簡單

---

### 方案 E：強化 Apps Script 寫入邏輯（低優先）

**目標**：改進 `writeToSheet()` 與 `seedSampleData()` 的健壯性

**受影響檔案與符號**：
- `modules/InteriorDesigned/sheet_initializer.gs`：`writeToSheet()` (784–805 行), `seedSampleData()` (64–......)

**可執行步驟**：

1. **改 `writeToSheet()` 為按實際列數清空**
   ```javascript
   function writeToSheet(ss, name, data) {
       const sheet = ss.getSheetByName(name);
       if (sheet.getLastRow() > 1) {
           sheet.deleteRows(2, sheet.getLastRow() - 1);
       }
       // ... appendRows 邏輯
   }
   ```

2. **處理最大列數限制**
   - 若資料超過 1000 行，分批寫入或提示使用者

3. **加入 transaction-like 行為**
   - 先寫到暫存分頁，驗證無誤後再 swap

**估時**：1–2 小時  
**難度**：簡單

---

## 6. 資料庫結構設計 (Google Sheets)
我們採用「關聯式結構」，將「基本資料」與「工項配方」分開，確保材料與工具只需建立一次即可重複使用。
共需規劃 **5 個分頁 (Tabs)**：

### A. 基本資料庫 (Master Data) - 定義「有什麼」

#### 分頁 1：材料總表 (DB_Materials)
定義所有可用的材料項目。
*   `mat_id`: 材料唯一碼 (如: `m_silicate_6mm`)
*   `name`: 材料名稱 (如: `矽酸鈣板`)
*   `category`: 分類 (如: `板材`, `五金`)
*   `spec_order`: **[NEW] 叫料規格** (關鍵！如: `3x6尺`, `4x8尺 9mm`, `8尺1寸`)
*   `brand`: **[NEW] 品牌/型號** (如: `日本麗仕`, `永新F1`)
*   `unit`: 叫料單位 (如: `張`, `支`, `箱`)
*   `vendor_ref`: 參考廠商
*   `price_estimate`: 預估單價
*   `pack_desc`: 包裝規格 (如: `一箱8片`)

#### 分頁 2：工具與配件總表 (DB_Tools)
定義所有可用的工具與**五金配件**。
*   `tool_id`: 工具唯一碼 (如: `t_compressor`, `t_hinge_soft_close`)
*   `name`: 名稱 (如: `空壓機`, `進口緩衝鉸鍊`)
*   `category`: 分類 (如: `電動工具`, `五金配件`)
*   `power_spec`: 動力規格 (如: `110V`, `18V`)
*   `alloc_rule`: 配給規則 (`Site`, `Worker`, `Dynamic`)
*   `storage_box`: 收納位置
*   `maintenance`: **[NEW] 保養說明** (如: `每日洩水`, `上油`)
*   `usage_tips`: **[NEW] 使用要訣** (如: `壓力設定8kg`, `需搭配專用釘`)

#### 分頁 3：工項清單 (DB_Tasks)
定義所有可選的施工項目。
*   `task_id`: 唯一識別碼
*   `category`: 分類
*   `phase`: **[NEW] 施工階段** (如: `01_保護`, `02_拆除`, `03_木作`)，支援分批叫工具。
*   `task_name`: 工項名稱
*   `unit`: 計算單位 (如: `坪`, `尺`, `式`)
*   `labor_cost`: 工資單價
*   `sop_construction`: 施工要點 (工法)
*   `inspection_key`: 重點檢核 (高風險)
*   `inspection_sample`: 抽查項目 (中低風險)

### B. 配方關聯表 (Recipes/Mapping) - 定義「怎麼用」

#### 分頁 4：工項材料配方 (Map_Task_Materials)
將「工項」與「材料」連結。
*   `task_id`: 對應 DB_Tasks
*   `mat_id`: 對應 DB_Materials
*   `spec`: 規格/備註 (如: `6mm`, `9mm`)
*   `qty_per_unit`: 單位用量
*   `loss_rate`: 損耗率
*   `linked_tool_id`: 綁定工具 (選填)
*   `is_consumable`: 耗材標記

#### 分頁 5：工項工具/配件配方 (Map_Task_Tools)
將「工項」與「工具」或「五金」連結。
*   `task_id`: 對應 DB_Tasks
*   `tool_id`: 對應 DB_Tools
*   `type`: 必要性 (`必備`, `選配`)
*   `qty_avg`: 平均用量 (對應 Dynamic 規則)
*   `calc_method`: 計算邏輯 (`Fixed`/`PerUnit`)

### 分頁 6：紀錄 (Logs) - *選用*
若需寫入功能，此頁用於存放歷史計算紀錄。
*   `timestamp`: 時間戳記
*   `project_name`: 案場名稱
*   `input_summary`: 輸入內容摘要
*   `total_cost_est`: 預估成本 (材料+工資)
*   `status`: 狀態 (如: `已規劃`, `已叫料`, `施工中`)

## 6. 資料庫結構設計 (Google Sheets)

我們採用「關聯式結構」，將「基本資料」與「工項配方」分開，確保材料與工具只需建立一次即可重複使用。  
**Sheet ID**：`1EXy83IaR378dX68ppltYL0KdD76zZFf40we2AYXwUh8`  
**隱私設定**：公開檢視（允許前端直接讀取）

共需規劃 **6 個分頁 (Tabs)**：

### A. 基本資料庫 (Master Data)

#### 分頁 1：材料總表 (DB_Materials)
*   `mat_id`: 材料唯一碼（如：`m_silicate_6mm`）
*   `category`: 分類（如：`板材`, `五金`）
*   `name`: 材料名稱（如：`矽酸鈣板`）
*   `spec_order`: 叫料規格（如：`3x6尺`）
*   `brand`: 品牌/型號（如：`日本麗仕`）
*   `unit`: 叫料單位（如：`張`, `支`）
*   `vendor_ref`: 參考廠商
*   `price_estimate`: 預估單價
*   `pack_desc`: 包裝規格
*   `description`: 備註描述
*   `image_url`: 圖片 URL（由方案 A 新增）
*   `image_photographer`: 圖片作者（由方案 A 新增）
*   `image_source`: 圖片來源網站（由方案 A 新增）

#### 分頁 2：工具與配件總表 (DB_Tools)
*   `tool_id`: 工具唯一碼
*   `category`: 分類（如：`電動工具`, `五金配件`）
*   `name`: 名稱
*   `power_spec`: 動力規格（如：`110V`, `18V`）
*   `alloc_rule`: 配給規則（`Site`, `Worker`, `Dynamic`）
*   `storage_box`: 收納位置
*   `maintenance`: 保養說明
*   `usage_tips`: 使用要訣

#### 分頁 3：工項清單 (DB_Tasks)
*   `task_id`: 唯一識別碼
*   `category`: 分類
*   `phase`: 施工階段（如：`01_保護`, `02_拆除`, `03_木作`）
*   `task_name`: 工項名稱
*   `unit`: 計算單位（如：`坪`, `尺`, `式`）
*   `labor_cost`: 工資單價
*   `sop_construction`: 施工要點
*   `inspection_key`: 重點檢核
*   `inspection_sample`: 抽查項目

### B. 配方關聯表 (Recipes/Mapping)

#### 分頁 4：工項材料配方 (Map_Task_Materials)
*   `task_id`: 對應 DB_Tasks
*   `mat_id`: 對應 DB_Materials
*   `spec`: 規格/備註
*   `qty_per_unit`: 單位用量
*   `loss_rate`: 損耗率
*   `is_consumable`: 耗材標記
*   `linked_tool_id`: 綁定工具（選填）

#### 分頁 5：工項工具/配件配方 (Map_Task_Tools)
*   `task_id`: 對應 DB_Tasks
*   `tool_id`: 對應 DB_Tools
*   `type`: 必要性（`必備`, `選配`）
*   `qty_avg`: 平均用量
*   `calc_method`: 計算邏輯（`Fixed`/`PerUnit`）

#### 分頁 6：紀錄 (Logs)（選用）
*   `timestamp`: 時間戳記
*   `project_name`: 案場名稱
*   `input_summary`: 輸入內容摘要
*   `total_cost_est`: 預估成本
*   `status`: 狀態

---

## 7. 近期優先 Sprint 建議

| 優先 | 方案 | 關鍵工作 | 估時 | 難度 | 狀態 |
|------|------|--------|------|------|------|
| 高 | B | 實作 `saveAllRecipes()` → Apps Script doPost write-back | 4–8 hr | 中等 | ⏳ 待進行 |
| 高 | A | API 金鑰安全化（移至後端代理） + 圖片授權 metadata | 5–10 hr | 中等 | ⏳ 延後（待決定圖片來源） |
| 中 | C | 改 GViz JSONP 為穩定 Apps Script JSON API | 3–6 hr | 簡單→中等 | ⏳ 可選 |
| 中 | D | 前端效能與 UX 改善（移除 auto-test，降低 console noise） | 2–4 hr | 簡單 | ⏳ 可選 |
| 低 | E | 強化 `writeToSheet()` 與 `seedSampleData()` 邏輯 | 1–2 hr | 簡單 | ⏳ 可選 |

---

## 8. 部署與安全檢查清單

### 前端部署（HTML）
- [ ] 檢查並移除所有硬編碼的 API key（完成方案 A 後）
- [ ] 確認 Google Sheet 為「公開檢視」模式
- [ ] 移除或條件化所有 DEBUG 相關代碼與 console.log（完成方案 D 後）
- [ ] 檢查圖片 Modal 與授權資訊顯示（完成方案 A 後）
- [ ] 在生產環境測試「儲存配方」功能（完成方案 B 後）

### Apps Script 部署
- [ ] 在 Google Cloud 或 Apps Script 的 Script Properties 中儲存 API key（勿硬編碼）
- [ ] 設定 `doPost()` 與 `doGet()` 的存取權限（「任何人」或「團隊」）
- [ ] 部署為「Web App」並取得 deployed URL
- [ ] 記錄 deployed URL 至本文檔備註欄位
- [ ] 定期檢查配額使用量（若使用 Pexels/Unsplash/Google Custom Search）

### 資料隱私
- [ ] 確認 Google Sheet 不含敏感商業資料（若公開）
- [ ] 若改用私有 Sheet，需切換為後端代理讀取（方案 C）
- [ ] 圖片結果中應包含作者與來源連結（方案 A 實作）

### 效能監控
- [ ] 監控前端首屏載入時間（目標 <2 秒）
- [ ] 監控圖片搜尋 API 配額（若使用 Pexels/Unsplash）
- [ ] 定期清理 Google Sheet 舊資料（避免行數過多）

---

## 9. 需要使用者決策與確認（待回覆）

### ✅ 已確認決策
1. **Google Sheet 隱私**：保持「公開」，允許前端直接讀取
2. **Apps Script 部署**：「您部署」或「提供程式碼」？（延後決定，下次決策時回覆）

### ⏳ 待決策事項

#### 1. 圖片搜尋服務選擇（決定後推進方案 A）
- **A1. Pexels**（推薦）
  - 優點：配額 200 req/hr（較慷慨），授權寬鬆，免費
  - 缺點：圖片庫較小
  - API 申請：https://www.pexels.com/api/
  
- **A2. Unsplash**
  - 優點：高品質圖片，社群資源豐富
  - 缺點：配額 50 req/hr（限速較嚴），付費升級較貴
  - API 申請：https://unsplash.com/oauth/applications
  
- **A3. 保留 Google Custom Search**
  - 優點：整合度高（已實作）
  - 缺點：免費配額 100 queries/日，超出需付費（~US$5/1000）；版權風險較高
  - 不建議長期使用

#### 2. Apps Script 部署的執行身份與帳號
- 是否由「您的帳號」部署（安全）還是「我提供程式碼+部署指引」由您自行部署？
- 若部署至您帳號：需要您開啟 Google Apps Script Editor 並執行「Deploy」按鈕

#### 3. 數據寫回的完整性
- 圖片儲存是否必須在方案 B（配方寫回）完成後才推進方案 A？
- 或允許先實作方案 A（圖片搜尋 + 授權 metadata），暫不寫回 Sheet？

#### 4. 是否需要實作「配方版本控制」？
- 例如：紀錄誰何時修改了哪些配方（適合多人協作）
- 暫不實作，預留未來擴展空間

---

## 10. 專案進度追蹤

| 功能 | 目前狀態 | 所需方案 | 預計完成 |
|------|--------|--------|--------|
| 購物車與材料計算 | ✅ 完成 | — | — |
| 工具檢核表 | ✅ 完成 | D（可選優化） | — |
| 配方 CRUD UI | ✅ 完成 | — | — |
| 圖片搜尋 UI | ✅ 完成 | A（完整實作）| ⏳ 待決策 |
| 配方寫回持久化 | ❌ 未實現 | B（必要）| ⏳ 下一個 sprint |
| 圖片與授權保存 | ⚠️ 暫存記憶體 | A+B（必要）| ⏳ 待決策 |
| API 金鑰安全化 | ❌ 未實現 | A（必要）| ⏳ 待決策 |
| 資料來源穩定性 | ⚠️ GViz JSONP | C（可選）| ⏳ 低優先 |
| 前端 UX 細化 | ⚠️ 有 auto-test 污染 | D（可選）| ⏳ 低優先 |

---

## 11. 參考檔案與重要連結

- **前端實作**：[modules/InteriorDesigned/renovation_checker.html](modules/InteriorDesigned/renovation_checker.html)
  - 關鍵符號：`searchImages()` (1047–1071), `saveAllRecipes()` (977–982), `saveSelectedImage()` (1091–1097), `fetchSheet()` (1137–1169), `parseGVizData()` (1177–1182), `calculatedMaterials` (1240–1291), `calculatedTools` (1295–1344)
  
- **Apps Script 初始化**：[modules/InteriorDesigned/sheet_initializer.js](modules/InteriorDesigned/sheet_initializer.js)
  - 關鍵符號：`setupDatabase()`, `seedSampleData()`, `writeToSheet()` (784–805)
  
- **Google Sheet**：https://docs.google.com/spreadsheets/d/1EXy83IaR378dX68ppltYL0KdD76zZFf40we2AYXwUh8/
  - 分頁：DB_Materials, DB_Tools, DB_Tasks, Map_Task_Materials, Map_Task_Tools, Logs

- **外部 API 文件**：
  - Pexels API：https://www.pexels.com/api/
  - Unsplash API：https://unsplash.com/oauth/applications
  - Google Custom Search API：https://developers.google.com/custom-search
  - Google Apps Script：https://developers.google.com/apps-script

---

## 12. 程式碼現況檢核報告 (2025-12-16)

### A. 架構概述

| 層面 | 技術 |
|------|------|
| 前端框架 | Vue 3 (Composition API, CDN) |
| 樣式 | TailwindCSS (CDN) |
| 圖標 | Phosphor Icons |
| 資料來源 | Google Sheets (GViz JSONP 讀取) |
| 後端 API | Google Apps Script Web App (POST) |

### B. 主要功能模組狀態

| 功能區塊 | 說明 | 狀態 |
|----------|------|------|
| **案場設定** | 設定案場名稱、施工階段、工具分配模式 | ✅ 正常 |
| **新增工項 (Cart)** | 選擇工項分類、加入數量 | ✅ 正常 |
| **材料總表** | 根據購物車計算所需材料，含供應商分組 | ✅ 正常 |
| **工具清單** | 電動工具/手工具分類顯示，含保養與撇步展開 | ✅ 正常 |
| **施工重點** | 顯示 SOP、驗收重點、補充標準 | ✅ 正常 |
| **配方管理** | 編輯工項對應的材料/工具配方 (CRUD) | ✅ 正常 |
| **圖片搜尋** | 透過 Google Custom Search API 搜尋材料圖片 | ✅ 正常 |
| **資料庫重置** | 透過 GAS 呼叫 `setup_db` 初始化 | ✅ 正常 |

### C. 資料流架構

```
Google Sheets (5 個工作表)
    ├── DB_Materials    → 材料主檔
    ├── DB_Tools        → 工具主檔
    ├── DB_Tasks        → 工項主檔
    ├── Map_Task_Materials → 工項-材料配方對應
    └── Map_Task_Tools     → 工項-工具配方對應

讀取：GViz JSONP (fetchSheet)
寫入：GAS Web App POST (callBackend)
```

---

### D. 安全性問題 ⚠️

| 問題 | 位置 | 嚴重程度 | 建議 |
|------|------|----------|------|
| API Key 外洩 | 第 1143-1144 行 `GOOGLE_API_KEY`, `GOOGLE_CX` 直接寫在前端 | 🔴 高 | 應透過 GAS 後端代理呼叫，或限制 API Key 的使用範圍 (HTTP Referer) |
| Sheet ID 公開 | 第 1307 行 | 🟡 中 | 若 Sheet 為 Anyone 可讀，需確認是否符合預期 |

---

### E. UX 改善建議

| 項目 | 現況 | 建議 |
|------|------|------|
| 無資料提示 | 材料表、工具表無資料時無提示 | 加入空狀態 (Empty State) 提示 |
| 購物車刪除鍵 | 僅 hover 時顯示 | 手機端無 hover，建議改為常駐顯示 |
| 儲存回饋 | 使用 `alert()` | 改用 Toast 或非阻塞式通知 |
| 載入狀態 | 僅顯示於 Header | 各區塊可加 Skeleton Loading |

---

### F. 程式碼品質建議

| 項目 | 現況 | 建議 |
|------|------|------|
| DEBUG Log | 多處 `console.log` 留存 | 建議用 `const DEBUG = true` flag 控制 |
| 欄位名稱不一致 | `spec_order` vs `spec` | 統一命名慣例 |
| 重複程式碼 | 新增材料/工具 Modal 結構相似 | 可抽取為 Reusable Component |
| 錯誤處理 | 部分 API 錯誤只 console.error | 建議統一 Toast 顯示錯誤 |

---

### G. 功能擴充建議

| 功能 | 說明 |
|------|------|
| 匯出 PDF/Excel | 將材料清單匯出為可列印格式 |
| 歷史紀錄 | 儲存曾經規劃的案場清單 (localStorage 或 GAS) |
| 離線快取 | 使用 IndexedDB 快取 Sheet 資料 |
| 權限控管 | 區分「檢視」vs「編輯」角色 |

---

### H. 已知潛在問題

| 問題 | 說明 |
|------|------|
| 圖片 Modal 初始化 Watch | 第 1157-1161 行有 DEBUG watch，生產環境應移除 |
| 配方儲存為 Delete All + Batch Create | 若網路中斷，可能導致資料遺失，建議改用 Transaction 或標記式更新 |

---

### I. 改進優先順序

| 優先級 | 項目 | 預估時間 |
|--------|------|---------|
| 🔴 高 | API Key 安全性處理 | 2-4 hr |
| 🟠 中 | 手機端 UX 優化 (刪除按鈕、載入狀態) | 2-3 hr |
| 🟡 中 | 統一錯誤處理與 Toast 通知 | 2-3 hr |
| 🟢 低 | DEBUG Log 清理、程式碼重構 | 1-2 hr |

---

## 13. 備註與後續討論

- **方案 B（配方寫回）**建議在下一個 sprint 優先實現，確保使用者修改不會遺失
- **方案 A（圖片來源）**因涉及第三方授權與成本，暫定為延後決策；待您回覆圖片服務選擇後推進
- **方案 C–E** 為可選優化，取決於實際使用反饋與維運資源

若有任何疑問或需要進一步說明，請隨時補充討論

✅ **計劃書更新完成於 2025-12-16**
