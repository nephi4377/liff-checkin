# 員工打卡系統 - 穩定性與同步技術規格 (v2.0)

## 1. 核心定位
本系統 (`checkin.html`) 為全專案對穩定性要求最高的「承重牆」模組，具備在地圖環境不穩下的極佳容錯與數據完整性。

## 2. 關鍵技術實作

### 2.1 Single Sink 調度引擎 (AppAPI.dispatch)
- **併發防護**: 利用 `isDispatching` 旗標鎖定，確保在回傳前不會重複發起請求。
- **來源識別**: 自動判定 `source` 為 `hub` (主控台), `assistant` (小助手) 或 `richmenu` (LINE 菜單)。

### 2.2 高階斷網容錯 (Resilience)
- **寬限期重試**: 偵測到實體斷網時，進入 **5 秒寬限期**，顯示倒數 UI 並等待自動恢復。
- **三段階重試 (Retry Policy)**: 針對 5xx 錯誤或 API 逾時自動執行 3 次重試，每次遞增等待時間。

### 2.3 離線紀錄隊列 (Offline Queue)
- **持久化儲存**: 失敗紀錄暫存於 `checkin_offline_queue` (localStorage)。
- **自動同步**: 系統啟動 (liff.init) 後自動觸發 `syncAll()`，將隊列紀錄依序補傳至 GAS。
- **去重機制**: 每一筆紀錄具備唯一的 `pageInstance` ID，防止補傳時造成重複打卡。

### 2.4 GPS 擷取協議 (AppGeo)
- **高精確模式**: 強制開啟 `enableHighAccuracy`。
- **逾時控制**: 鎖定 12,000ms 擷取上限，防止 GPS 模組喚醒失敗導致頁面卡死。

## 3. 核心設計規範
- **視覺反饋**: 包含 `LINE`, `Network`, `Location` 三大燈號狀態指示。
- **自動關閉**: 成功後鎖定按鈕並啟動 45 秒倒數自動關閉 `liff.closeWindow()`。

---
> [!CAUTION]
> 嚴禁修改 `CONSTANTS` 中的逾時設定，這將直接影響案場弱網環境下的打卡成功率。
