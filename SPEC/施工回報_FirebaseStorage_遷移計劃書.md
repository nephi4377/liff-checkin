# 施工回報系統 Firebase Storage 遷移計劃書 (並行隔離開發版)

## 1. 專案概述
本計劃旨在優化「添心設計施工回報系統」的檔案上傳流程。

- **舊流程**: `前端降階(1280px/0.4MB) → 轉 Base64 → GAS → Drive 暫存 → 定時佇列 → Dropbox + Drive 公開連結 + Sheet 記錄`
- **新流程**: `前端降階(1280px/0.4MB) → Binary 直傳 Firebase Storage → GAS 取得 URL → Drive + Dropbox + Sheet 記錄`
- **降階說明**: 使用 `browser-image-compression`，將照片最大邊限制 1280px、檔案 ≤ 0.4MB。新舊流程均保留此步驟以節省儲存空間與上傳時間。

**開發策略**：暫不取代原方案，採並行隔離開發進行測試。

---

## 2. 現有完整流程分析 (含前端)

### 前端流程 (`report.html` / `report_test.html`)
```
使用者選擇照片 → 壓縮 → 轉 Base64 → 分批 POST 至 GAS
→ 每批收到 GAS 回傳 { success: true } 後繼續下一批
→ 所有批次成功 → 顯示「回報已成功提交！」畫面
→ 30 秒後自動關閉 LIFF 視窗
```

**前端回報「成功」的時機** (位於 `handleFormSubmit`)：
1. 前端將照片分批 (每批 4 張) POST 至 GAS。
2. 每一批 GAS 回傳 `{ success: true }` 後，前端才會繼續送下一批。
3. **所有批次**都收到 `success: true` 後，呼叫 `handleSuccess()`。
4. `handleSuccess()` 會隱藏表單、顯示綠色勾勾的「回報已成功提交！」畫面。
5. **此時照片僅完成「存入 Drive 暫存區 + 寫入 UploadQueue」**。
6. 後續的 Dropbox 歸檔、Drive 公開連結、Sheet 記錄、LINE 通知，皆由**定時觸發器在背景完成**。

> ⚠️ 也就是說：使用者看到「成功」時，照片尚未歸檔至 Dropbox，僅代表 GAS 已收到並暫存。

### 後端第一階段：即時接收 (`handleReportSubmission_`)
```
WebApp.js submitReport → handleReportSubmission_()
```
1. 接收前端 Base64 照片數據
2. 呼叫 `_manageProjectFiles_()` 將 Base64 解碼後存入 **Google Drive 暫存區**
3. 取得每張照片的 **Drive 檔案 ID (driveFileIds)**
4. 產生唯一 `logId`（同 batchId 快取 5 分鐘確保一致性）
5. 將 metadata + driveFileIds 寫入 `UploadQueue` 工作表（狀態：待處理）
6. **回傳 `{ success: true }` 給前端** ← 前端據此判定成功

### 後端第二階段：定時歸檔 (`processUploadQueue`)
```
GAS 定時觸發器 → processUploadQueue() → executeFullReportLogic()
```
1. 讀取 `UploadQueue` 中「待處理」項目
2. 呼叫 `executeFullReportLogic()` 進行雙軌歸檔
3. 用 `_normalizeAndOpenDriveLinksCsv_()` 正規化 Drive 連結並設定公開權限
4. 第一批次 (chunkIndex=1)：
   - `createLogDraftFromReport()` 建立日誌草稿
   - 寫入「每日工作回報 (回覆)」Sheet
5. 後續批次：`_manageLogEntry_()` 追加照片連結
6. 最後一批次：`CoreLib.addMessageToReplyQueue()` 發 LINE 完成通知
7. 更新狀態為「已完成」

### 後端第三階段：歸檔核心 (`executeFullReportLogic`)
```
Drive 暫存檔案 → Dropbox 案場資料夾 + Drive 公開連結
```
1. `findOrCreateProjectFolder_()` 按案號找或建 Dropbox 資料夾
2. 確保 `{案場}/施工照/` 子資料夾存在
3. 依序處理每個 driveFileId：
   - `DriveApp.getFileById()` 取得暫存檔
   - `dbxUploadSmartRetry_()` 上傳 Dropbox（含指數退避重試）
   - `tempFile.getUrl()` 取得 Google Drive 公開連結
4. 回傳 `{ photoLinks, dropboxFolderPath, successCount }`

### 資料最終去向
| 儲存位置 | 用途 | 連結格式 |
|---------|------|---------|
| **Google Drive** | 主控台顯示照片、日誌系統連結 | `https://drive.google.com/file/d/...` |
| **Dropbox** | 長期備份，同步至本機電腦 | `/{案號}/施工照/{日期}_01.jpg` |
| **Sheet** | `每日工作回報 (回覆)` 紀錄 | 含 userId, 案號, 施工內容, Dropbox 路徑 |
| **日誌系統** | `createLogDraftFromReport` 草稿 | 含 photoLinks (Drive 連結陣列) |

---

## 3. 隔離開發策略
- **前端隔離**：使用 `report_test.html`，所有測試數據標註 `isTest: true`。
- **後端隔離**：`WebApp.js` 識別 `isTest` 標記 → 導向 `FirebaseHandler.js`。
- **儲存隔離**：測試檔案存入 `Dropbox/TEST_FIREBASE/` 目錄。

---

## 4. ⚠️ FirebaseHandler.js 差距分析

