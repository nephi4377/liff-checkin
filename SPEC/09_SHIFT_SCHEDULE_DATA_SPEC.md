# 排班系統資料格式規格書 (v1.1)

本文件定義「前端排班系統」與「後端 API」之間的資料溝通契約。更新於 2026-03-24，以符合 `shift_schedule.html` 實作現況。

---

## 1. 取得員工清單 (Action: `get_employees`)
用於初始化下拉選單與組別篩選器。

> **與出勤儀表板區分**：排班／本頁使用一般 `filter`（預設在職）；出勤儀表板使用 `attendance_*` mode，詳見後端 `SPEC/11_EMPLOYEE_MANAGEMENT_SPEC.md` §3.1。

### 請求參數
- `page`: `attendance_api`
- `action`: `get_employees`
- `source`: `員工排班` (輔助參數)
- `userId`: 請求者 UID
- `userName`: 請求者姓名

### 回傳格式 (data)
```json
[
  {
    "userId": "U7ce84c78bdee4060babe9cc3c03d291b",
    "userName": "周汶則",
    "permission": 4,
    "group": "台南店",
    "shiftType": "排班制",
    "status": "員工",
    "pcName": "TX34"
  },
  ...
]
```
- **userName**: 前端顯示姓名的主要來源。
- **permission**: 權限等級 (2-4 為參與排班對象, 5 為系統管理者/隱藏)。
- **shiftType**: 班別類型，前端目前支援 `排班制` 與 `標準制`。

---

## 2. 取得月份班表 (Action: `get_latest_schedule`)
用於獲取特定月份已儲存的排班紀錄與國定假日。

### 請求參數
- `page`: `attendance_api`
- `action`: `get_latest_schedule`
- `year`: 2026 (西元年)
- `month`: 4 (1-12)
- `userId`: 請求者 UID
- `userName`: 請求者姓名

### 回傳格式
```json
{
  "schedule": {
    "Uxxxx... (UID)": {
      "_userName": "姓名",
      "2026-04-10": "休假",
      "2026-04-11:特休": "特休[08:00-12:00]",
      "2026-04-15": "加班"
    }
  },
  "holidays": ["2026-04-04", "2026-04-05"]
}
```
- **schedule**: 以 `userId` 為第一層 Key。
- **解析邏輯**: 前端會解析 Key 名中的 `:`。若 Key 為 `日期:狀態`，則優先取 `:` 前的日期與 `:` 後的狀態。
- **狀態格式說明**:
    - `休假`: 此為標準紅色「休」字標籤。
    - `狀態[HH:mm-HH:mm]`: 包含時間註記的假別（如 `特休[0System:00-12:00]`），前端會解析括號內文字顯示於下方。
    - `加班`: 在日曆格展示時通常不顯示標籤，但保留於資料中。

---

## 3. 儲存排班變更 (Action: `save_schedule_version`)
將前端編輯後的月份班表字串化後傳回。

### 請求參數
- `page`: `attendance_api`
- `action`: `save_schedule_version`
- `editorId`: 操作者 UID
- `editorName`: 操作者姓名
- `editorPermission`: 操作者權限等級
- `targetUserId`: 被排班的員工 UID
- `targetUserName`: 被排班的員工姓名
- `yearMonth`: `YYYY-MM` (例如 `2026-04`)
- `offDaysCsv`: `日期1:狀態1,日期2:狀態2` (該月份所有已記錄狀態的 CSV 組合)
- `isStandard`: 是否為標準班 (true/false)

---

## 4. 實務注意事項
- **顯示月份**: 排班系統通常遵循「預排制度」。當日期進入每月下旬 (如 20 號後)，使用者操作目標通常為「下個月份」。
- **姓名遺失**: 若前端顯示 `undefined`，通常為 `get_employees` 傳回的物件中缺漏 `userName` 欄位。
## 5. 實際 API 回傳範例分析 (2026-03-24 請求案例)

### 請求 (Request)
- `action`: `get_latest_schedule`
- `year`: 2026
- `month`: 3
- `userId`: `Ud58333430513b7527106fa71d2e30151` (俊豪)

### 預期回傳分析 (Response Analysis)
根據 `ScheduleLogic.js` 與 `EmployeeLogic.js` 的邏輯：

1. **基本結構**:
```json
{
  "schedule": {
    "Ud58333430513b7527106fa71d2e30151": {
      "_userName": "俊豪",
      "2026-03-01": "休假",
      "2026-03-08": "休假",
      "2026-03-15": "休假",
      "2026-03-22": "休假",
      "2026-03-29": "休假",
      ... (及其它手動儲存的排班紀錄)
    }
  },
  "holidays": ["2026-03-01", "2026-03-08", "2026-03-15", "2026-03-22", "2026-03-29"] 
}
```

2. **邏輯說明**:
   - **`_userName`**: 透過 `employeeMap.get(userId)` 從員工資料表中抓取 `userName` 並補回。
   - **`schedule`**: 內容取自「排班歷史紀錄」工作表中該月份該員工的最後一筆紀錄。
   - **解析機制**: 後端會將 `offDaysCsv` 的字串（如 `2026-03-01:休假,2026-03-15`）解析為物件。若無冒號則預設為 `休假`。
   - **`holidays`**: 呼叫 `CoreLib.getHolidays(2026, 3)` 取得該月份假日（通常包含週日與國定假日）。
   - **標準制員工 (特別邏輯)**: 若為標準制員工且該月無紀錄，後端會自動以國定假日作為預設休假日期。
