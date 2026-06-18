# 專案工作區與協作中心 - 前端技術規格書 (v2.0)

## 1. 核心定位
本系統 (`managementconsole.html`) 為案場資訊的綜合管理中樞，整合了施工日誌、工程排程與跨團隊協作中心。

## 2. 核心技術架構

### 2.1 事件驅動依賴管理器 (DependencyManager)
為解決多源資料非同步載入的競態問題，系統實作了訂閱制管理：
- **機制**: 透過 `subscribe(['dep1', 'dep2'], callback)` 註冊動作。
- **資料流**: 當 `state.dataReady` 中的 `projectOverview`, `projectSchedule` 等旗標變更時，自動觸發 UI 渲染。
- **優勢**: 確保如「複製案場資訊」等依賴資料的按鈕，在資料未就緒前不會發生 `undefined` 錯誤。

### 2.2 樂觀更新機制 (Optimistic UI)
- **實作**: 在施工日誌發文與溝通紀錄回覆時，系統先產生 `log-temp-*` 臨時卡片。
- **後端同步**: 待 API 回傳成功後，呼叫 `window.replaceOptimisticCard` 使用真實 ID 替換臨時卡片，提供秒級操作手感。

### 2.3 三欄式嚮應式佈局
- **左欄**: 導覽控制，支援手機版漢堡選單 (`mobile-nav-toggle`) 切換。
- **中欄**: 動態視圖切換器 (`logs`, `schedule`, `collaboration`)。
- **右欄**: 專案資訊卡片，固定顯示核心案場資料與快捷操作。

## 3. 跨模組功能整合
- **任務交辦中心**: 調用 `taskSender.js` 實現任務派發與追蹤。
- **極速傳輸 V2**: 繼承自回報系統的 Firebase 傳輸邏輯，確保照片管理模組的高效能。

---
> [!IMPORTANT]
> 進行排程調整時，系統會自動依據「狀態」與「日期」進行複合排序，修改 `handleDataResponse` 時須注意此邏輯的一致性。