| 正式流程動作 | FirebaseHandler 目前狀態 | 需修正 |
|------------|----------------------|--------|
| 存入 Drive 暫存 (取得 driveFileId) | ❌ 缺少 | ✅ 需新增 |
| `dbxUploadSmartRetry_()` 上傳 Dropbox | ✅ 已有 | — |
| 取得 Drive 公開連結 (photoLinks) | ❌ 缺少 | ✅ 需新增 |
| 寫入 `UploadQueue` Sheet | ❌ 缺少 | ✅ 需新增 |
| 建立日誌草稿 | ❌ 缺少 | ✅ 需新增 |
| 寫入「每日工作回報 (回覆)」Sheet | ❌ 缺少 | ✅ 需新增 |
| LINE 完成通知 | ❌ 缺少 | ⚠️ 測試期可選 |

### 建議修正方案
將 Firebase 測試流程直接**嫁接到現有佇列**，最大程度複用架構：
```
FirebaseHandler 收到 isTest 請求
→ UrlFetchApp.fetch(firebaseURL) 下載 Blob
→ 存入 Drive 暫存區 (模擬 _manageProjectFiles_)
→ 取得 driveFileIds
→ 寫入 UploadQueue (狀態: 待處理)
→ 讓現有的 processUploadQueue 定時觸發器接手後續工作
```

---

## 5. 已完成項目
- [x] `report_test.html`：Firebase 9+ SDK + 並行上傳 + `isTest` 標記
- [x] `FirebaseHandler.js`：隔離處理器（需補齊第 4 章差距）
- [x] `WebApp.js`：`submitReport` 路由 isTest 分流
- [x] `config_.js`：`getFirebaseStorageBucket()` + `isFirebaseTestMode()`
- [x] Firebase Storage 啟用 (asia-east1) + CORS + Rules + Script Properties

## 6. 自動化測試結果 (2026-03-04)

| 測試項目 | 結果 | 備註 |
|---------|------|------|
| Firebase App 初始化 | ✅ | Bucket 連線正常 |
| 小型檔案上傳 (.txt) | ✅ | `reports/test/` 路徑可寫 |
| Download URL 取得 | ✅ | 公開連結正常產出 |
| URL 下載內容驗證 | ✅ | 內容一致性通過 |
| 1MB 大檔壓力測試 | ✅ | 耗時 2136ms (asia-east1) |
| 檔案清理 (deleteObject) | ✅ | 自動清理正常 |

## 7. 熱更新與穩定性策略 (並行穩定性規範)

為確保施工現場回報的絕對穩定性，本計劃採購以下「防禦性開發」策略：

### A. 並行驗證 (A/B Testing)
- **環境隔離**: 所有 Firebase 測試僅在 `report_test.html` 進行，絕對不觸動 `report.html`。
- **數據分流**: 透過 `isTest: true` 標籤，後端 `WebApp.js` 會將數據導向 `FirebaseHandler.gs` 進行搬運，不影響正式的 `submitReport` 邏輯。

### B. 故障自動回退機制 (Fallback Mechanism)
- **前端攔截**: 在 `processPhotoChunk` 中，若 Firebase 上傳拋出 Error，系統**不中斷程序**，而是將 `firebaseURL` 設為空值。
- **後端備援**: 
  - 後端若收到含有 `firebaseURL` 的資料，優先執行 Cloud-to-Cloud 搬運。
  - 若 `firebaseURL` 為空，則自動採用隨附的 `data` (Base64) 進行傳統歸檔。
- **目標**: 確保「回報成功」是最高優先級，新技術若失敗則立即退回舊技術。

### C. 穩定發布策略
- **物理切換 (Manual Promotion)**: 當 `report_test.html` 通過 100% 成功率驗證後，採「手動覆蓋」方式更新至 `report.html`。
- **雙軌對齊 (Dual-Path Sync)**: 在過渡期，正式版 `report.html` 將同時攜帶 Base64 與 Firebase URL，賦予後端最大的容錯空間，確保不論網路環境如何，報修一定能成功。
- **日誌監控**: 啟用後首週開啟詳細監控，若偵測到 Firebase 故障，後端將自動優先採用 Base64 數據。

## 8. 發布作業流 (Stable Release Workflow)

1.  **驗證期 (Testing)**:
    - 使用 `report_test.html` 進行至少 20 筆完整回報測試。
2.  **全量推進 (Promotion)**:
    - **步驟 1**: 確認後端 `FirebaseHandler.gs` 搬運成功率為 100%。
    - **步驟 2**: 將 `report_test.html` 內容覆蓋 `report.html`。
    - **步驟 3**: 在 `部署記錄.md` 標註發布。
3.  **應急回滾**: 
    - 若正式版發生異常，立即將 `report.html` 還原為前一版 Base64 穩定版內容。

## 9. 下一步計劃
- [ ] **修正 FirebaseHandler.js**：嫁接到現有 UploadQueue 佇列（對齊第 4 章差距表）。
- [ ] **壓力測試**：模擬 10 張大張照片並行上傳，驗證 GAS 抓取連結的超時上限。
- [ ] **實機驗證**：邀請一名工地人員使用 `report_test.html` 進行真實場景測試。
- [ ] **穩定性校對**：確認定時觸發器在處理「Firebase 來源」與「Base64 來源」時的邏輯 100% 相容。
- [ ] **正式上線**：完成穩定性檢查後，執行靜默更新程序。

---
**核定時間**: 2026-03-04
**執行負責**: 小添 (Gemini Agent)
**執行代理**: Antigravity (小添)
