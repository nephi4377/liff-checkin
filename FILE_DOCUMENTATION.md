
# 📋 CODING 專案完整檔案清冊

**最後更新**: 2026年2月21日 (還原詳細文檔並同步清理成果)  
**專案名稱**: 添心設計 LIFF 打卡系統前端頁面  
**主要框架**: Vue 3 SPA + 多模組 iframe 架構

---

## 🗂️ 快速導航

| 模組 | 內容 | 檔案數 |
|------|------|--------|
| 📂 [根目錄](#1-根目錄檔案) | 主入口、工具、設定 | 核心 8 檔案 |
| 🎨 [資源層](#2-assets-資源) | 全域樣式 | 1 |
| 🔌 [共用層](#3-shared-共用模組) | 設定、工具、組件 | 3 |
| ⚙️ [SPA 應用](#4-spa-單頁應用) | Vue 3 核心、路由、狀態 | 4 |
| 👤 [出勤管理](#51-attendance-出勤管理) | 打卡、審核、排班 | 6 |
| 📱 [資訊模組](#52-info-資訊與客戶) | 著陸頁、FAQ、客戶流程 | 5 |
| 🏗️ [室內設計](#53-interiordesigned-室內設計) | 設計工具 (精簡版) | 5 核心 + 歸檔 |
| 📊 [專案管理](#54-projects-專案管理) | 日誌、排程、甘特圖 | 13 |
| 🔐 [後端打卡系統](#9-checkinsystem-打卡系統後端) | CheckinSystem GAS | 核心邏輯 |
| 📦 [資源歸檔目錄](#6-備份與封存清單) | _DEPRECATED_, _待開發備份_ | 整合區 |

---

## 📑 詳細目錄

- [1. 根目錄檔案](#1-根目錄檔案)
- [2. assets 資源](#2-assets-資源)
- [3. shared 共用模組](#3-shared-共用模組)
- [4. spa 單頁應用](#4-spa-單頁應用)
- [5. modules 業務模組](#5-modules-業務模組)
- [6. 備份與封存清單](#6-備份與封存清單)
- [7. 技術棧與版本](#7-技術棧與版本)
- [8. 使用與維護](#8-使用與維護)
- [9. CheckinSystem 後端](#9-checkinsystem-打卡系統後端)

---

## 1. 根目錄檔案

| 檔名 | 版本 | 功能用途 | 相依檔案 | 狀態 |
|------|------|---------|---------|---------|
| **index.html** | - | 主入口頁面，掛載 Vue 3 SPA | app.js, style.css | **保留** |
| **README.md** | - | 專案說明檔 | - | **保留** |
| **sw.js** | v584.0 | Service Worker，圖片快取 | 無依賴 | **保留** |
| **exclude.txt** | - | 備份排除清單 | 無依賴 | **保留** |
| **CNAME** | - | 域名設定 | 無依賴 | **保留** |
| **create_txt_backup.bat** | - | 批次備份工具 | 無依賴 | **已移至 _DEPRECATED_** |
| **upload.bat** | - | 批次上傳工具 | 無依賴 | **已移至 _DEPRECATED_** |

---

## 2. assets 資源

### 2.1 CSS 樣式
- **style.css**: 全域樣式表，定義莫蘭迪色系、響應式布局。

---

## 3. shared 共用模組

| 檔名 | 版本 | 功能用途 | 核心匯出 |
|------|------|---------|---------|
| **config.js** | v1.0 | **統一設定中樞** | `LIFF_IDS`, `API_CONFIG` |
| **taskSender.js** | v7.0 | **可重用任務交辦元件** | `initializeTaskSender()` |
| **utils.js** | - | 全域工具函式庫 | `showGlobalNotification()` |

---

## 4. spa 單頁應用

| 檔名 | 版本 | 功能用途 | 核心功能 |
|------|------|---------|---------|
| **app.js** | v391+ | **Vue 3 SPA 主應用** | 路由系統、狀態管理 |
| **ProjectBoard.js** | - | 專案看板元件 | `renderProjectBoard()` |
| **IframeView.js** | - | Iframe 整合容器 | `loadIframeModule()` |

---

## 5. modules 業務模組

### 5.1 attendance 出勤管理
- **checkin.html**: 員工打卡頁面。
- **approval_dashboard.html**: 主管審核假勤儀表板。
- **attendance_report.html**: 出勤分析報表。
- **leave_request.html**: 線上假勤申請 (含詳細自動壓縮流程)。

<details>
<summary><b>📋 leave_request.html 詳細動作說明與功能解析</b> (點擊展開)</summary>

#### 📌 核心功能概述
線上假勤申請系統，支援多種假別、加班補登、證明文件上傳，以及假單管理與補件流程。具備分頁式 UI、智慧時間選擇、圖片自動壓縮等高級功能。

#### 📊 頁面結構 (4 個分頁標籤)
- **請假申請**: 提交請假申請。
- **加班申請**: 補登加班紀錄。
- **我的假單**: 查看個人假單歷史與操作。
- **假單管理**: 審核與管理假單 (主管用)。

#### 🔧 核心功能與動作說明
- **請假流程**: 選擇假別 → 輸入時間 → 填寫事由 → 上傳證明 → 送出。
- **加班流程**: 選擇補償方式 → 設定時間 → 填寫事由 → 送出。
- **圖片壓縮**: 使用 `browser-image-compression` 自動將 >5MB 圖片壓縮，轉換 Base64 提交。
- **狀態流轉**: 待審核 ↔ 已批准 ↔ 已報備 (待補件) ↔ 已駁回。

</details>

### 5.2 info 資訊與客戶
- **FAQ.html**: 常見問答 (50+ Q&A)。
- **LandingPage.html**: 品牌著陸頁。
- **InviteSheet.html**: 推薦回饋頁。
- **CastleRallyDispatcher.html**: 時間集結計算器。

### 5.3 InteriorDesigned 室內設計
| 檔名 | 功能用途 | 狀態 |
|------|---------|---------|
| **LayoutPlanner.html** | 互動式室內設計規劃工具 | **保留 (使用中)** |
| **floorplan-straightener.html** | 平面圖校正工具 | **保留 (使用中)** |
| **施工規範.html** | 工程標準文件 | **保留 (常用)** |
| **WMS.html** | 工作排程系統 (舊版) | **已移至 _待開發備份_** |
| **site-report.html** | 施工日誌生成器 | **已移至 _待開發備份_** |
| **renovation_checker.html** | 工料檢核小幫手 | **已移至 _待開發備份_** |

---

## 6. 備份與封存清單

為了維持開發環境的高效能，我們將非核心或中止開發的檔案進行了整合。

### 6.1 `_DEPRECATED_` (不再使用的封存項目)
- `client_updates/`: 大型安裝執行檔（避免導致 Git 錯誤）。
- `create_txt_backup.bat`, `upload.bat`, `fix_git.bat`: 舊版批次腳本。
- `push_error.txt`, `FILE_DOCUMENTATION.pdf`: 歷史記錄文檔。

### 6.2 `_待開發備份_` (中止/未來項目)
- `WMS.html`, `site-report.html`, `renovation_checker.html`。
- `sheet_initializer.js`, `backend_script.js`: 配套腳本。
- `規格書/`: 相關業務文檔資料夾。

---

## 9. CheckinSystem (打卡系統後端)

**專案位置**: `backend\CheckinSystem`  
**框架**: Google Apps Script (GAS)

### 9.1 核心檔案清冊
| 檔名 | 功能用途 |
|------|---------|
| **WebApp.js** | 📡 Web App 總入口，處理 GET/POST 請求 |
| **CheckinLogic.js** | 🎯 打卡核心業務與假勤管理邏輯 |
| **EmployeeLogic.js** | 👤 員工資料與身份驗證 |
| **ScheduledTasks.js** | ⏰ 每日報表產生與紀錄封存 |

> [!NOTE]
> 後端專案已更新 `.claspignore`，將所有 `_DEPRECATED_` 內容排除以確保部署純淨。

---

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
| **checkin** | GET | 員工打卡，記錄 GPS、驗證位置 | 打卡前置記錄、打卡記錄 |
| **attendance_api** | GET | 出勤系統 API 查詢 | 員工出勤 |
| **get_hub_core_data** | GET | 整合主控台核心資料 | 多個工作表 |
| **get_employees** | GET | 取得員工列表 | 員工資料 |
| **get_report** | GET | 出勤報表 | 員工出勤 |
| **get_latest_schedule** | GET | 最新班表 | 排班表 |
| **process_site_form** | POST | 新增/修改案場 | 案場資料 |
| **save_schedule_version** | POST | 儲存排班版本 | 排班表 |
| **upsert_employee** | POST | 新增/更新員工資料 | 員工資料 |

---

## 7. 技術棧與部署

### 7.1 前端框架

#### 框架與庫
| 技術 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | Latest | SPA 框架、狀態管理 |
| **React 18** | Latest | 元件框架 |
| **Tailwind CSS** | v3 | 工具化 CSS、響應式 |
| **Canvas API** | HTML5 | 設計工具繪製 |
| **LINE LIFF SDK** | v2 | 行動端整合 |

### 7.2 部署指引
- **前端部署**: 修改完成後，推送到 GitHub Pages。
- **後端部署**: 進入 `backend/project-console` 或 `CheckinSystem` 使用 `clasp push`。
- **排除清單**: 已在 `.claspignore` 中排除 `_DEPRECATED_` 與 `_待開發備份_` 資料夾。

---
> [!IMPORTANT]
> 維護此文件時，請確保目錄結構與 **`spa/app.js`** 的路由表同步更新。
