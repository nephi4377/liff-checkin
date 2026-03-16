# 施工回報系統 - 前端技術規格深編 (REPORT_SYSTEM_SPEC) (v2.5)

## 1. 架構定義：Fire-and-Forget 極速回報
本系統 (`reportV2.html`) 徹底捨棄了傳統「分塊等待」邏輯，轉向以 **Firebase Storage** 為核心的非同步傳輸架構。

## 2. 核心技術實作細節

### 2.1 Firebase 並行上傳管道
- **匿名認證**: 使用 `signInAnonymously()` 確保前端具備 Storage 寫入權限而不需用戶登入。
- **圖片預處理 (CPU 瘦身)**:
    - 採用 `browser-image-compression` 將圖片壓至 **400KB / 1280px** 以下。
    - **記憶體優化**: 只要 Firebase 上傳成功獲取 URL，立即中斷 Base64 轉換 (`Promise` 提前結束)，避免 JS Heap 溢出。
- **並行度控制**: 使用 `Promise.all` 同步啟動全量上傳，利用行動端並行 TCP 連線優化效能。

### 2.2 故障與安全機制 (Resilience)
- **Fallback 備援**: 若 Firebase 認證或儲存失敗，系統自動回退至 **Base64 -> GAS** 的傳統模式。
- **API 通訊**: 採「一次性打包」POST，將所有 URLs 封裝於 `json` Payload 中，減少三次握手 (Handshake) 的累計延遲。

## 3. 效能指標與統計
- **儀表板監控**: 即時計算並顯示「耗時 (s)」與「速率 (KB/s)」。
- **批次識別碼 (`batchId`)**: 格式為 `userId-timestamp`，用於後端搬運服務將散落在 Storage 的檔案重新關聯為單一施工回報。

## 4. 關鍵函式 I/O
- `uploadPhotoToFirebase()`: 回傳 `Promise<string>` URL。
- `processPhotoChunk()`: 融合壓縮與上傳，具備降級處理邏輯。
- `handleFastReport`: 後端專屬極速路由處理器。

---
> [!NOTE]
> 進行 V2 維護時，請優先確認 `FIREBASE_CONFIG` 的 API 金鑰與儲存桶權限是否有效。
