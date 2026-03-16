# 添心專案：專案工作區技術規格書 (v1.0)

本文件詳述「專案中控台 (Management Console)」的架構，包含三欄式佈局、依賴管理與跨模組通訊。

## 1. 核心架構 (承重牆)

### 1.1 依賴管理器 (DependencyManager)
中控台採用事件驅動的 `DependencyManager` 模式，確保在多樣異步請求（總覽、排程、員工資料）皆就緒後才渲染 UI。
- **訂閱機制**: `dependencyManager.subscribe(['A', 'B'], callback)`。
- **好處**: 解決 Iframe 內載入順序不確定的 Race Condition。

### 1.2 樂觀更新 (Optimistic UI)
針對溝通紀錄與日誌發文，系統優先在前端顯示「虛擬卡片」，同步發起後端請求。
- **回調替換**: 使用 `window.replaceOptimisticCard(tempId, finalData)` 將虛擬卡片無效替換為真實資料。

### 1.3 三欄式響應式設計
- **左欄**: 導覽導流，手機模式下隱藏為漢堡選單。
- **中欄**: 主要工作區（日誌/排程/協作中心），支援無限滾動與圖片懶加載。
- **右欄**: 專案概要卡片，支援一鍵複製進場資訊。

## 2. 跨模組通訊 (Cross-module Communication)
- **與 LayoutPlanner 通訊**: 使用 `postMessage` 廣播 `LAYOUT_SAVED` 訊號。
- **與 GAS 通訊**: 基於 `projectApi.js` 的統一請求層，支援自動輪詢 (Polling) GAS 長期任務進度。

## 3. 認證流 (Auth Flow)
- **混合模式**:
  - `Independent`: 直接通過 LIFF 驗證獲取 `userId`。
  - `Embedded`: 接收來自父層 URL 的 `uid` 與 `name` 參數，略過 LIFF 認證加速體驗。
