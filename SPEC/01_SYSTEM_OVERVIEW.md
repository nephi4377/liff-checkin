# 添心設計 (CODING) 系統架構深編規格書 (v2.0)

## 1. 聯邦式架構：Vue 3 SPA + Iframe 聯邦
本系統採用「單一外殼、多模組嵌入」的架構，確保各業務模組（如出勤、設計、報表）能獨立維護而不相互干擾。

### 1.1 SPA 路由與導航機制 (`spa/app.js`)
- **路由對應表**: 透過 `routes` 物件定義 Hash 與資源路徑的映射。
- **參數注入**: 導航至 Iframe 時，系統自動從 `userProfile` 提取 `uid`, `name`, `permission` 等資訊並透過 URL Query String 注入子頁面。
- **快取優先策略**: 
    - 系統於啟動時優先載入 `localStorage` 中的 `spa_hub_employees` 與 `spa_hub_projects`。
    - **效能目標**: 確保在網路抖動時，使用者仍能立即看到基礎 UI 框架，提升感官體驗。

### 1.2 跨框架通訊協議 (Inter-frame IPC)
使用 `window.postMessage` 實現 Iframe 與 SPA 的雙向溝通：
- **SPA 監聽**: 常駐 `message` 監聽器，處理子頁面發出的 `openLightbox` 請求。
- **燈箱同步處理**: 透過 `nextTick` 強制 Vue 在複雜通訊環境下進行 DOM 更新，解決 UI 渲染遺失問題。

## 2. 核心技術棧規格
- **前端工具**: 
    - **Tailwind CSS**: 統一佈局與 UI 元素。
    - **browser-image-compression**: 前端圖片預處理核心。
- **狀態中心**: 雖然未採用 Vuex，但透過 SPA 層級的 `ref` 與 `computed` 實現輕量級響應式狀態流轉。

## 01_SYSTEM_OVERVIEW 相關模組規格書
- [FILE_DOCUMENTATION.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/FILE_DOCUMENTATION.md)：CODING 專案**檔案清冊**與路由導讀（與本深編互補）。
- [PROJECT_DATA_DICTIONARY.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/PROJECT_DATA_DICTIONARY.md)：專案**資料欄位**唯一定義表（前後端 key 以本檔為準）。
- [02_LEAVE_SYSTEM_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/02_LEAVE_SYSTEM_SPEC.md)：假勤與加班申請系統。
- [03_CHECKIN_SYSTEM_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/03_CHECKIN_SYSTEM_SPEC.md)：精確地理圍欄打卡系統。
- [05_PROJECT_WORKSPACE_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/05_PROJECT_WORKSPACE_SPEC.md)：專案主控台與異步資料管理架構。
- [14_INTERIOR_RENOVATION_QUOTATION_SYSTEM_SPEC.md](./14_INTERIOR_RENOVATION_QUOTATION_SYSTEM_SPEC.md)：室內裝修**清單式**快速報價（與 LayoutPlanner 圖面幾何計價分流）。
- [06_DESIGN_ENGINE_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/06_DESIGN_ENGINE_SPEC.md)：2D 空間設計引擎與自動計價系統 (CAT.A)。
- [07_SYSTEM_FLOW_MAP.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/07_SYSTEM_FLOW_MAP.md)：全系統功能連結全景流程圖。
- [施工回報_系統完整_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/施工回報_系統完整_SPEC.md)：施工回報 V3 ＋ GAS 現況（極速路徑、佇列、與上傳優化/遷移敘事之合併版）。歷史拆檔已於 2026-04-25 移入 `CODING/_DEPRECATED_/2026-04-25_施工回報合併前_SPEC/`。
- [10_FB_MESSENGER_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/10_FB_MESSENGER_SPEC.md)：Facebook Messenger 通訊連結規格與跨平台綁定預留。
- [11_1_AI_LOG_AND_PARAMETER_FULL_INTEGRATED_SPEC.md](file:///c:/Users/a9999/Dropbox/CodeBackups/CODING/SPEC/11_1_AI_LOG_AND_PARAMETER_FULL_INTEGRATED_SPEC.md)：AI 施工日誌與全域參數通訊整合白皮書 (詳盡版)。

## 3. 防禦性程式設計與維護
- **@stable 承重牆**: `shared/js/config.js` 為全系統配置中樞，任何 API 修改必須在此處執行。
- **Service Worker**: 負責靜態資源快取，支援離線基礎渲染。

---
> [!IMPORTANT]
> 新增模組路由時，必須同步更新 `app.js` 內的 `routes` 與 `SPEC/FILE_DOCUMENTATION.md`（專案完整檔案清冊）。
