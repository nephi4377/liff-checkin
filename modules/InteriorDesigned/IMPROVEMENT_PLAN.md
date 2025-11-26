# LayoutPlanner 改進計劃

## 📋 現況分析

### 程式架構
- **主檔案**：LayoutPlanner.html + LayoutPlanner.js (1739 行)
- **工具函式**：utils.js (81 行) - 通知系統
- **狀態管理**：全局變數 + Google Sheets 動態載入
- **框架**：Tailwind CSS + 原生 JavaScript
- **功能特性**：
  - ✅ 室內設計互動規劃工具
  - ✅ 元件拖放和調整
  - ✅ 區域繪製（天花板/地板）
  - ✅ 動態計價系統
  - ✅ PDF 匯出
  - ✅ 佈局儲存/載入
  - ✅ 復原/重做
  - ✅ 手機版提示

### LINE 聯繫功能現況
- **實現位置**：3 處 (浮動按鈕 + 預算 Modal + 手機版)
- **實現方式**：LINE 官方連結 `https://line.me/R/ti/p/@uis9604v`
- **額外功能**：LINE ID 複製功能

---

## 🔴 當前問題

### 已發現的問題
1. **QR Code 出現**（用戶反饋）
   - LINE 連結可能在某些情況下產生 QR Code
   - 掃描報錯可能是連結格式問題

2. **可能的根本原因**
   - [ ] 瀏覽器/設備環境問題
   - [ ] LINE 連結格式還需最佳化
   - [ ] 使用者代理偵測不完整
   - [ ] 備用方案不夠完善

---

## 🟡 潛在風險

### 代碼質量問題
1. **全局變數過多**
   - 超過 30 個全局變數，難以追蹤狀態
   - 容易產生命名衝突和副作用
   - 建議：轉換為模組化架構 (Class/Object)

2. **事件監聽器管理**
   - 多個地方使用 `addEventListener`
   - 沒有集中的事件管理器
   - 建議：建立事件委派系統

3. **錯誤處理不足**
   - Google Sheets 載入失敗沒有重試機制
   - 拖放操作異常無適當補救
   - 建議：新增錯誤邊界和重試機制

4. **性能瓶頸**
   - 大型 SVG 繪圖（2000x2000px）
   - 頻繁的 DOM 操作
   - 無虛擬化或懶加載
   - 建議：實現 Canvas 或 WebGL 渲染

### 功能缺陷
1. **缺少數據驗證**
   - 使用者輸入沒有驗證
   - Google Sheets 資料格式假設
   - 建議：新增 Zod/Yup 模式驗證

2. **移動設備支援不完善**
   - 僅提示不支援，沒有簡化版本
   - 觸摸事件未最佳化
   - 建議：實現響應式設計或手機版本

3. **缺少分析和日誌**
   - 無法追蹤使用者行為
   - 無法診斷故障
   - 建議：整合 Google Analytics + 錯誤日誌

---

## 🟢 改進計劃 (優先級排序)

### **優先級 1：關鍵 (立即修復)**

#### 1.1 修復 LINE 聯繫功能
**問題**：QR Code 和連結報錯
**解決方案**：
```javascript
// 方案 1：改用更穩定的連結格式
const LINE_URLS = {
    official: 'https://line.me/R/ti/p/@uis9604v',  // 官方帳號
    direct: 'line://ti/p/@uis9604v',               // 深層連結
    backup: 'https://lin.ee/XX'                    // 短連結（待設定）
};

// 方案 2：實現 Fallback 機制
function openLineOfficialAccount() {
    const userAgent = navigator.userAgent;
    const isNative = /Line/i.test(userAgent);
    
    if (isNative) {
        window.location.href = LINE_URLS.direct;
    } else {
        window.open(LINE_URLS.official, '_blank');
    }
    
    // 顯示替代聯繫方式
    showContactAlternatives();
}
```

**預期結果**：
- ✅ 直接開啟 LINE App（已安裝時）
- ✅ 開啟網頁版（未安裝時）
- ✅ 提供手動搜尋選項
- ✅ 無 QR Code 出現

