# LINE 聯繫鼓勵訊息 - 實現總結

## 實現日期
2025年11月26日

## 實現概況
已成功將 LINE 聯繫鼓勵功能整合到 LayoutPlanner.html 和 LayoutPlanner.js 中。

---

## 1. HTML 更新 (LayoutPlanner.html)

### 1.1 新增樣式 (CSS)
在 `<style>` 標籤中新增：
- `.contact-btn` - LINE 聯繫按鈕主要樣式（綠色漸層）
- `.contact-card` - 聯繫卡片容器樣式
- `.contact-card-title` - 卡片標題樣式
- `.contact-line-id` - LINE ID 顯示區塊樣式

**特色**：
- 採用 LINE 官方綠色 (#06C755)
- 懸停效果：陰影增強 + 向上移動
- 配合 Tailwind CSS 框架

### 1.2 手機版提示訊息更新
在 `#mobile-warning` 區塊中新增：
```html
<!-- [新增] LINE 聯繫區塊 -->
<div class="contact-card mt-6">
    <div class="contact-card-title">💬 快速聯繫</div>
    <p class="text-sm text-gray-600 mb-3">使用 LINE 與我們聯繫</p>
    <button id="mobile-contact-line-btn" class="w-full contact-btn mb-2">加入 LINE 官方帳號</button>
    <div class="text-xs text-gray-500 mt-2 p-2 bg-white rounded">
        <p>或直接搜尋：</p>
        <p class="contact-line-id mt-1" id="mobile-line-id-copy">@uis9604v</p>
        <p class="text-[10px] mt-1 text-gray-400">點擊複製 LINE ID</p>
    </div>
</div>
```

**位置**：手機版警告視窗中，品牌名稱下方

### 1.3 主畫面右下角浮動按鈕
在 `#minimized-bar` 中新增：
```html
<!-- [新增] LINE 聯繫按鈕 -->
<button id="contact-designer-btn" class="contact-btn">💬 聯繫設計師</button>
```

**特色**：
- 採用綠色 LINE 品牌按鈕樣式
- 與現有工具箱和預算按鈕並列
- 視覺上突出，鼓勵使用者聯繫

### 1.4 預算明細 Modal 更新
在預算 Modal 的匯出按鈕下方新增：
```html
<!-- [新增] 諮詢詳細報價區塊 -->
<div class="mt-6 border-t pt-4">
    <div class="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <h3 class="font-bold text-green-800 mb-2">📞 需要詳細報價？</h3>
        <p class="text-sm text-gray-700 mb-3">以上報價為根據目前設計的初步估算。若需更精準的報價、材料選項或專業建議，歡迎與我們聯繫進行面對面諮詢。</p>
        <button id="modal-contact-line-btn" class="w-full contact-btn text-sm py-2">🏢 加入 LINE 諮詢詳細方案</button>
    </div>
</div>
```

**位置**：CSV 和 PDF 匯出按鈕下方
**策略**：在使用者審視預算時，主動提出專業諮詢機會

---

## 2. JavaScript 更新 (LayoutPlanner.js)

### 2.1 新增全局常數
```javascript
const LINE_ID = '@uis9604v';
const LINE_DEEP_LINK = 'line://ti/@uis9604v';
const LINE_WEB_URL = 'https://lin.ee/'; // 如有短連結可替換
```

### 2.2 新增 LINE 聯繫函式

#### `openLineOfficialAccount()`
功能：
1. 偵測用戶設備和瀏覽器環境
2. 優先嘗試使用 LINE 深層連結 (`line://ti/@uis9604v`)
3. 若無法開啟，自動回退到複製 LINE ID 的功能
4. iOS 和其他設備有特殊處理邏輯

**邏輯流程**：
```
user click → 偵測 LINE App → 嘗試深層連結 → 超時回退 → 複製 ID 並提示
```

#### `copyLineId()`
功能：
1. 將 LINE ID `@uis9604v` 複製到系統剪貼簿
2. 顯示成功通知訊息
3. 如複製失敗，顯示備用提示

### 2.3 事件監聽器綁定
在 `bindEventListeners()` 函式中新增：
```javascript
// [新增] LINE 聯繫按鈕事件
document.getElementById('contact-designer-btn').addEventListener('click', openLineOfficialAccount);
document.getElementById('modal-contact-line-btn').addEventListener('click', openLineOfficialAccount);
const mobileContactLineBtn = document.getElementById('mobile-contact-line-btn');
if (mobileContactLineBtn) {
    mobileContactLineBtn.addEventListener('click', openLineOfficialAccount);
}
const mobileLineIdCopy = document.getElementById('mobile-line-id-copy');
if (mobileLineIdCopy) {
    mobileLineIdCopy.addEventListener('click', copyLineId);
}
```

---

## 3. 用戶交互點

### 3.1 桌面版 (Desktop)
1. **右下角浮動按鈕**：「💬 聯繫設計師」
   - 最顯眼的呼籲行動 (CTA)
   - 隨時可點擊，開啟 LINE 聯繫流程

2. **預算明細視窗**：「📞 需要詳細報價？」
   - 在經濟決策時點提供聯繫選項
   - 強化報價轉換機會

### 3.2 手機版 (Mobile)
1. **手機警告視窗**：完整的 LINE 聯繫卡片
   - 提供「加入 LINE 官方帳號」按鈕
   - 顯示 LINE ID `@uis9604v`，支援點擊複製
   - 引導使用者透過 LINE 聯繫設計師

---

## 4. LINE 聯繫方式

### 4.1 優先順序
1. **最佳方案**：直接開啟 LINE App
   - 使用深層連結 `line://ti/@uis9604v`
   - 用戶已安裝 LINE 時最順暢

2. **備用方案**：複製 LINE ID
   - 提供 `@uis9604v` 讓使用者手動搜尋
   - 適用於無法開啟連結的情況

### 4.2 LINE 帳號資訊
- **官方帳號**：`@uis9604v`
- **品牌名稱**：添心設計 (InteriorDesigned)
- **深層連結**：`line://ti/@uis9604v`

---

## 5. 視覺設計特點

| 項目 | 設計 |
|------|------|
| 主色 | LINE 綠色 #06C755 |
| 按鈕樣式 | 漸層綠色，圓角 30px |
| 文案風格 | 友善親切，帶有 emoji 圖示 |
| 位置 | 浮動 + Modal + 手機提示 |
| 互動反饋 | 懸停陰影增強 + 向上移動 |

---

## 6. 測試檢查清單

- [x] 桌面版「聯繫設計師」按鈕顯示正確
- [x] 預算 Modal 中的「詳細報價」呼籲顯示正確
- [x] 手機版警告視窗中有 LINE 聯繫選項
- [x] 點擊按鈕能正確執行 `openLineOfficialAccount()`
- [x] LINE ID 複製功能正常運作
- [x] 樣式與現有頁面風格一致
- [x] 所有事件監聽器綁定成功

---

## 7. 部署說明

### 檔案更新
- `LayoutPlanner.html` - HTML 結構 + CSS 樣式
- `LayoutPlanner.js` - JavaScript 邏輯 + 事件綁定

### 部署方式
1. 直接覆蓋現有檔案
2. 無需額外依賴或 npm 套件
3. 相容所有現代瀏覽器

### 驗證方式
在瀏覽器控制台測試：
```javascript
// 測試 LINE 聯繫函式
openLineOfficialAccount();  // 應開啟 LINE 或複製 ID

// 測試複製函式
copyLineId();               // 應顯示成功提示
```

---

## 8. 未來優化方向

- [ ] 新增 LINE 官方帳號的 QR 碼圖片 (在無連結方案時使用)
- [ ] 記錄用戶點擊聯繫按鈕的統計數據 (GA/Analytics)
- [ ] 新增微信 (WeChat) 聯繫方式
- [ ] 建立短連結 (line://xxx) 用於報價單底部
- [ ] 多語言支援 (英文、中文繁簡體)
- [ ] 整合聊天機器人自動回覆初始訊息

---

## 9. 聯繫資訊

**添心設計**
- LINE 官方帳號：@uis9604v
- 設計工具：LayoutPlanner 互動式室內設計規劃工具
- 實現日期：2025-11-26

---

*文件生成於 2025年11月26日*
