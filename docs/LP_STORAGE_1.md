# LP-STORAGE-1：LayoutPlanner 本機儲存

## 目的

避免 `localStorage` 容量上限導致大底圖（data URL）或多份 undo history 無法寫入或損壞。平面配置與底圖改存 **IndexedDB**；`localStorage` 僅保留輕量索引。

## 資料庫

| 項目 | 值 |
|------|-----|
| DB 名稱 | `layout-planner-storage-v1` |
| 版本 | `1` |
| Object stores | `blobs`（key = blobId）、`sessions`（key = `default`） |

## localStorage 索引

- Key：`layoutPlanner_storage_index_v1`
- 欄位：`idbReady`、`migratedFromLegacy`、`lastSavedAt`、`lastError`

## 佈局版本

- 自動備份／IndexedDB session：`version` **3.0**
- 手動「儲存佈局 (.json)」：仍為 **2.0**（相容舊流程）
- 專案檔：**3.0**，`format` = `layout-planner-project-1`

## 底圖

- 畫面上仍用 `<img src="data:...">`。
- 持久化時：底圖像素存 **Blob**（`blobs` store），`background` 只留 `blobId`、`position`、`scale`、`rotationDeg`、`opacity`、`locked`、`hidden`。
- Undo history 寫入 IDB 前會經 `collectHistoryForIndexedDb` 去重並轉成 blob 參照。

## 搬移（legacy）

1. 首次啟動讀 `layoutPlanner_autosave_v1`（舊 autosave）。
2. 解析成功 → 底圖入 Blob、layout 入 `sessions` → **成功後**才 `removeItem` 舊 key。
3. 失敗：保留舊 key、`lastError` 寫入索引，並以通知提示；可選擇仍從 legacy 還原。

## 專案檔匯出／匯入

- 單一 `.json`，`buildProjectFileExport` / `validateProjectFile`。
- 匯入前驗證 `format`、`version`（3.x）、`layout.placedCabinets` / `drawnAreas` 陣列。
- 匯入後寫入 IndexedDB 並更新 blob。

## 錯誤處理

- `runStorageWrite`：將 `QuotaExceededError` 等轉為 `LayoutPlannerStorageError`，UI 以 `showGlobalNotification` 顯示，不靜默丟資料。

## 測試

- Vitest：`modules/InteriorDesigned/LP_storage.test.js`（`fake-indexeddb`）
- Playwright：`e2e/LP_storage.spec.cjs`

## 限制

- 仍受瀏覽器 **IndexedDB／磁碟** 總容量限制；極大案場請定期匯出專案檔。
- `?lpPreview=1` 測試預覽不寫入 IndexedDB／不跑搬移與還原提示。

## 與其他 PR

- 本任務分支：`cursor/lp-storage-1-576d`，建議 base：`cursor/floorplan-underlay-1-576d`（#222）。
- main 與本任務開發時點：**尚未**另有 IndexedDB 實作；若後續 main 合入類似功能，以本文件與 `LP_storage.js` 為準對齊。
