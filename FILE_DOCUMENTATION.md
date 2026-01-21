# 📋 CODING 專案完整檔案清冊

**最後更新**: 2026年1月3日 (新增假單管理功能文檔)  
**專案名稱**: 添心設計 LIFF 打卡系統前端頁面  
**主要框架**: Vue 3 SPA + 多模組 iframe 架構

---

## 🗂️ 快速導航

| 模組 | 內容 | 檔案數 |
|------|------|--------|
| 📂 [根目錄](#1-根目錄檔案) | 主入口、工具、設定 | 7 |
| 🎨 [資源層](#2-assets-資源) | 全域樣式 | 1 |
| 🔌 [共用層](#3-shared-共用模組) | 設定、工具、組件 | 3 |
| ⚙️ [SPA 應用](#4-spa-單頁應用) | Vue 3 核心、路由、狀態 | 4 |
| 👤 [出勤管理](#51-attendance-出勤管理) | 打卡、審核、排班 | 6 |
| 📱 [資訊模組](#52-info-資訊與客戶) | 著陸頁、FAQ、客戶流程 | 5 |
| 🏗️ [室內設計](#53-interiordesigned-室內設計) | 設計工具、施工日誌、WMS | 10 |
| 📊 [專案管理](#54-projects-專案管理) | 日誌、排程、甘特圖 | 13 |
| 🔐 [後端打卡](#9-checkinsystem-打卡系統後端) | CheckinSystem GAS | 10 |
| 📚 [後端共用庫](#10-core_library-共用函式庫) | core_library GAS | 4 |
| 🎯 [後端工作區](#11-project-console-專案工作區後端) | project-console GAS | 17 |

---

## 📑 詳細目錄

- [1. 根目錄檔案](#1-根目錄檔案)
- [2. assets 資源](#2-assets-資源)
- [3. shared 共用模組](#3-shared-共用模組)
- [4. spa 單頁應用](#4-spa-單頁應用)
- [5. modules 業務模組](#5-modules-業務模組)
- [6. 模組連結與依賴](#6-模組連結與依賴)
- [7. 技術棧與版本](#7-技術棧與版本)
- [8. 使用與維護](#8-使用與維護)
- [9. CheckinSystem 後端](#9-checkinsystem-打卡系統後端)
- [10. core_library 共用庫](#10-core_library-共用函式庫)
- [11. project-console 後端](#11-project-console-專案工作區後端)
- [12. 後端系統架構圖](#12-後端系統架構圖)

---

## 1. 根目錄檔案

| 檔名 | 版本 | 功能用途 | 相依檔案 |
|------|------|---------|---------|
| **index.html** | - | 主入口頁面，掛載 Vue 3 SPA 應用，引入 Tailwind CSS 和 LINE LIFF SDK | app.js, style.css |
| **README.md** | - | 專案說明檔 | - |
| **sw.js** | v584.0 | Service Worker，實現 Google Drive 圖片快取策略，支援離線存取 | 無依賴 |
| **create_txt_backup.bat** | - | 批次備份工具，用於本地檔案備份 | 無依賴 |
| **exclude.txt** | - | 備份排除清單，定義 exclude 規則 | 無依賴 |
| **upload.bat** | - | 批次上傳工具，用於部署至線上 | 無依賴 |
| **CNAME** | - | 域名設定檔案（GitHub Pages 或 DNS） | 無依賴 |

---

## 2. assets 資源

### 2.1 CSS 樣式

| 檔名 | 版本 | 功能用途 | 相依檔案 |
|------|------|---------|---------|
| **style.css** | v12.0 | 全域樣式表，定義莫蘭迪色系、響應式布局、CSS 變數、自訂組件樣式 | index.html |

<details>
<summary><b>🎨 樣式特色設定</b> (點擊展開)</summary>

- 莫蘭迪配色方案（低飽和度）
- CSS 自訂屬性（Custom Properties）
- Tailwind CSS 整合樣式
- 響應式設計斷點（sm, md, lg, xl）
- 深色模式支援

</details>

---

## 3. shared 共用模組

### 3.1 共用 JavaScript 函式庫

| 檔名 | 版本 | 功能用途 | 相依檔案 | 匯出函式 |
|------|------|---------|---------|---------|
| **config.js** | v1.0 | **統一設定中樞** - 集中管理所有 LIFF ID、API 端點、環境變數 | 無依賴 | `LIFF_IDS`, `API_CONFIG`, `GAS_WEB_APP_URLS` |
| **taskSender.js** | v7.0 | **可重用任務交辦元件** - 支援 hub 和 console 兩種樣式，包含收件人選擇、動作類型、優先權、時限設定 | config.js | `initializeTaskSender()`, `sendTask()`, `validateTask()` |
| **utils.js** | - | 全域工具函式庫，提供通知、API 呼叫、圖片批量加載等共用功能 | config.js | `showGlobalNotification()`, `batchLoadImages()`, `debounce()`, `throttle()` |

---

## 4. spa 單頁應用

### 4.1 Vue 3 SPA 核心

| 檔名 | 版本 | 功能用途 | 相依檔案 | 核心功能 |
|------|------|---------|---------|---------|
| **app.js** | v391+ | **Vue 3 SPA 主應用** - 核心路由系統、全域快取管理、Loading 態、燈箱功能、模組整合 | config.js, utils.js, style.css | 20+ 路由、狀態管理、快取、通知 |
| **dashboard.config.js** | - | 儀表板配置（當前為空檔案） | - | - |
| **ProjectBoard.js** | - | 專案看板內置元件，支援專案快速選擇與切換 | app.js | `renderProjectBoard()` |
| **IframeView.js** | - | Iframe 頁面整合容器元件，統一管理所有業務模組的 iframe 載入 | app.js | `loadIframeModule()`, `unloadIframeModule()` |

---

## 5. modules 業務模組

### 5.1 attendance 出勤管理

**模組說明**: 員工打卡、假勤管理、排班系統、出勤儀表板等出勤相關功能

| 檔名 | 版本 | 主要功能 | 使用者角色 | 後端 API |
|------|------|---------|----------|---------|
| **checkin.html** | v25.11.01.1656 | 員工打卡頁面 | 員工 | `recordCheckin()` |
| **approval_dashboard.html** | v31.0 | 假勤審核儀表板 | 主管、HR | `getLeaveRequests()`, `approveLeave()`, `rejectLeave()` |
| **attendance_report.html** | v1.0 | 出勤儀表板 | 主管、HR | `getAttendanceStats()`, `getAbsentees()` |
| **leave_request.html** | - | 線上假勤申請 | 員工 | `submitLeaveRequest()`, `uploadAttachment()` |

<details>
<summary><b>📋 leave_request.html 詳細動作說明與功能解析</b> (點擊展開)</summary>

#### 📌 核心功能概述
線上假勤申請系統，支援多種假別、加班補登、證明文件上傳，以及假單管理與補件流程。具備分頁式 UI、智慧時間選擇、圖片自動壓縮等高級功能。

#### 🎨 前端技術棧
- **框架**: HTML5 + Tailwind CSS v3 + JavaScript (Module 模式)
- **互動庫**: browser-image-compression (圖片壓縮)
- **身份驗證**: LINE LIFF SDK v2
- **圖表/預覽**: 縮圖預覽、動態顏色標籤（莫蘭迪色系）

#### 📊 頁面結構 (4 個分頁標籤)

| 分頁 | 用途 | 適用角色 | 主要元素 |
|------|------|---------|---------|
| **請假申請** | 提交請假申請 | 所有員工 | 假別選擇、日期/時間、事由說明、證明上傳 |
| **加班申請** | 補登加班紀錄 | 所有員工 | 加班費/補休選擇、開始/結束時間、事由 |
| **我的假單** | 查看個人假單歷史 | 所有員工 | 狀態標籤、操作按鈕（撤回、取消、補件） |
| **假單管理** | 審核與管理假單（管理者用） | HR/主管(權限≥4) | 批准/駁回、編輯、批量操作 |

#### 🔧 核心功能與動作說明

##### 1️⃣ **請假申請流程**
```
使用者選擇假別
    ↓
輸入開始/結束日期時間
    ↓
填寫事由說明（必填/選填視假別而定）
    ↓
上傳證明文件（JPG/PNG，建議≤5MB）
    ↓
按「送出申請」 → 後端驗證 → 寫入 Google Sheets
    ↓
立即回傳確認訊息與追蹤碼
```

**支援假別及規則**:
- 🔴 **事假**: 需於 2 小時前提出；緊急情況直接聯繫主管
- 🔴 **病假**: 可先報備，需於 3 日內補交證明；此時會顯示補件提醒
- 🔴 **特休**: 需於 3 個工作日前提出；無特殊限制
- 🔴 **補休**: 需於 30 分鐘前提出；可搭配時間選擇器自動調整
- 🔴 **公假**: 可先報備；同病假流程，需補交相關文件
- 🔴 **婚假/喪假**: 按勞基法規定；需提交正式證件

##### 2️⃣ **加班補登流程**
```
選擇補償方式（加班費 或 補休）
    ↓
設定加班開始時間 (預設為下班時間)
    ↓
設定加班結束時間 (智慧推薦下一個 15 分鐘單位)
    ↓
填寫事由（如「客戶會議延時」）
    ↓
送出 → 後端記錄至「加班紀錄」表
```

**時間選擇特性**:
- 請假時: 預設範圍為班表內時間（如 08:30~17:30）
- 加班時: 全天 24 小時範圍（07:00~23:45，15分鐘為最小單位）
- 日期連動: 自動校正若「結束日期」早於「開始日期」

##### 3️⃣ **圖片上傳與自動壓縮**
```
使用者選擇 JPG/PNG 檔案
    ↓
browser-image-compression 庫進行品質檢查
    ↓
若超過 5MB 自動壓縮至目標大小
    ↓
生成縮圖預覽 (max-width: 200px)
    ↓
轉換為 Base64 → 隨表單提交至後端
```

**支援格式**: JPG, PNG  
**建議大小**: ≤5MB  
**壓縮目標**: 維持清晰度同時減少大小  

##### 4️⃣ **我的假單 - 查看與操作**

**假單卡片顯示內容**:
```
┌─────────────────────────────────────┐
│ 假別類型             狀態標籤        │
│ 開始時間 ~ 結束時間                │
│ 事由說明 (若有)                    │
├─────────────────────────────────────┤
│ [撤回申請] [取消申請] [上傳證明]    │
└─────────────────────────────────────┘
```

**狀態流轉與可操作按鈕**:

| 狀態 | 員工可操作 | 主管可操作 | 備註 |
|------|---------|---------|------|
| **待審核** | ✅ 撤回申請 | ✅ 批准 / 駁回 | 未開始的申請才可撤回 |
| **已批准** | ✅ 取消申請 | ✅ 編輯 / 取消 | 已開始的申請無法取消 |
| **已駁回** | ❌ 無操作 | ✅ 編輯重新提交 | 可編輯後重新送審 |
| **已報備** | ✅ 上傳證明 | ✅ 批准 / 上傳證明 | 病假/公假必經狀態 |
| **已確認** | ❌ 無操作 | ❌ 無操作 | 最終狀態 |

##### 5️⃣ **補件流程 (病假/公假必經)**
```
系統檢測到「病假」申請
    ↓
顯示「待補件」狀態與提醒訊息
    ↓
員工點擊「上傳證明」按鈕
    ↓
表單在原地展開補件輸入框
    ↓
選擇證明文件 → 填寫補充事由（可選）
    ↓
點擊「提交補件」
    ↓
後端更新 Google Sheets，標記為「已上傳」
```

**補件表單特性**:
- 📌 原地展開在卡片下方，不跳轉頁面
- 🔒 時間欄位鎖定（不可修改）
- 📝 允許追加事由說明
- 🖼️ 只接受 JPG/PNG，支援圖片壓縮

##### 6️⃣ **假單管理 (管理者模式) - 新增功能**

**可見條件**: 權限 ≥ 4 (主管/HR)

**管理介面結構**:
```
┌──────────────────────────────────────────┐
│  假單管理分頁 (新增)                      │
├──────────────────────────────────────────┤
│ 待審核假單列表 (自動每 10 分鐘刷新)      │
│                                          │
│ 假單卡片:                               │
│ ├─ 申請人: [姓名] (員工視圖無此顯示)   │
│ ├─ 假別: [事假] 狀態: [待審核]          │
│ ├─ 時間: 2026/01/05 09:00~12:00        │
│ ├─ 事由: 家中急事                      │
│ └─ [批准] [駁回] [編輯]                │
│                                          │
│ 批准/駁回面板:                          │
│ └─ 駁回理由輸入框 (駁回時展開)          │
│    [確認駁回] [取消]                   │
│                                          │
│ 編輯面板:                               │
│ └─ 可編輯欄位: 日期、時間、事由         │
│    [提交編輯] [取消]                   │
└──────────────────────────────────────────┘
```

**核心功能**:
1. ✅ **批准申請流程**
   - 點擊「批准」→ 後端寫入排班記錄表
   - 自動產生該月份的新排班版本（狀態: 已確認）
   - 更新原假單狀態為「已批准」
   - 發送系統通知給申請人

2. 🚫 **駁回申請流程**
   - 點擊「駁回」→ 展開理由輸入框
   - 輸入駁回理由 (可選) → 確認駁回
   - 後端建立駁回紀錄留供追溯
   - 發送包含拒絕原因的系統通知

3. ✏️ **編輯假單流程**
   - 點擊「編輯」→ 表單切換至「請假申請」或「加班申請」分頁
   - 根據該員工的班表重新產生時間選單
   - 修改日期、時間、事由 → 點擊「提交編輯」
   - 更新假單資料，記錄編輯者姓名與時間戳至「審核備註」

4. 🚫 **取消申請功能**
   - 只能取消「已批准」的申請
   - 待審核或其他狀態的申請由駁回功能處理
   - 取消後產生新的排班記錄移除該假勤項目

5. 📋 **定期刷新機制**
   - 使用者停留在「假單管理」分頁時，每 10 分鐘自動更新一次列表
   - 新的待審核假單會自動出現在列表上方
   - 若假單已被其他管理者處理則自動移除

**管理者操作按鈕對照表**:

| 按鈕 | 狀態條件 | 動作 | 後端處理 |
|------|---------|------|--------|
| **批准** | 待審核 | 點擊後立即批准 | 建立排班記錄，狀態→已批准 |
| **駁回** | 待審核 | 展開理由輸入框 | 建立駁回記錄，狀態→已駁回 |
| **確認駁回** | 駁回理由已填 | 確認駁回動作 | 提交理由，發送通知 |
| **編輯** | 任何狀態 | 進入編輯模式 | 修改假單資料 |
| **取消申請** | 已批准 | 取消該假勤 | 移除排班記錄中的假勤項目 |

**新增 API 端點**:

| 動作 | 路由 | 方法 | 參數 | 後端函式 | 回傳 |
|------|------|------|------|---------|------|
| **取得可管理假單** | `/attendance_api` | GET | userId, permission, mode=management | `_getMyLeaveRequests_()` | { success, data: [...] } |
| **批准/駁回假單** | `/attendance_api` | GET | action=handle_approval, decision, recordId, applicantId, approverName, reason | `_handleApprovalRequest_()` | HTML 結果頁面 + 系統通知 |
| **編輯假單** | POST | action=update_leave_request | recordId, applicantId, recordType, leaveType, startDate, startTime, endDate, endTime, reason | `_handleLeaveRequest_()` | { success, message } |

**後端核心邏輯** (CheckinLogic.js):

```javascript
/**
 * 取得我的假勤申請紀錄 (員工視圖 / 管理者視圖)
 * @param {string} userId - 申請人 ID (員工視圖) 或管理者 ID (管理者視圖)
 * @param {number} permission - 使用者權限等級
 * @param {string} mode - 'default' = 自己的假單 | 'management' = 所有待審核假單
 * @returns {object} { success, data: [...] }
 */
function _getMyLeaveRequests_(userId, permission, mode) { ... }

/**
 * 處理 Email/網頁審核: 批准或駁回假單
 * @param {object} params - { decision: 'approved'|'rejected', recordId, approverName, reason, applicantId }
 * @returns {HtmlService} 審核結果頁面
 * 
 * 核心業務邏輯:
 * - 若批准「請假」: 產生該月份新排班記錄，合併假勤項目
 * - 若批准「加班」: 記錄加班時間與補償方式
 * - 若批准「銷假」: 移除指定假勤項目，恢復上班日
 * - 若駁回: 建立駁回紀錄，發送通知
 */
function _handleApprovalRequest_(params) { ... }

/**
 * 更新假勤申請紀錄 (管理者編輯)
 * @param {object} payload - { recordId, applicantId, recordType, leaveType, startDate, startTime, endDate, endTime, reason }
 * @returns {object} { success, message }
 * 
 * 特性:
 * - 記錄編輯者姓名與時間至「審核備註」
 * - 保留原始建立時間戳
 */
function _handleLeaveRequest_(payload) { ... }
```

##### 7️⃣ **事件監聽與交互**

| 事件 | 觸發元素 | 動作 | 備註 |
|------|---------|------|------|
| `change` | `input[type="date"]` | 自動校正結束日期，確保 ≥ 開始日期 | 使用者體驗優化 |
| `change` | `input[type="file"]` | 顯示檔案名稱、生成縮圖預覽 | 提供即時反饋 |
| `click` | 日期輸入框 | 觸發原生日期選擇器（.showPicker()) | 改善行動裝置體驗 |
| `click` | 分頁標籤 | 切換內容、重置表單、載入列表 | 分頁路由邏輯 |
| `click` | 「撤回申請」 | 彈出確認對話框 → 送出 cancel_leave 請求 | 防止誤操作 |
| `click` | 「上傳證明」 | 在卡片下展開 supplementForm | 原地補件 UX |
| `click` | 「批准」/「駁回」 | 顯示駁回理由輸入框（駁回時） | 管理者審核流程 |

#### 🔌 API 端點調用

| 動作 | 端點 | 方法 | 參數 | 回傳內容 |
|------|------|------|------|---------|
| **提交請假** | `submitLeaveRequest` | POST | leaveType, startDate, endDate, reason, file | { success, message, recordId } |
| **提交加班** | `submitLeaveRequest` (mode=overtime) | POST | overtime_type, hours, startDate, compensation | { success, message } |
| **取得我的假單** | `get_my_leave_requests` | GET | userId, permission | { success, data: [...] } |
| **取得可管理假單** | `get_my_leave_requests` + mode=management | GET | userId, permission | { success, data: [...] } |
| **撤回申請** | `cancel_leave` | POST | timestamp, userId | { success, message } |
| **取消申請** | `request_leave_cancellation` | POST | timestamp, userId | { success, message } |
| **批准假單** | `approveLeave` | POST | timestamp, decision, userId | { success, message } |
| **駁回假單** | `rejectLeave` | POST | timestamp, reason, userId | { success, message } |
| **上傳補件** | `supplement` | POST | timestamp, file, reason, userId | { success, message } |

#### 🎯 使用場景範例

**場景 1: 緊急事假**
```
1. 員工打開「請假申請」
2. 選擇「事假」，設定今日 11:00~12:00
3. 事由：「家中急事」
4. 不上傳檔案，點擊「送出申請」
5. 系統立即通知主管（若設有 LINE Bot 推播）
6. 主管於「假單管理」頁批准或駁回
```

**場景 2: 病假需補證明**
```
1. 員工選擇「病假」，設定 2026-01-05~2026-01-07（3 日）
2. 送出後，系統標記為「已報備」
3. 員工於「我的假單」看到「上傳證明」按鈕
4. 點擊展開表單，上傳醫生診斷書 JPG
5. 系統自動壓縮圖片、轉存至雲端
6. HR 於「假單管理」確認收到，更新狀態為「已確認」
```

**場景 3: 加班補登**
```
1. 員工選擇「加班申請」分頁
2. 選擇「申請加班費」
3. 開始時間自動預設為下班時間（17:30）
4. 結束時間智慧推薦為 17:45
5. 事由：「客戶臨時會議」
6. 送出後，紀錄寫入「加班記錄」表，後續薪資核算參考
```

#### ⚙️ 設定與常數

```javascript
const APP_SETTINGS = {
  // 預設班表時間 (24 小時制)
  DEFAULT_SHIFT_TIMES: {
    START: '08:30',
    END: '17:30'
  },
  
  // 各假別色彩標籤（莫蘭迪色系）
  LEAVE_TYPE_COLORS: {
    '事假': 'bg-stone-200',    // 灰棕
    '病假': 'bg-rose-200',     // 淡玫瑰
    '特休': 'bg-teal-200',     // 青綠
    '補休': 'bg-sky-200',      // 淡藍
    '公假': 'bg-slate-200',    // 灰藍
    '婚假': 'bg-pink-200',     // 粉紅
    '喪假': 'bg-indigo-200'    // 靛藍
  }
};
```

#### 🔍 特殊功能詳解

**1️⃣ 智慧日期連動**
- 設定開始日期為「1 月 5 日」，結束日期為「1 月 3 日」 → 系統自動校正結束日期為「1 月 5 日」
- 反向修改結束日期時亦同理

**2️⃣ 班表感知的時間範圍**
- 員工班表為 09:00~18:00，請假時間選擇器只會顯示該範圍內的時間
- 加班時自動切換為 24 小時範圍

**3️⃣ 圖片自動壓縮**
- 上傳 10MB 的醫院診斷書掃描件 → 瀏覽器自動壓縮至 2~3MB
- 壓縮品質可讀，不影響 HR 審核

**4️⃣ 自動更新機制**
- 員工停留在「我的假單」分頁時，每 10 分鐘自動檢查一次列表
- 若有新狀態變更（如主管批准）會自動刷新卡片

**5️⃣ 原地補件展開**
- 點擊「上傳證明」時，表單在卡片下方展開，無需離開頁面
- 再次點擊同一按鈕可收合

#### 🚨 容錯與驗證

| 驗證項目 | 規則 | 錯誤訊息 |
|---------|------|---------|
| 假別必選 | 至少選一種 | 必填欄位 |
| 日期必填 | 開始 ≤ 結束 | 結束日期不可早於開始日期 |
| 時間必填 | 開始時間 < 結束時間 | 時間範圍不合法 |
| 檔案格式 | JPG/PNG only | 僅接受 JPG, PNG 格式 |
| 檔案大小 | ≤ 5MB | 檔案過大 (自動壓縮) |
| 病假證明 | 3 日內上傳 | 逾期則狀態鎖定 |

#### 📱 響應式設計

- **手機 (320px~640px)**: 單欄布局，全寬輸入框，標籤下堆疊
- **平板 (641px~1024px)**: 兩欄布局（日期/時間），側邊欄假單列表
- **桌機 (1025px+)**: 三欄布局，表格式假單列表

#### 🎓 技術亮點

✨ **Module 模式** - 避免全域污染，分離邏輯層與 UI 層  
✨ **事件委託** - 動態綁定按鈕事件，避免重複渲染時事件遺失  
✨ **原地編輯** - 補件/編輯無需頁面跳轉，保持狀態連貫性  
✨ **圖片壓縮** - 前端實時壓縮，減少伺服器負擔  
✨ **智慧預設** - 根據班表 / 前次操作自動填值，降低錯誤率  

</details>
| **shift_schedule.html** | v25.0 | 員工排班系統 | 主管 | `getSchedule()`, `updateSchedule()`, `getShiftTemplates()` |
| **employee_editor.html** | v529.0 | 員工資料編輯 | HR、管理員 | `getEmployees()`, `updateEmployee()`, `deleteEmployee()` |

<details>
<summary><b>📝 詳細功能說明</b> (點擊展開)</summary>

- **checkin.html** - 單機版打卡介面，狀態燈號、背景漸層動畫、實時時間顯示
- **approval_dashboard.html** - 主管審核待辦假勤申請，支援批准/拒絕/備註
- **attendance_report.html** - 統計與分析，支援日期範圍查詢、員工篩選、缺勤警示、地圖展示
- **leave_request.html** - 員工提交假勤申請，支援多種假別、附件上傳、圖片自動壓縮
- **shift_schedule.html** - 月曆視圖、班別拖曳、班別顏色標籤、手機響應式設計
- **employee_editor.html** - 編輯員工基本資訊、權限設定、顯示/隱藏離職員工

**相依檔案**: config.js, utils.js, style.css, taskSender.js

</details>

---

### 5.2 info 資訊與客戶

**模組說明**: 品牌資訊、客戶接洽、常見問答、推薦機制等客戶相關功能

| 檔名 | 版本 | 技術棧 | 功能用途 | 相依檔案 |
|------|------|--------|---------|---------|
| **FAQ.html** | - | HTML + JS + Tailwind CSS | 常見問答，50 對 Q&A，分類側邊欄、搜尋功能 | style.css, utils.js |
| **LandingPage.html** | - | HTML + CSS | 品牌著陸頁，公司介紹、服務亮點、SEO 最佳化 | style.css |
| **onboardingflow.html** | v1 | **React 18** + JSX | 互動式客戶接洽流程，多步驟表單、動態內容分支 | style.css |
| **InviteSheet.html** | - | HTML + CSS | 好友推薦感謝回饋頁面，邀請碼生成 | style.css, config.js |
| **CastleRallyDispatcher.html** | v1.0.7 | HTML + JS + Tailwind CSS | 多人集結時間計算器，時區轉換、深色主題 | style.css, utils.js |

---

### 5.3 InteriorDesigned 室內設計

**模組說明**: 室內設計工具、施工規範、工程管理等設計相關功能

| 檔名 | 版本 | 技術棧 | 主要功能 | 線上連結 |
|------|------|--------|---------|---------|
| **LayoutPlanner.html** | v3.0 | HTML5 Canvas + SVG + Vanilla JS | 互動式室內設計規劃工具 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/LayoutPlanner.html) |
| **LayoutPlanner.js** | v3.0 | Vanilla JavaScript (2660行) | 核心設計邏輯 | - |
| **floorplan-straightener.html** | - | HTML + Canvas API | 平面圖校正工具 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/floorplan-straightener.html) |
| **WMS.html** | v1.0 | **Vue 3** + Tailwind CSS | 員工工作排程系統 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/WMS.html) |
| **site-report.html** | v1.0 | **React 18** + Canvas | 施工日誌生成器 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/site-report.html) |
| **renovation_checker.html** | v2.0 | **Vue 3** + Tailwind CSS | 工料檢核小幫手 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/renovation_checker.html) |
| **施工規範.html** | - | HTML + CSS | 施工規範文件 | [🔗 開啟](https://info.tanxin.space/modules/InteriorDesigned/施工規範.html) |
| **backend_script.js** | v2.1 | Google Apps Script | GAS 通用 API 後端 | - |
| **utils.js** | - | JavaScript | 工具函式 | - |
| **images/** | - | 圖片庫 | 40+ 傢俱/家電/建材圖片 | - |

<details>
<summary><b>📝 詳細功能說明</b> (點擊展開)</summary>

- **LayoutPlanner.html** - Canvas 繪製、動態計價、PDF/ZIP 匯出
- **LayoutPlanner.js** - 拖曳、縮放、旋轉、Undo/Redo、動態計價
- **floorplan-straightener.html** - 透視校正、尺寸標準化
- **WMS.html** - 月曆視圖、任務拖曳、實時同步
- **site-report.html** - 相片上傳、Canvas 預覽、PDF 生成
- **renovation_checker.html** - 圖片選擇器、分頁控制
- **施工規範.html** - 工程標準、品質要求
- **backend_script.js** - Sheet CRUD、檔案上傳、搜尋功能
- **utils.js** - 圖片加載、縮略圖生成、日期格式化

**相依檔案**: LayoutPlanner.js, backend_script.js, style.css, utils.js, wms_app.js, Google Sheets API

</details>

---

### 5.4 projects 專案管理

**模組說明**: 專案日誌、進度跟蹤、甘特圖排程、任務交辦等專案管理功能

#### 前端頁面

| 檔名 | 版本 | 技術棧 | 主要功能 |
|------|------|--------|---------|
| **managementconsole.html** | v262.0 | HTML + Tailwind CSS | 專案工作區主控台 |
| **daily_report.html** | v442.0 | HTML + Tailwind CSS | 團隊工作進度 |
| **NewSiteForm.html** | v116.0 | HTML + Bootstrap CSS | 新增案場資料 |

<details>
<summary><b>📝 前端頁面詳細說明</b> (點擊展開)</summary>

- **managementconsole.html** - 漢堡選單、專案切換、日期選擇 (相依: main.js, config.js, style.css)
- **daily_report.html** - 日期篩選、圖片懶加載、分頁 (相依: daily_report_main.js, config.js, style.css)
- **NewSiteForm.html** - 表單驗證、Modal 確認 (相依: config.js, style.css)

</details>

#### JavaScript 核心邏輯

| 檔名 | 版本 | 行數 | 主要功能 |
|------|------|------|---------|
| **main.js** | v13.0 | 1062 | 日誌管理主腳本 |
| **logActions.js** | v1.0 | 500 | 日誌動作處理 |
| **scheduleActions.js** | - | - | 排程動作處理 |
| **gantt_main.js** | v1.0 | - | 甘特圖主腳本 |
| **gantt_schedule_logic.js** | - | - | 甘特圖拖曳邏輯 |
| **daily_report_main.js** | - | - | 日報表邏輯 |
| **state.js** | v1.0 | - | 全域狀態管理 |
| **ui.js** | - | - | UI 渲染函式 |
| **projectApi.js** | - | - | 統一 API 請求 |
| **wms_app.js** | - | - | WMS 應用腳本 |

<details>
<summary><b>📝 JavaScript 模組詳細說明</b> (點擊展開)</summary>

- **main.js** - UI 渲染、樂觀更新、燈箱 (相依: logActions.js, state.js, ui.js, projectApi.js)
- **logActions.js** - 編輯、照片管理、發佈、刪除 (相依: state.js, projectApi.js, utils.js)
- **scheduleActions.js** - 新增任務、導入範本、儲存 (相依: state.js, projectApi.js)
- **gantt_main.js** - 甘特圖渲染、時間軸、刷新 (相依: gantt_schedule_logic.js, state.js)
- **gantt_schedule_logic.js** - 拖曳更新、時間驗證 (相依: state.js, projectApi.js)
- **daily_report_main.js** - 員工分組、日期篩選、圖片加載 (相依: state.js, projectApi.js, ui.js)
- **state.js** - logs、tasks、communications、flags (所有 js 模組依賴)
- **ui.js** - 骨架屏、卡片、分頁、標籤 (相依: logActions.js, scheduleActions.js, main.js)
- **projectApi.js** - 封裝 API、快取、重試 (相依: config.js, utils.js)
- **wms_app.js** - 排程邏輯整合 (相依: state.js, projectApi.js)

</details>
| **logActions.js** | v1.0 | JavaScript (500行) | **日誌動作處理** - 編輯、照片管理、發佈、刪除 | state.js, projectApi.js, utils.js |
| **scheduleActions.js** | - | JavaScript | **排程動作處理** - 新增任務、導入範本、儲存 | state.js, projectApi.js |
| **gantt_main.js** | v1.0 | JavaScript | **甘特圖主腳本** - 甘特圖渲染、時間軸、刷新 | gantt_schedule_logic.js, state.js |
| **gantt_schedule_logic.js** | - | JavaScript | **甘特圖拖曳邏輯** - 拖曳更新、時間驗證 | state.js, projectApi.js |
| **daily_report_main.js** | - | JavaScript | **日報表邏輯** - 員工分組、日期篩選、圖片加載 | state.js, projectApi.js, ui.js |
| **state.js** | v1.0 | JavaScript | **全域狀態管理** - logs、tasks、communications、flags | 所有 js 模組 |
| **ui.js** | - | JavaScript | **UI 渲染函式** - 骨架屏、卡片、分頁、標籤 | logActions.js, scheduleActions.js, main.js |
| **projectApi.js** | - | JavaScript | **統一 API 請求** - 封裝 API、快取、重試 | config.js, utils.js |
| **wms_app.js** | - | JavaScript | **WMS 應用腳本** - 排程邏輯整合 | state.js, projectApi.js |

---

## 6. 模組連結與依賴

### 6.1 架構圖

```
┌─────────────────────────────────────────────┐
│  index.html (Main Entry, Tailwind + LIFF)   │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  app.js (Vue 3 SPA，路由系統、狀態管理)      │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  IframeView.js (統一 iframe 容器)            │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  業務模組 (attendance | info |              │
│  InteriorDesigned | projects)              │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  共用層 (config.js | utils.js |             │
│  taskSender.js | style.css)                 │
└─────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────┐
│  後端 (Google Apps Script)                  │
│  CheckinSystem | Project-Console            │
└─────────────────────────────────────────────┘
```

### 6.2 關鍵依賴

- **app.js** → config.js, utils.js, style.css
- **所有模組** → config.js, utils.js, style.css, taskSender.js
- **projects/** → main.js → logActions.js, state.js, ui.js, projectApi.js
- **InteriorDesigned/** → LayoutPlanner.js, backend_script.js, utils.js

---

## 7. 技術棧與版本

### 7.1 前端框架

#### 框架與庫

| 技術 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | Latest | SPA 框架、狀態管理 |
| **React 18** | Latest | 元件框架 |
| **Tailwind CSS** | v3 | 工具化 CSS、響應式 |
| **Canvas API** | HTML5 | 設計工具繪製 |
| **LINE LIFF SDK** | v2 | 行動端整合 |
| **Flatpickr** | Latest | 日期選擇器 |
| **html2canvas** | Latest | DOM 轉換圖片 |
| **jsPDF** | Latest | PDF 生成 |
| **JSZip** | Latest | ZIP 打包 |

### 7.2 版本號演進

| 模組 | 檔案 | 版本 | 說明 |
|------|------|------|------|
| **SPA** | app.js | v391+ | 路由系統持續優化 |
| **出勤** | checkin.html | v25.11.01.1656 | 日期格式版本號 |
| **出勤** | approval_dashboard.html | v31.0 | 審核儀表板版本 |
| **專案** | main.js | v13.0 | 日誌管理成熟版 |
| **專案** | daily_report.html | v442.0 | 高版本表示長期迭代 |
| **設計** | LayoutPlanner.js | v3.0 | 第三代完整功能 |
| **共用** | taskSender.js | v7.0 | 多次優化版本 |
| **樣式** | style.css | v12.0 | 設計系統穩定版 |

---

## 8. 使用與維護

### 8.1 快速查閱

| 需求 | 解決方案 |
|------|--------|
| **新增功能** | 編輯相應模組的 HTML/JS 檔案 |
| **修改樣式** | 編輯 `style.css` (全域樣式) 或在模組 HTML 中修改 |
| **新增路由** | 編輯 `spa/app.js` 的路由表 |
| **新增 API** | 在 `shared/js/config.js` 新增 API URL，在 `projects/js/projectApi.js` 中封裝 |

### 8.2 部署流程

<details>
<summary><b>📦 本地開發</b> (點擊展開)</summary>

在本地伺服器運行 `http://localhost:8000`，使用瀏覽器 DevTools 測試

</details>

<details>
<summary><b>🚀 線上部署</b> (點擊展開)</summary>

執行 `upload.bat` (自動上傳至 GitHub Pages)

</details>

<details>
<summary><b>⚙️ 後端部署</b> (點擊展開)</summary>

進入各後端資料夾（CheckinSystem / project-console），執行 `deploy.bat`

</details>

---

# 🔧 後端服務文檔

## 9. CheckinSystem (打卡系統後端)

**專案位置**: `D:\Dropbox\CodeBackups\backend\CheckinSystem`  
**框架**: Google Apps Script (GAS) + Google Sheets API  
**執行環境**: Cloud Runtime V8  
**時區**: Asia/Taipei  
**部署**: 作為 Web App（執行身份為使用者，允許任何人匿名存取）

### 9.1 核心檔案清冊

| 檔名 | 行數 | 功能用途 | 版本 |
|------|------|---------|------|
| **WebApp.js** | 464 | 📡 Web App 總入口，處理所有 GET/POST 請求，路由分發、日誌記錄 | v1.0 |
| **CheckinLogic.js** | 2149 | 🎯 打卡核心業務邏輯，位置驗證、事件記錄、假勤管理、批准流程 | v1.0 (假勤管理功能新增) |
| **EmployeeLogic.js** | 469 | 👤 員工資料管理，使用者身份驗證、快取、個人資料查詢 | v1.0 |
| **ScheduledTasks.js** | 791 | ⏰ 排程任務與手動工具，定時檢查、日報產生、紀錄封存 | v1.0 |
| **SiteLogic.js** | ? | 📍 案場管理邏輯，位置座標反地理編碼、近距離計算 | v1.0 |
| **DatePicker.html** | ? | 📅 日期選擇器 UI（試算表內嵌） | - |
| **dropbox_api.js** | ? | ☁️ Dropbox API 整合 | - |
| **appsscript.json** | - | ⚙️ GAS 專案設定、依賴庫、權限配置 | - |
| **.clasp.json** | - | 🔐 CLASP 部署設定 | - |
| **deploy.bat** | - | 🚀 自動部署指令檔 | - |

### 9.2 依賴架構

```
外部函式庫 (Core Library)
    ↓
CheckinSystem Web App
    ├── WebApp.js (路由總機)
    │   ├── GET 路由 (checkin, attendance_api, get_hub_core_data, ...)
    │   ├── POST 路由 (submit_leave_request, process_site_form, ...)
    │   └── 日誌記錄與性能計時
    │
    ├── CheckinLogic.js (打卡業務)
    │   ├── processCheckin() - 打卡核心邏輯
    │   ├── processDeferredCheckinTasks() - 背景任務
    │   └── 隊列管理機制
    │
    ├── EmployeeLogic.js (員工管理)
    │   ├── _getUserProfileById_() - 快取查詢
    │   ├── 權限驗證
    │   └── 個人資料編輯
    │
    ├── ScheduledTasks.js (排程)
    │   ├── createCustomMenus() - Sheet 選單
    │   ├── 每日報表生成
    │   └── 紀錄封存與清理
    │
    └── SiteLogic.js (案場管理)
        ├── 位置座標計算
        └── 近距離判定
```

### 9.3 主要 API 端點

#### 基本功能

| 動作 | 方法 | 功能 | 受影響的資料表 |
|------|------|------|---------|
| **checkin** | GET | 員工打卡，記錄 GPS、驗證位置、隊列任務 | 打卡前置記錄、打卡記錄 |
| **attendance_api** | GET | 出勤系統 API 查詢 | 員工出勤 |
| **get_hub_core_data** | GET | 整合主控台核心資料 | 多個工作表 |
| **get_employees** | GET | 取得員工列表 | 員工資料 |
| **get_report** | GET | 出勤報表 | 員工出勤 |
| **get_latest_schedule** | GET | 最新班表 | 排班表 |
| **process_site_form** | POST | 新增/修改案場 | 案場資料 |
| **save_schedule_version** | POST | 儲存排班版本 | 排班表 |
| **upsert_employee** | POST | 新增/更新員工資料 | 員工資料 |

#### 假勤管理 API (新增功能)

| 動作 | 方法 | 功能 | 後端函式 | 受影響的資料表 |
|------|------|------|---------|---------|
| **get_my_leave_requests** | GET | 取得假單列表 (員工視圖 / 管理者視圖)<br/>參數: userId, permission, mode | `_getMyLeaveRequests_()` | 排班歷史紀錄 |
| **get_pending_requests** | GET | 待審核假單 (主管專用) | `_getPendingRequests_()` | 排班歷史紀錄 |
| **submit_leave_request** | POST | 提交/補件假勤申請 (員工) | `_handleLeaveRequest_()` | 排班歷史紀錄 |
| **update_leave_request** | POST | 編輯假單 (管理者)<br/>參數: recordId, applicantId, recordType, leaveType, dates, reason | `_handleLeaveRequest_()` | 排班歷史紀錄 |
| **cancel_leave** | GET | 取消假單 (員工自行取消)<br/>參數: timestamp, userId | `_cancelLeaveRequest_()` | 排班歷史紀錄 |
| **request_leave_cancellation** | POST | 申請銷假 (員工撤銷已批准的假)<br/>參數: timestamp, userId | `_requestLeaveCancellation_()` | 排班歷史紀錄 |
| **handle_approval** | GET | 審核假單 (管理者批准/駁回)<br/>參數: decision, recordId, approverName, reason, applicantId | `_handleApprovalRequest_()` | 排班歷史紀錄 |

### 9.4 假勤管理核心業務邏輯詳解

#### 📋 後端函式映射表

| 函式名稱 | 行數 | 參數 | 回傳值 | 主要職責 |
|---------|------|------|--------|---------|
| **`_getMyLeaveRequests_(userId, permission, mode)`** | ~80 | userId, permission, mode='default'\|'management' | { success, data: [...] } | 根據使用者權限返回假單列表 |
| **`_getPendingRequests_()`** | ~50 | 無 | { success, data: [...] } | 取得所有待審核假單 |
| **`_handleLeaveRequest_(payload)`** | ~200+ | action, userId, recordType, leaveType, dates, files | { success, message, recordId } | 統一處理新增/補件/編輯假單 |
| **`_cancelLeaveRequest_(params)`** | ~30 | timestamp, userId | { success, message } | 員工自行取消假單 |
| **`_requestLeaveCancellation_(params)`** | ~40 | timestamp, userId | { success, message } | 員工申請銷假(取消已批准假單) |
| **`_handleApprovalRequest_(params)`** | ~150+ | decision, recordId, approverName, reason, applicantId | HtmlService | 管理者批准/駁回假單 |
| **`_mergeLeaveEntries(existing, newLeave)`** | ~50 | 現有假勤字串, 新假勤字串 | 合併後的字串 | 合併時間區間假勤 (避免重疊) |
| **`_removeLeaveEntry_(existing, toRemove)`** | ~20 | 現有假勤字串, 要移除的字串 | 移除後的字串 | 從假勤字串中移除指定項目 |

#### 🎯 批准假單的業務流程

```
使用者點擊「批准」按鈕 (前端)
    ↓
呼叫 /attendance_api?action=handle_approval&decision=approved&recordId=...
    ↓
後端 _handleApprovalRequest_() 開始執行
    ├─ 查找目標假單紀錄
    ├─ 驗證狀態 (必須為「待審核」或「已報備」)
    │
    ├─【若假別為「請假」】
    │   ├─ 讀取請假的開始/結束日期
    │   ├─ 計算該假期跨越的所有月份
    │   ├─ 依月份分別處理:
    │   │   ├─ 讀取該月最新班表 (`_getLatestScheduleForMonth_`)
    │   │   ├─ 合併新的假勤項目 (`_mergeLeaveEntries_`)
    │   │   └─ 寫入新的「已確認」排班紀錄
    │   │
    │   └─【跨月假單範例】
    │       開始: 2026/01/29 (1月)
    │       結束: 2026/02/03 (2月)
    │       └─ 自動產生:
    │           - 2026年1月的新班表 (含 1/29~1/31 假勤)
    │           - 2026年2月的新班表 (含 2/01~2/03 假勤)
    │
    ├─【若假別為「加班」】
    │   ├─ 讀取加班日期與時間區間
    │   ├─ 取得該月班表
    │   ├─ 合併加班項目
    │   └─ 寫入新的「已確認」排班紀錄
    │
    ├─【若假別為「銷假」】
    │   ├─ 讀取原假勤項目的日期與假別
    │   ├─ 取得該月班表
    │   ├─ 移除該假勤項目 (`_removeLeaveEntry_`)
    │   └─ 寫入新的「已確認」排班紀錄 (該日恢復上班日)
    │
    ├─ 更新原假單狀態:
    │   ├─ 批准: 狀態 → 「已批准」
    │   └─ 駁回: 狀態 → 「已駁回」
    │
    ├─ 發送系統通知給申請人
    │   ├─ 批准: 「您的假勤申請已被批准」
    │   ├─ 駁回: 「您的假勤申請已被駁回，理由: [原因]」
    │   └─ 銷假批准: 「該日已恢復為上班日」
    │
    └─ 回傳審核結果頁面 (HTML)
        └─ 顯示「操作成功」或錯誤訊息
```

#### 🚫 駁回假單的業務流程

```
使用者點擊「駁回」→ 展開理由輸入框 → 輸入駁回理由 → 確認駁回
    ↓
呼叫 /attendance_api?action=handle_approval&decision=rejected&recordId=...&reason=...
    ↓
後端 _handleApprovalRequest_() 開始執行
    ├─ 查找目標假單紀錄
    ├─ 驗證狀態 (必須為「待審核」或「已報備」)
    ├─ 更新狀態: 「已駁回」
    ├─ 建立駁回紀錄 (新增一列至排班歷史紀錄表):
    │   ├─ recordType: '駁回紀錄'
    │   ├─ reason: '[理由]'
    │   ├─ approverName: '[駁回者名稱]'
    │   └─ timestamp: 駁回時間
    │
    ├─ 發送系統通知給申請人:
    │   └─ 「您的「[假別]」申請已被駁回。理由: [輸入的理由]」
    │
    └─ 回傳審核結果頁面
```

#### ✏️ 編輯假單的業務流程 (管理者)

```
管理者於「假單管理」分頁點擊「編輯」按鈕
    ↓
前端切換至「請假申請」/「加班申請」分頁,並填入原假單資料
    ↓
管理者修改日期、時間、事由等欄位
    ↓
點擊「提交編輯」→ POST action=update_leave_request
    ↓
後端 _handleLeaveRequest_() 處理 'update_leave_request' 動作
    ├─ 查找原假單紀錄 (透過 recordId + applicantId 比對)
    ├─ 更新以下欄位:
    │   ├─ offDaysCsv (假別)
    │   ├─ recordType (申請類型)
    │   ├─ startTime (開始時間)
    │   ├─ endTime (結束時間)
    │   └─ reason (事由)
    │
    ├─ 記錄編輯審計: 在「審核備註」欄位追加:
    │   └─ "[2026/01/03 14:30] 由 [編輯者名稱] 編輯"
    │
    └─ 回傳 { success: true, message: "假單已成功更新" }
```

### 9.4 資料表結構 (排班歷史紀錄)

**工作表名稱**: `排班歷史紀錄`

| 欄位 | 資料類型 | 用途 | 樣本值 |
|------|---------|------|--------|
| `timestamp` | DateTime | 記錄建立時間 (唯一 ID) | 2026-01-03 10:30:45 |
| `editorId` | String | 操作者/申請人 ID | user123 |
| `editorName` | String | 操作者/申請人姓名 | 王小明 |
| `targetUserId` | String | 目標員工 ID (編輯他人時) | emp456 |
| `targetUserName` | String | 目標員工姓名 | 李大衛 |
| `yearMonth` | String | 年月 (用於快速篩選) | 2026-01 |
| `offDaysCsv` | String | 假勤內容 CSV 格式 | `2026-01-05:病假[09:00~17:30](發燒);2026-01-06:病假` |
| `status` | String | 假單狀態 | `待審核` \| `已批准` \| `已駁回` \| `已報備` \| `已確認` |
| `recordType` | String | 紀錄類型 | `請假` \| `加班` \| `銷假` \| `駁回紀錄` |
| `startTime` | DateTime | 請假/加班開始時間 | 2026-01-05 09:00:00 |
| `endTime` | DateTime | 請假/加班結束時間 | 2026-01-05 17:30:00 |
| `reason` | String | 事由說明 | 「家中急事」 或 「客戶會議延時」 |
| `fileUrl` | String | 上傳證明檔案 URL (Dropbox) | https://dl.dropboxusercontent.com/... |
| `approverNotes` | String | 審核備註/編輯紀錄 | `[2026/01/03 14:30] 由王主任編輯` |

#### 狀態流轉圖

```
[待審核] ──批准──> [已批准] ──銷假────> [已取消]
   ↓                 ↓
  駁回             已批准
   ↓                 ↓
[已駁回]        [已確認]
   ↓
編輯重新提交
   ↓
[待審核]

[病假申請]
   ↓
[已報備] ──補件────> [待審核] ──批准──> [已批准]
```

### 9.4 外部依賴

**Core Library (必須)**
- 庫 ID: `1La4RLwrYLqfcc8rqu_ojS-c6W4j70S3U5im_bq31a62flUFQnqOwZy3F`
- 用途: 日誌記錄、LINE API、Sheets 存取、配置管理

**Google API 權限**
- `script.container.ui` - UI 對話框
- `script.scriptapp` - App Script
- `spreadsheets` - Google Sheets 讀寫
- `drive` - Google Drive 存取
- `script.external_request` - HTTP 外部請求
- `script.send_mail` - 郵件發送

### 9.5 部署與執行

<details>
<summary><b>🚀 部署流程</b> (點擊展開)</summary>

```bash
cd D:\Dropbox\CodeBackups\backend\CheckinSystem
deploy.bat  # 執行自動部署
```

部署後，系統會生成 Web App 執行 URL，前端（checkin.html）透過 JSONP 呼叫該 URL。

</details>

---

## 10. core_library (共用函式庫)

**專案位置**: `D:\Dropbox\CodeBackups\backend\core_library`  
**框架**: Google Apps Script (GAS) 共用庫  
**版本**: v1.0  
**目的**: 提供所有後端專案的共用工具函式

### 10.1 核心檔案清冊

| 檔名 | 行數 | 功能用途 |
|------|------|---------|
| **core_library.js** | 460 | 📚 所有共用工具函式、日誌記錄、LINE API 封裝、日期處理 |
| **config.js** | ? | ⚙️ 集中設定、Sheet ID、API 端點 |
| **appsscript.json** | - | GAS 項目設定 |
| **deploy.bat** | - | 自動部署指令 |

### 10.2 主要匯出函式分類

#### 日誌記錄 (Logging)
- `lineLog(message, detail1, detail2)` - 寫入通用偵錯日誌到 'AI_Debug' 工作表
- `logWebhookEvent(raw, info)` - 記錄 Webhook 事件
- `logOutgoingMessage(groupId, userId, text, replyCode, replyBody)` - 記錄傳出訊息

#### LINE API 封裝
- LINE Messaging API 操作
- Rich Menu 管理
- 訊息推播

#### 日期與時間
- 日期格式化
- 時區轉換
- 有效日期計算

#### Google Sheets 操作
- Sheet 存取與快取
- 資料讀寫

#### 工具函式
- 配置查詢 (`getCheckinSheetId()`, `getValidDistanceMeters()` 等)
- 回應產生

### 10.3 使用方式

在其他 GAS 專案中，於 `appsscript.json` 引用此庫：

```json
{
  "dependencies": {
    "libraries": [
      {
        "userSymbol": "CoreLib",
        "version": "0",
        "libraryId": "1La4RLwrYLqfcc8rqu_ojS-c6W4j70S3U5im_bq31a62flUFQnqOwZy3F",
        "developmentMode": true
      }
    ]
  }
}
```

然後在代碼中呼叫：`CoreLib.lineLog()`, `CoreLib.getCheckinSheetId()` 等

---

## 11. project-console (專案工作區後端)

**專案位置**: `D:\Dropbox\CodeBackups\backend\project-console`  
**框架**: Google Apps Script (GAS) + Google Drive API  
**執行環境**: Cloud Runtime V8  
**時區**: Asia/Taipei  
**部署**: 作為 Web App（執行身份為使用者，允許任何人匿名存取）

### 11.1 核心檔案清冊

| 檔名 | 行數 | 功能用途 | 版本 |
|------|------|---------|------|
| **WebApp.js** | 516 | 📡 Web App 總入口，路由分發、日誌、非同步任務管理 | v5.2 |
| **line_reply.js** | 1291 | 💬 LINE Webhook 事件處理、非同步任務佇列、照片上傳 | v9.0 |
| **ProjectLog.js** | 1395 | 📝 日誌管理系統、CRUD、縮圖偵錯、Drive 連結處理 | v6.3 |
| **ai_reply.js** | ? | 🤖 LINE Bot 訊息回覆、AI 整合 | - |
| **NotificationCenter.js** | ? | 🔔 通知管理、推播控制 | - |
| **createRichMenu.js** | ? | 📱 LINE Rich Menu 建立與同步 | - |
| **debug_and_webhook.js** | ? | 🐛 偵錯工具、Webhook 管理 | - |
| **drive_handler.js** | ? | 📁 Google Drive 檔案操作、上傳、權限管理 | - |
| **dropbox_api.js** | ? | ☁️ Dropbox API 整合 | - |
| **field_utils.js** | ? | 🛠️ 欄位工具函式 | - |
| **page_handlers.js** | ? | 🎨 頁面處理邏輯 | - |
| **appsscript.json** | - | ⚙️ GAS 專案設定 | - |
| **package.json** | - | 📦 NPM 依賴（支援 Node.js 工具） | - |
| **.clasp.json** | - | 🔐 CLASP 部署設定 | - |
| **deploy.bat** | - | 🚀 自動部署指令 | - |
| **flowcharts.puml** | - | 📊 PlantUML 流程圖 | - |
| **spec-kit/** | - | 📋 API 規範與文檔目錄 | - |

### 11.2 核心架構

```
line_reply.js (LINE Webhook 入口)
    ├── message event - 訊息事件
    └── postback event - 富文本選單交互
            ↓
    _triggerJobProcessing() - 觸發非同步任務
            ↓
    processJob(jobId) - 核心任務處理器
            ├── 圖片上傳至 Google Drive
            ├── 圖片縮圖生成
            ├── 視訊分段上傳（若需要）
            └── 日誌建立/更新
                    ↓
                ProjectLog.js
                ├── createLogDraftFromReport()
                ├── migrateOldReportsToLog()
                ├── updateLogText()
                └── deleteLog()
```

### 11.3 主要 API 端點

| 動作 | 方法 | 功能 | 備註 |
|------|------|------|------|
| **project** | GET | 專案工作區頁面資料 | 回傳 JSON |
| **get_hub_projects_data** | GET | 整合主控台專案資料 | 支援使用者篩選 |
| **get_notifications** | GET | 使用者通知列表 | JSON 格式 |
| **getSingleLog** | GET | 單篇日誌詳細資料 | 依 log ID |
| **getJobStatus** | GET | 非同步任務狀態輪詢 | 支援輪詢機制 |
| **get_daily_reports** | GET | 每日回報統計 | 日期範圍查詢 |
| **line_webhook** | POST | LINE Webhook 事件 | 訊息、postback |
| **submitReport** | POST | 施工回報提交 | 建立任務 |
| **createUploadJob** | POST | 建立上傳任務 | 初始化 Job ID |
| **uploadJobDataChunk** | POST | 上傳資料分塊 | 支援分段上傳 |
| **sendNotification** | POST | 發送通知 | 推播系統 |
| **process_notification_action** | POST | 處理通知互動 | 使用者回應 |
| **updateSchedule** | POST | 更新排程 | Gantt 圖表 |
| **createLog** | POST | 建立新日誌 | 直接發布 |
| **updateLogText** | POST | 更新日誌文字 | 編輯功能 |
| **updateLogPhotosWithUploads** | POST | 更新日誌照片 | Drive 連結 |
| **deleteLog** | POST | 刪除日誌 | 軟刪除或硬刪除 |
| **updateProjectStatus** | POST | 更新專案狀態 | 結案/重開 |

### 11.4 非同步任務系統 (Job Queue)

**特性**:
- 使用 `CacheService.getScriptCache()` 存儲任務狀態（TTL 30 分鐘）
- Job ID 格式: UUID
- 支援分段照片上傳（逐張處理，避免超時）
- 前端可透過 `getJobStatus` endpoint 輪詢進度

**狀態流轉**:
```
pending → processing → uploading → completed / failed
```

**快取欄位**:
```json
{
  "jobId": "uuid",
  "status": "processing",
  "userId": "...",
  "projectId": "...",
  "progress": 45,
  "totalPhotos": 10,
  "currentPhotoIndex": 4,
  "message": "正在上傳第 4 張圖片..."
}
```

### 11.5 外部依賴

**Core Library (必須)**
- 庫 ID: `1La4RLwrYLqfcc8rqu_ojS-c6W4j70S3U5im_bq31a62flUFQnqOwZy3F`

**Google Advanced Services**
- `Drive API v3` - 檔案上傳、權限管理、縮圖生成

**Google API 權限**
- `script.container.ui`, `script.scriptapp`, `spreadsheets`, `drive`, `script.external_request`

### 11.6 LINE Bot 整合

**Rich Menu 配置**:
- 由 `createRichMenu.js` 管理
- 支援「一鍵同步所有圖文選單」功能
- 可透過 Sheet 選單手動更新

**Webhook 驗證**:
- 使用 LINE Channel Secret 驗證簽章

---

## 12. 後端系統架構圖

```
前端 (CODING/)
    ├── checkin.html
    │   └── (JSONP GET) →
    │       CheckinSystem / WebApp.js
    │           ├── CheckinLogic.js
    │           ├── EmployeeLogic.js
    │           ├── ScheduledTasks.js
    │           └── SiteLogic.js
    │
    ├── managementconsole.html
    │   └── (JSON POST/GET) →
    │       project-console / WebApp.js
    │           ├── line_reply.js (Webhook)
    │           ├── ProjectLog.js (日誌 CRUD)
    │           ├── ai_reply.js (LINE Bot)
    │           ├── NotificationCenter.js
    │           ├── drive_handler.js
    │           └── page_handlers.js
    │
    └── 其他模組 (renovation_checker, WMS, site-report, ...)
        └── backend_script.js (通用 GAS API)

所有後端 ← Core Library (共用函式)
    ├── 日誌記錄
    ├── LINE API 封裝
    ├── Sheet 操作
    └── 配置管理
```

---

**文件版本**: v2.1 (2026.01.03)  
**最後更新**: 2026年1月3日  
**改進內容**: 恢復表格格式 + 新增快速導航 + 摺疊式區域 + 安裝 3 個 Markdown 擴展 + 新增完整後端文檔
