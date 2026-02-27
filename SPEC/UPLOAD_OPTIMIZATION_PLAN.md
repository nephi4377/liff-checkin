# 施工回報系統 - 大量上傳優化計劃書 (UPLOAD_OPTIMIZATION_PLAN)

## 1. 現狀病灶
- **Payload 溢位**: 8 張高畫質 Base64 照片體積接近 10MB，易觸發 GAS 413 錯誤。
- **I/O 阻塞**: 後端同步執行「Drive 寫入 + Dropbox 歸檔」耗時過長，易觸發 30s 超時。
- **不穩定性**: 工地訊號波動導致請求中斷後需全部重來。

---

## 2. 優化方案設計

### 方案 A：智慧影像二次預壓縮 (推薦主選)
- **實施細節**: 
    - 導入 `browser-image-compression` 嚴格限制。
    - 解析度: `1280px` (適合工地識別)。
    - 品質: `0.75`。
    - 目標體積: 單張圖 < `400KB`。
- **預期效果**: 減少 80% 傳輸量，節省 70% 雲端空間。

### 方案 B：ACK 確認與斷點續傳
- **實施細節**: 
    - 重構 `handleFormSubmit` 改為「回傳確認模式」。
    - 上傳成功第一個分塊，後端給予 ACK，前端才發送下一批。
    - 利用 `localStorage` 存放 `batchId` 進度。
- **預期效果**: 解決電梯、地下室收訊不佳時的上傳失敗問題。

### 方案 C：後端異步緩衝存儲 (UX 提升)
- **實施細節**: 
    - `submitReport` 介面只負責「接收並快取至試算表佇列」。
    - 將 `_manageProjectFiles_` 整合進背景 `processUploadQueue` 觸發器。
- **預期效果**: 前端提交時間從 20 秒縮短至 2 秒，所有重型 I/O 由後端慢慢消化。

### 方案 D：離線優先 (Offline-First) 策略
- **實施細節**: 
    - 若網路中斷，允許將整個數據報儲存在 `IndexedDB`。
    - 待回到有訊號區域時，系統自動彈窗提示「有一筆待上傳回報」。
- **預期效果**: 對於完全無網路的工地環境極其友善。

---

## 3. 實施優先級預計
1.  **High**: 方案 A (縮圖) + 降低分塊數 (8 -> 3)。
2.  **Medium**: 方案 C (後端暫存化)。
3.  **Low**: 方案 B & D (斷點續傳)。

---

## 4. 關鍵函式擬定 I/O 修復

### 前端 `compressImage(file)`
- **Input**: `File (Origin)`
- **Output**: `Promise<Blob> (Compressed)`
- **設定**: `maxSizeMB: 0.4`, `maxWidthOrHeight: 1280`

### 後端 `handleQuickSubmission(data)`
- **Input**: `Base64 Chunks`
- **Logic**: 直接將字串寫入試算表臨時欄位或 CacheService，不調用檔案 API。
- **Output**: `{status: "queued"}`
