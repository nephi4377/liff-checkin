# 添心專案：假勤系統技術規格書 (v1.0)

本文件詳述添心人力資源引擎中的「假勤管理模組」技術實現，包含補件狀態機、員工資料跨層快取、以及與 GAS 後端的溝通契約。

## 1. 核心邏輯 (承重牆)

### 1.1 補件模式狀態機 (Patching State Machine)
假勤系統支援對已過期或漏記的考勤進行「補件」。
- **觸發條件**: 當簽到記錄缺失或由管理員手動發起。
- **狀態流轉**: `PENDING` (待補) -> `SUBMITTED` (已提交) -> `VERIFIED` (已核實) -> `SYNCED` (已同步至雲端)。
- **核心函式**: `handleLeavePatching()` 負責計算補件時間差與扣假邏輯。

### 1.2 員工資料跨層快取 (Cross-Layer Cache)
為了減少重複請求，員工基本資料與剩餘假數會快取在 `localStorage` 中。
- **快取鍵值**: `console_employees`
- **生命週期**: 24 小時。
- **失效機制**: 當 `fetchEmployees()` 偵測到後端版本號變更或手動觸發 `ForceUpdate` 時，快取會立即清除。

## 2. API 溝通契約

### 2.1 獲取假勤清單
- **端點**: `CONFIG.ATTENDANCE_GAS_WEB_APP_URL`
- **參數**:
  ```json
  {
    "page": "attendance_api",
    "action": "get_leave_records",
    "userId": "Uxxxx...",
    "yearMonth": "2024-03"
  }
  ```
- **回傳**:
  ```json
  {
    "success": true,
    "data": [
      { "date": "2024-03-15", "type": "特休", "hours": 8, "status": "approved" }
    ]
  }
  ```

## 3. UI 規範
- **色系**: 採用莫蘭迪色系 (Morandi Colors) 作為假別區分，確保視覺柔和。
- **嚮應式**: 在 Iframe 模式下自動調整寬度，適配專案中控台的側邊欄或全螢幕視窗。

## 4. 安全與防護
- **簽名校驗**: 所有假勤變動請求必須附帶 `pageLoadId` 與 `currentUserId` 的雜湊校對，防止惡意篡改 API 請求。
