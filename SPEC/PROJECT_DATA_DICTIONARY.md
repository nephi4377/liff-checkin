# 專案全域資料字典 (Project Data Dictionary)

> **本檔位置（正式）**：`CODING/SPEC/PROJECT_DATA_DICTIONARY.md`（**2026-04-25** 自倉庫根目錄合併至此，與各模組 SPEC 同層。）  
> 本文件為「參數一致性」的唯一事實來源。所有前端、後端、API 傳輸與資料庫儲存必須**嚴格遵守**下表定義的變數名稱，嚴禁建立自定義映射表 (Mapping Table)。

## 1. 案場資料 (案場資料 Sheet) - 完整原始欄位

| Sheets 原始標題 | 程式/API 變數名 | 資料格式 | 說明 |
| :--- | :--- | :--- | :--- |
| **siteName** | `siteName` | `String` | 案場地址或自選名稱 |
| **專案狀態** | `專案狀態` | `String` | 目前執行狀態 |
| **address** | `address` | `String` | 完整地址 |
| **latitude** | `latitude` | `Number` | 緯度 |
| **longitude** | `longitude` | `Number` | 經度 |
| **建立時間** | `建立時間` | `String` | 案場資料建立時間 |
| **案號** | `案號` | `String` | 唯一專案編號 (如: 742) |
| **專案負責人** | `專案負責人` | `String` | 負責人 UID |
| **專案分區** | `專案分區` | `String` | 所屬門市/分區 |
| **設計師** | `設計師` | `String` | |
| **助理** | `助理` | `String` | |
| **工務** | `工務` | `String` | |
| **入門方式** | `入門方式` | `String` | |
| **停車方式** | `停車方式` | `String` | |
| **施工進場時間** | `施工進場時間` | `String` | |
| **保證金事宜** | `保證金事宜` | `String` | |
| **備註-管理中心電話** | `備註-管理中心電話` | `String` | |
| **衛浴使用說明** | `衛浴使用說明` | `String` | |
| **備註-施工時間** | `備註-施工時間` | `String` | |
| **備註-特別注意事項** | `備註-特別注意事項` | `String` | |

## 2. 案場資料 (案場資料 Sheet) - 稽核動態欄位

| Sheets 原始標題 | 程式/API 變數名 | 資料格式 | 說明 |
| :--- | :--- | :--- | :--- |
| **audit_items_total** | `audit_items_total` | `Number` | 專案工項總數 (自動補齊) |
| **audit_items_verified** | `audit_items_verified` | `Number` | 已核核工項總數 (自動補齊) |
| **audit_percent** | `audit_percent` | `String` | 整體審核進度 (自動補齊) |
| **audit_last_synced_by**| `audit_last_synced_by`| `String` | 最後同步者姓名 (自動補齊) |
| **audit_last_updated** | `audit_last_updated` | `String` | 最後同步時間 (自動補齊) |

## 3. 員工與權限資料 (Sheet: 員工資料)

| Sheets 原始標題 | 程式/API 變數名 | 資料格式 | 說明 |
| :--- | :--- | :--- | :--- |
| **userId** | `userId` | `String` | LINE UID |
| **userName** | `userName` | `String` | LINE 顯示姓名 |
| **shiftStartTime** | `shiftStartTime` | `String` | 上班時間 |
| **shiftEndTime** | `shiftEndTime` | `String` | 下班時間 |
| **身份** | `身份` | `String` | 職位 (如: BOSS, 設計師) |
| **班別** | `班別` | `String` | 排班制度 |
| **組別** | `組別` | `String` | 所屬分店 |
| **權限** | `權限` | `Number` | 權限等級 (1-9) |
| **到職日** | `到職日` | `String` | |
| **離職日** | `離職日` | `String` | |
| **聯絡電話** | `聯絡電話` | `String` | |
| **聯絡地址** | `聯絡地址` | `String` | |
| **緊急聯絡人** | `緊急聯絡人` | `String` | |
| **緊急聯絡人電話** | `緊急聯絡人電話` | `String` | |
| **email** | `email` | `String` | |
| **出生日期** | `出生日期` | `String` | |
| **身分證字號** | `身分證字號` | `String` | |
| **彈性時間** | `彈性時間` | `String` | 彈性上班分鐘數 (應對齊 Sheets 為 彈性時間 而非 Flextime) |
| **pcName** | `pcName` | `String` | 設備名稱 |

## 4. 日誌系統 (ProjectLog Sheet)

| Sheets 原始標題 | 程式/API 變數名 | 資料格式 | 說明 |
| :--- | :--- | :--- | :--- |
| **LogID** | `LogID` | `String` | 日誌唯一 ID (ULID/UUID) |
| **Timestamp** | `Timestamp` | `Date` | 建立時間 |
| **ProjectName** | `ProjectName` | `String` | 對應之案號 (注意: Sheets 命名為 ProjectName 但存的是案號) |
| **UserID** | `UserID` | `String` | LINE UID |
| **UserName** | `UserName` | `String` | LINE 顯示姓名 |
| **Title** | `Title` | `String` | 日誌標題 |
| **Content** | `Content` | `String` | 日誌內容全文 |
| **PhotoLinks** | `PhotoLinks` | `String` | 圖片連結 (以半形逗點分隔之 CSV) |
| **Status** | `Status` | `String` | 狀態 (如: 已發布) |

## 5. 稽核歷程 (Firebase JSON 內部結構)

| JSON Key | 資料格式 | 說明 |
| :--- | :--- | :--- |
| **price**（可選，工項） | `String` | 單一工項之**總價／小計**（Excel 欄位對應，字串、可含逗號等）；內部驗收可顯示、客戶端不顯示。見 `12_BUDGET_*_SPEC` |
| **audit_logs** | `Array` | 個別工項的操作歷程 |
| └ `ts` | `Number` | Timestamp |
| └ `user` | `String` | 操作者姓名 |
| └ `action` | `String` | 動作描述 (如: "進度變更: 0% -> 50%") |

---
> [!IMPORTANT]
> **開發規則**：
> 1. 新增欄位必須先在此表更新，再開始撰寫代碼。
> 2. API Payload 必須直接使用上述變數名作為 Key。
> 3. 禁止使用 `projectId`, `project_no`, `ctx_project_no` 等任何變形。
