# 線上假勤申請系統 - 前端技術規格書 (v2.0)

## 1. 核心定位
本系統 (`leave_request.html`) 負責處理員工的請假、加班申請與歷程查詢，並具備與父層 SPA 同步的人員資料管理能力。

## 2. 核心技術架構

### 2.1 跨框架資料共享機制
- **資料源優先級**:
    1. **SPA 快取**: 優先從 `window.parent.spaAllEmployees` 讀取資料，減少 API 往返。
    2. **API 後備**: 若獨立開啟或 SPA 無資料，則向 GAS 發送 `get_employees` 請求。
- **身分驗證**: 支援 **LIFF 內嵌模式** 與 **本地測試模式**（跳過身分檢查）。

### 2.2 「原地補件」狀態機 (Supplement Logic)
- **觸發條件**: 當假單狀態為「待補件」或「病假/公假報備後」觸發。
- **實作細節**: 
    - 透過 `renderSupplementForm(timestamp)` 動態展開原地表單。
    - **UI 隔離**: 補件時自動隱藏主表單欄位，透過 `form.dataset.mode = 'update'` 鎖定工作流。
    - **傳輸協議**: 使用 `readFileAsBase64` 處理證明文件，並透過 `action: 'supplement'` 送至 GAS 指定紀錄。

### 2.3 UI 莫蘭迪色系規範
系統採用低飽和度色彩進行視覺分類：
- **事假**: `bg-stone-200`
- **病假**: `bg-rose-200` (強制觸發補件提醒)
- **特休**: `bg-teal-200`
- **補休**: `bg-sky-200`

## 3. 防禦性程式設計
- **時間選單動態生成**: 根據 URL 傳入的 `shiftStart`/`shiftEnd` 動態渲染 15 分鐘一格的時間選項。
- **表單重置協議**: `_resetFormToNewMode_()` 負責徹底清除 `dataset` 與鎖定狀態，防止髒數據提交。

---
> [!IMPORTANT]
> 修改 `leaveType` 邏輯時，務必同步更新 `APP_SETTINGS.LEAVE_TYPE_COLORS` 以維持視覺一致性。