**工作量**：2-4 小時
**優先級**：🔴 **立即**

---

#### 1.2 新增複合式聯繫選項
**問題**：單一連結可能失效
**解決方案**：
```html
<!-- 新增聯繫對話框 -->
<div id="contact-modal" class="modal">
    <div class="modal-content">
        <h3>選擇聯繫方式</h3>
        <button class="contact-option">
            💬 LINE 官方帳號
            <span>@uis9604v</span>
        </button>
        <button class="contact-option">
            📱 複製 LINE ID
        </button>
        <button class="contact-option">
            📧 電子郵件
        </button>
        <button class="contact-option">
            ☎️ 電話號碼
        </button>
    </div>
</div>
```

**工作量**：4-6 小時
**優先級**：🟡 **高**

---

### **優先級 2：重要 (本週內)**

#### 2.1 代碼重構：模組化架構
**問題**：全局變數太多，難以維護
**解決方案**：
```javascript
// 轉換為 Class 架構
class DesignState {
    constructor() {
        this.placedCabinets = [];
        this.selectedCabId = null;
        this.bgEditMode = false;
        this.history = [];
    }
    
    addCabinet(cabinet) { /* ... */ }
    removeCabinet(id) { /* ... */ }
    undo() { /* ... */ }
}

class DesignCanvas {
    constructor(element) {
        this.element = element;
        this.state = new DesignState();
        this.setupEventListeners();
    }
}

// 使用
const designTool = new DesignCanvas(document.getElementById('design-canvas'));
```

**工作量**：20-30 小時
**優先級**：🟡 **中期**

---

#### 2.2 事件系統現代化
**問題**：事件監聽器分散、難以管理
**解決方案**：
```javascript
class EventManager {
    constructor() {
        this.listeners = new Map();
    }
    
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }
    
    emit(event, data) {
        this.listeners.get(event)?.forEach(h => h(data));
    }
    
    off(event, handler) { /* ... */ }
}

// 使用
eventBus.on('cabinetAdded', (cabinet) => {
    updateQuotation();
});
```

**工作量**：8-12 小時
**優先級**：🟡 **中期**

---

#### 2.3 錯誤處理和日誌系統
**問題**：無法追蹤問題發生原因
**解決方案**：
```javascript
class Logger {
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${level}: ${message}`, data);
        
        // 可選：發送到遠端日誌服務
        if (level === 'error') {
            this.sendToServer(level, message, data);
        }
    }
}

