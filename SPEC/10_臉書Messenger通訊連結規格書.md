# Facebook Messenger 通訊連結 - 整合技術規格 (v1.0)

## 1. 核心定位
本模組旨在建立系統與 Facebook Messenger 之間的即時通訊橋樑，提供使用者便捷的客服諮詢與系統通報管道。透過「臉書聊天外掛 (Customer Chat Plugin)」或「直接深層連結 (m.me)」，實現跨平台的溝通無縫化。

## 2. 關鍵技術實作

### 2.1 臉書聊天外掛 (Facebook Customer Chat Plugin)
- **嵌入模式**: 於 SPA 殼層 (`app.js`) 載入 Facebook SDK，並根據環境變數中的 `FB_PAGE_ID` 初始化聊天外掛。
- **客製化外掛內容**: 
    - **歡迎語**: 設定符合品牌風格的自動歡迎詞。
    - **主題色彩**: 採用與「添心設計」配色系統一致的色彩。

### 2.2 直接通訊深層連結 (m.me Deep Link)
- **按鈕觸發**: 於「聯絡我們」或導航側欄新增 FB Messenger 圖示按鈕。
- **導引路徑**: 點擊後直接導往 `https://m.me/your-page-id`，自動喚起手機端 Messenger App 或桌面端網頁。

### 2.3 跨平台識別與綁定 (預留)
- **UID 關聯**: 預留後續可透過 Messenger 參數 (ref) 將 FB PSID (Page-scoped ID) 與系統的 `uid` 進行綁定，以便透過 FB 發送系統通報。

## 3. UI/UX 整合規範
- **懸浮按鈕**: 右下角懸浮按鈕在行動端應具備適當的 Z-index，避免遮擋核心功能（如打卡按鈕）。
- **載入優化**: 採用非同步載入 SDK，確保外掛初始化不影響第一屏渲染效能。

---
> [!IMPORTANT]
> 部署前需確保 Facebook 粉絲專頁已將專案網域加入「允許的清單 (Whitelisted Domains)」，否則外掛將無法正常載入。
