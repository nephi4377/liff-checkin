# LP-STORAGE-1：LayoutPlanner 本機儲存

## 目的

避免 `localStorage` 容量上限導致大底圖（data URL）或多份 undo history 無法寫入或損壞。平面配置與底圖改存 **IndexedDB**；`localStorage` 僅保留**小型索引**（`layoutPlanner_storage_index_v1`）。

## 資料庫

| 項目 | 值 |
|------|-----|
| DB 名稱 | `layout-planner-storage-v1` |
| 版本 | `1` |
| Object stores | `blobs`（key = blobId）、`sessions`（key = `default`） |

## localStorage

| Key | 用途 |
|-----|------|
| `layoutPlanner_storage_index_v1` | `idbReady`、`migratedFromLegacy`、`lastSavedAt`、`lastError`、`lastErrorCode`、`legacyKeyPreserved` |
| `layoutPlanner_autosave_v1` | **Legacy** 舊自動備份；遷移時**只讀複製到 IDB，不刪除** |

## 佈局版本

| 用途 | version / format |
|------|------------------|
| IndexedDB session | `3.0` |
| 手動「儲存佈局 (.json)」 | `2.0`（相容舊流程） |
| **專案檔**（完整備份，含底圖） | `3.0`，`format` = `layout-planner-project-1` |
| 客戶 **ZIP** 內佈局 JSON | `2.0`，**不含**底圖 data URL（`hasUnderlay` 旗標） |

## 底圖與 undo history

- 畫面上仍用 `<img src="data:...">`。
- **記憶體中** undo 堆疊與 #218/#222 一致：`background.src` 字串參照；`commitSaveState` 去重為 `src ===`、其餘欄位 `JSON.stringify`。
- **寫入 IndexedDB** 前：`collectHistoryForIndexedDb` 將底圖像素存 Blob，history 只留 `blobId`；載入時 `hydrateHistoryEntries` 還原 `src` 供 undo/redo。

## 搬移（legacy localStorage）

1. 首次啟動讀 `layoutPlanner_autosave_v1`。
2. 解析成功 → 寫入 IndexedDB → 標記 `migratedFromLegacy`；**不** `removeItem` 舊 key。
3. 失敗：保留舊 key、寫入 `lastError`；僅在搬移失敗且 24h 內有內容時，可選擇從 legacy 還原（避免與 IDB 成功還原重複提示）。

## 錯誤處理

| 情況 | 行為 |
|------|------|
| IndexedDB 不可用 | 通知停用自動備份；索引 `IDB_UNAVAILABLE`；**不**假裝有 IDB 還原 |
| QuotaExceeded / 寫入失敗 | `notifyStorageError` + 索引 `lastError`；提示匯出專案檔 |
| `?lpPreview=1` | 不寫 IDB、不搬移、不還原提示 |

## 專案檔 vs ZIP

- **匯出專案檔**：單一 JSON，內嵌底圖 data URL，供設計師完整備份。
- **下載設計 ZIP**：PNG + 佈局 JSON（無底圖 data URL）+ CSV，給客戶／郵件流程。

## 測試

- Vitest：`LP_storage.test.js`（`fake-indexeddb`）
- Playwright：`e2e/LP_storage.spec.cjs`（含手機 viewport）

## 限制與未做項

| 項目 | 理由 |
|------|------|
| 多專案／多案件分庫 | 本階段單一 `default` session；多案請用專案檔分檔 |
| 自動清理舊 Blob | 未實作 LRU；history 上限仍受 `MAX_HISTORY_STATES` 與瀏覽器磁碟限制 |
| 刪除 legacy localStorage key | 依需求**刻意保留**，方便人工比對與救援 |
| 雲端同步 | 不在本任務範圍 |

## 分支

- 實作：`cursor/lp-storage-1-576d`，base：`cursor/floorplan-underlay-1-576d`（#222）。