// 使用
try {
    await loadFromSheets();
} catch (error) {
    logger.error('Failed to load from Sheets', { error, sheetId });
    showGlobalNotification('資料載入失敗，請重試', 3000, 'error');
}
```

**工作量**：6-10 小時
**優先級**：🟡 **中期**

---

### **優先級 3：增強 (月度計劃)**

#### 3.1 手機版支援
**目標**：提供實際可用的手機版本
**方案**：
- 簡化工具介面
- 觸摸最佳化
- 單點搜尋設計
- 卡片式佈局

**工作量**：30-50 小時
**優先級**：🟢 **未來**

---

#### 3.2 性能最佳化
**目標**：提升大型佈局的性能
**方案**：
- [ ] 改用 Canvas 或 Three.js 渲染
- [ ] 實現虛擬化滾動
- [ ] 懶加載元件圖片
- [ ] 壓縮和快取策略

**工作量**：40-60 小時
**優先級**：🟢 **未來**

---

#### 3.3 協作功能
**目標**：支援多人共享和編輯
**方案**：
- 實時同步 (WebSocket/Firestore)
- 版本控制和歷史記錄
- 使用者權限管理
- 評論和標記功能

**工作量**：50-100 小時
**優先級**：🟢 **未來**

---

#### 3.4 分析和追蹤
**目標**：了解使用者行為
**方案**：
- Google Analytics 整合
- 元件使用率統計
- 平均佈局時間
- 轉換漏斗追蹤

**工作量**：4-8 小時
**優先級**：🟢 **未來**

---

## 📊 改進優先矩陣

```
┌─────────────────────────────────────────┐
│ 優先級 │ 工作量    │ 影響度 │ 難度  │ 計劃
├─────────────────────────────────────────┤
│ 1.1   │ 2-4h    │ 高   │ 低   │ 立即
│ 1.2   │ 4-6h    │ 中   │ 中   │ 本週
│ 2.1   │ 20-30h  │ 高   │ 高   │ 下月
│ 2.2   │ 8-12h   │ 中   │ 中   │ 下月
│ 2.3   │ 6-10h   │ 中   │ 低   │ 下月
│ 3.1   │ 30-50h  │ 中   │ 高   │ 3 月
│ 3.2   │ 40-60h  │ 高   │ 高   │ 3 月
│ 3.3   │ 50-100h │ 中   │ 極高  │ 4 月+
│ 3.4   │ 4-8h    │ 低   │ 低   │ 下月
└─────────────────────────────────────────┘
```

---

## 🎯 建議的短期行動計劃 (2 週)

### 第 1 週
- [ ] **1.1** 修復 LINE 聯繫功能
  - 測試多種瀏覽器和設備
  - 實現 Fallback 機制
  - 驗證無 QR Code 出現

- [ ] **1.2** 新增聯繫對話框
  - 設計 UI 模型
  - 實現多個聯繫選項
  - 測試所有選項

### 第 2 週
- [ ] **2.3** 基礎日誌系統
  - 實現 Logger 類
  - 在關鍵位置新增日誌
  - 監控 Google Sheets 載入

- [ ] **文檔更新**
  - 更新使用說明
  - 記錄 LINE 聯繫最佳實踐
  - 建立故障排除指南

---

## 📋 檢查清單

### 代碼品質
- [ ] 執行 ESLint 檢查
- [ ] 添加 JSDoc 註解
- [ ] 實現單元測試
- [ ] 性能監控

### 功能驗證
- [ ] 跨瀏覽器測試 (Chrome, Safari, Firefox, Edge)
- [ ] 跨設備測試 (Windows, Mac, iOS, Android)
- [ ] 網路速度測試 (3G/4G)
- [ ] 離線功能測試

### 安全性
- [ ] 驗證 Google Sheets 存取權限
- [ ] 檢查敏感資料洩露
- [ ] 實現 CSP 政策
- [ ] CORS 設定審核

---

## 📞 所需資訊

請提供以下資訊以加速改進：

1. **LINE 帳號資訊**
   - [ ] 是否有官方網頁版連結？(line://xxx 或 https://...)
   - [ ] 是否有短連結 (lin.ee/xxx)？

2. **替代聯繫方式**
   - [ ] 電話號碼
   - [ ] 電子郵件
   - [ ] WeChat / WhatsApp / 其他

3. **使用環境**
   - [ ] 主要目標客戶設備類型？(手機/電腦)
   - [ ] 網路環境限制？(公司 WiFi/行動數據)
   - [ ] 訪問統計數據？(日均使用者數)

4. **業務需求**
   - [ ] 是否需要轉換追蹤？(點擊到 LINE 的轉換率)
   - [ ] 是否需要協作功能？
   - [ ] 未來是否考慮行動應用化？

---

## 📝 文件回顧

已生成的文檔：
- `IMPLEMENTATION_SUMMARY.md` - LINE 功能實現詳述
- `plan-addLineContactCTA.prompt.md` - 初始計劃
- `IMPROVEMENT_PLAN.md` - 本文件

---

## 下一步行動

**立即建議**：
1. 確認 LINE 官方帳號的最佳連結格式
2. 測試當前實現在真實設備上的表現
3. 蒐集使用者反饋（QR Code 問題的細節）
4. 決定是否進行代碼重構

**聯繫我以**：
- 修復緊急問題
- 實現短期改進
- 規劃長期架構升級

---

*計劃生成於 2025-11-26*
*預計下次審查：2025-12-03*
