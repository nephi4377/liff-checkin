# 施工回報系統 - 前端技術規格書 (REPORT_SYSTEM_SPEC)

## 1. 系統概述
本系統 (`report.html`) 專為工地人員設計，用於快速提交每日施工進度與現場照片。系統整合了 LINE LIFF 驗證、影像壓縮、以及分塊上傳機制，以克服 Google Apps Script (GAS) 的上傳限制與行動網路的不穩定性。

---

## 2. 核心流程
1.  **驗證**: 進入頁面時，透過 LIFF SDK 取得 `userId` 與 `displayName`。支持混合模式（內嵌於主控台或獨立開啟）。
2.  **輸入**: 使用者輸入案號、選取施工項目、填寫描述，並選擇多張現場或問題照片。
3.  **預處理**:
    - 若勾選「壓縮相片」，使用 `browser-image-compression` 將圖片最大邊長縮至 1920px。
    - 將圖片轉換為 Base64 字串。
4.  **分塊 (Chunking)**: 將所有待上傳案件（文字 + 照片）切分為多個批次，每批次固定上傳 **8 張照片**。
5.  **提交**: 循環發送 POST 請求至 GAS 後端。

---

## 3. 重要組件與函式 (I/O)

### `processPhotoChunk(photoInfoChunk, shouldCompress)`
- **說明**: 處理單批相片的影像處理邏輯。
- **輸入 (Input)**:
    - `photoInfoChunk`: `Array<{file: File, isProblem: boolean}>` (單批 8 張檔案物件)
    - `shouldCompress`: `boolean`
- **輸出 (Output)**:
    - `Promise<Array<{name: string, type: string, data: string, isProblem: boolean}>>` (Base64 照片陣列)

### `handleFormSubmit(event)`
- **說明**: 提交主邏輯，負責座標批次發送與進度顯示。
- **流程**:
    1. 驗證案號。
    2. 生成 `batchId` (userId + timestamp)。
    3. 計算 `totalChunks`。
    4. `for` 迴圈調用 `processPhotoChunk` 與 `fetch(GAS_WEB_APP_URL)`。

---

## 4. API 協定 (Request Payload)

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `action` | string | 固定為 `"submitReport"` |
| `batchId` | string | 用於將多個 Chunk 關聯為同一次回報的 ID |
| `chunkIndex` | number | 當前分塊索引 (1-based) |
| `totalChunks` | number | 總分塊數量 |
| `userId` | string | LINE UID |
| `projectId` | string | 案號 (純數字) |
| `photos` | JSON String | Base64 檔案陣列 |

---

## 5. 已知限制與優化方向
- **記憶體風險**: 在手機端讀取 20 張以上原圖時，`FileReader.readAsDataURL` 可能導致瀏覽器記憶體不足。
- **序列化開銷**: Base64 傳輸效率較低，且會增加 33% 的 Payload 大小。
- **改進建議**: 
    - 導入 `Sequential-Queue` 模式，確保第一個分塊上傳成功後才發送下一個，降低伺服器瞬時壓力。
    - 前端先縮圖再轉換 Base64。

---

## 6. 目前函式結構與 I/O 清單 (Current Architecture)

### `processPhotoChunk(photoInfoChunk, shouldCompress)`
- **位置**: `report.html` (JS Module)
- **功能**: 將照片陣列進行影像壓縮 (選用) 並封裝為 Base64 物件。
- **Input**: 
    - `photoInfoChunk`: `Array<{file: File, isProblem: boolean}>` (單批原始檔案)
    - `shouldCompress`: `boolean` (是否執行壓縮)
- **Output**: `Promise<Array<{name, type, data, isProblem}>>` (Base64 資料陣列)

### `handleFormSubmit(event)`
- **位置**: `report.html` (JS Module)
- **功能**: 表單提交的主控程序，負責驗證、分塊、顯示進度並循環發送網路請求。
- **Input**: `event` (HTML Submit Event)
- **Output**: `void` (非同步更新 UI 或調用 `handleSuccess`)

### `startFakeProgress(targetPercentage)`
- **位置**: `report.html`
- **功能**: 啟動一個擬真的進度動畫，使進度條平滑移動至目標百分比的前 1%。
- **Input**: `targetPercentage`: `number` (目標百分比)

### `updateProgressBar(percentage)`
- **位置**: `report.html`
- **功能**: 物理更新 DOM 元素中的進度條寬度與內文。
- **Input**: `percentage`: `number` (0-100)
