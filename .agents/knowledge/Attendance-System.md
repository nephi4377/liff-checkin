# Knowledge: 假勤與排班系統 (Attendance & Schedule System)
> 本文件為系統介面契約 (Interface Contract)，詳述 API 通訊規格與核心函式之輸入輸出。

## 🌐 1. 後端端點規格 (Backend API Specs)
- **URL**: `https://script.google.com/macros/s/AKfycbz5-DUPNNciVdvE5wrOogNgxYt8EpDZppAe9f2cUh8pW9y3i29fB6n0RA5r-A5KuAiz/exec`
- **Method**: `GET`
- **Inputs (Query Params)**:
  - `year` (Number): e.g. `2026`
  - `month` (Number): `1` ~ `12`
- **Outputs (JSON Response Structure)**:
  ```json
  {
    "schedule": {
      "U123456...": {
        "2026-02-01": "上班",
        "2026-02-02": "特休[08:30-17:30]",
        "2026-02-03": "事假"
      }
    },
    "holidays": ["2026-02-08", "2026-02-09"]
  }
  ```

---

## 📖 2. API 函式辭典 (JS Interface Dictionary)

### 🟢 `getScheduleDataForMonth`
- **Input**:
  - `year` (Number)
  - `month` (Number)
- **Output**: `Promise<Object>` (回傳上述的 JSON 結構，其中 `holidays` 會轉為 `Set`)
- **使用範例**:
  ```javascript
  const data = await window.dailyReportApp.getScheduleDataForMonth(2026, 2);
  ```

### 🟢 `getLeaveStatus`
- **Input**:
  - `userId` (String): 員工 LINE UserID
  - `dateStr` (String): 格式 `YYYY-MM-DD`
  - `scheduleData` (Object): 來自 `getScheduleDataForMonth` 的完整物件
- **Output**: `String | null`
  - 成功匹配時：回傳簡化假別 (e.g. `"特休"`, `"事假"`)
  - 查無請假或上班時：回傳 `null`
- **判定邏輯**: 
  `if (status.includes('休') || status.includes('假'))` -> 視為請假。

### 🟢 `updateKPIDashboard`
- **Input**:
  - `employees` (Array): 全體員工物件陣列
  - `reportsByUserId` (Object): 以 UserID 為鍵的日報分組
  - `scheduleData` (Object): 假勤快取數據
- **Output**: `void` (直接操作 DOM 渲染 KPI 名單與數字)

---

## 🧠 3. 核心業務判定 (Business Logic Rules)

### 3.1 狀態判定模型 (Attendance Matrix)
系統採用「打卡紀錄 (Checkin)」與「回報紀錄 (Daily Report)」交叉比對機制：

| 狀態 | 判定條件 | UI 表現 |
| :--- | :--- | :--- |
| **今日出勤 (Attendance)** | 當日有 **「上班打卡」** 紀錄 (由考勤系統 API 驅動) | 🟢 顯示於戰情室 |
| **今日請假 (Leave)** | 班表有「休/假」且 **當日無打卡** | 🏖️ 顯示於戰情室 |
| **缺交報告 (Missing)** | (有上班打卡 OR 無全天假) 且 **回報數 === 0** | ⚠️ 紅色警告 |

### 3.2 時段假 (Partial Leave) 處理
*   **格式解析**：系統解析 `[HH:mm~HH:mm]` 格式 (例如 `特休[13:00~17:00]`)。
*   **判定規則**：若請假時段小於 6 小時 (半天假)，系統仍視為 **「應出勤」**，若未交報告則會觸發 ⚠️ 警告。
*   **顯示方式**：在時間軸補完模式下，加註原始假勤時段 (e.g. `⚠️ 缺交報告 [特休 13:00~17:00]`)。

### 3.3 KPI 戰情室時戳偏移 (Dashboard Offset)
*   **主動偏移**：當首頁日期選擇「今日」時，**「缺交報告」** 欄位會自動切換為 **「昨日統計」**。
*   **設計初衷**：解決上午打開系統時，因今日尚未到下班時間而產生的「大量偽缺交」視覺壓迫感。

---
*Refined by Antigravity v1.0.7 @ 2026-02-25*
