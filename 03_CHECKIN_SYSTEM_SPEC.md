# 添心專案：打卡系統技術規格書 (v1.0)

本文件詳述「打卡系統」的高可用性架構，包含單點匯入引擎、三段階重試機制與離線隊列處理。

## 1. 核心邏輯 (承重牆)

### 1.1 Single Sink 發送引擎
打卡數據統一流向 `api.js` 中的 `sendCheckin()` 函式，這是唯一的出入口（Zero-bypass Policy）。
- **特點**: 強制執行數據清洗與地理位置（GPS）有效性驗證。

### 1.2 三段階重試機制 (Retry Policy)
應對現場網路不穩定的核心策略：
1. **即時嘗試**: 點擊後立即發送，等待 3 秒。
2. **間歇式重試**: 失敗後進入背景隊列，每隔 1 / 5 / 15 分鐘遞增重試。
3. **離線緩存**: 若 3 次重試後仍失敗且斷網，則轉入 `IndexedDB` 待命。

### 1.3 離線隊列 (Offline Queue)
- **技術實現**: 使用 `LocalStorage` (或 `IndexedDB`) 存儲未成功的打卡封包。
- **恢復觸發**: `window.onLine` 事件與定時執行 `syncOfflineQueue()`。
- **冪等性保障**: 每個打卡包產出唯一 `EventID`，防止網路恢復後重複紀錄。

## 2. API 溝通契約

### 2.1 打卡提交
- **端點**: `CONFIG.ATTENDANCE_GAS_WEB_APP_URL`
- **動作**: `POST`
- **Payload**:
  ```json
  {
    "action": "submit_checkin",
    "userId": "Uxxxx...",
    "location": { "lat": 22.9, "lng": 120.2 },
    "type": "簽到/簽退",
    "timestamp": "2024-03-15T08:00:00Z"
  }
  ```

## 3. 部署記錄與監控
- 打卡失敗日誌會同步寫入 `部署記錄_添心生產力助手.md` 中標記為 `[SYNC_FAILED]`。
