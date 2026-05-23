---
name: cloud-agent-runbook
description: >-
  在 CODING 倉庫執行、測試、啟動靜態站、跑 Vitest/Playwright 時優先讀。含環境、網域、功能旗標與常見問題。
---

# Cloud Agent Runbook

> **適用情境**：需要在本倉庫跑程式、驗證功能、或修改後測試時，**先讀本文件**。

---

## 0. 程式庫快覽

| 層次 | 說明 |
|------|------|
| **靜態前端** | Vue 3 SPA（`index.html` + `spa/app.js`）+ 多模組 iframe |
| **後端** | Google Apps Script（GAS），**不在此倉庫**；以公開 HTTPS endpoint 呼叫 |
| **身分驗證** | LINE LIFF SDK；設定集中在 `shared/js/config.js` |
| **部署** | GitHub Pages（靜態）；`upload.bat` 為 Windows 備份 + `git push` 一體化腳本 |
| **唯一自動測試區** | `modules/InteriorDesigned/`（Vitest 單元 + Playwright E2E） |
| **正式網域** | `https://info.tanxin.space` |

---

## 1. 環境準備（Cloud Agent 首次進入時）

```bash
# 確認 Node 版本（需 >=20）
node -v

# 安裝根目錄依賴（只有 firebase，通常不影響執行）
npm ci

# 安裝 InteriorDesigned 子專案依賴（自動測試需要）
cd modules/InteriorDesigned
npm ci
npx playwright install --with-deps chromium   # 首次需要下載瀏覽器
cd ../..
```

> **若 `npm ci` 失敗**：改用 `npm install`；`package-lock.json` 可能因環境差異需重新生成。

---

## 2. 啟動靜態網站（本地瀏覽）

整個倉庫是靜態網站，不需要應用伺服器。用任何靜態伺服器提供根目錄即可：

```bash
# 方法 A：用 npx serve（推薦，無需全域安裝）
npx --yes serve -l 3000 .
# 打開 http://127.0.0.1:3000

# 方法 B：Python（備用）
python3 -m http.server 3000
```

**InteriorDesigned 子模組**（LayoutPlanner）有專屬 port：

```bash
cd modules/InteriorDesigned
npm run serve          # 在 http://127.0.0.1:8765 提供此子目錄
```

> Playwright E2E 測試會自動啟動這個伺服器，不需手動先開。

---

## 3. 功能旗標（Feature Flags）與本地測試開關

此專案沒有集中式功能旗標系統，但各頁面有內嵌開關：

### 3.1 施工回報（reportV3.html）——最重要的開關

檔案：`modules/projects/reportV3.html`，搜尋 `ENABLE_LOCAL_TEST_BYPASS`：

```javascript
// 找到這個設定物件（window.__REPORT_V3_CONFIG__）
ENABLE_LOCAL_TEST_BYPASS: false,   // ← 改成 true 可在本地略過 LIFF 登入
```

**操作步驟**：
1. 將 `ENABLE_LOCAL_TEST_BYPASS` 改為 `true`
2. 啟動靜態伺服器，用瀏覽器開啟 `http://127.0.0.1:3000/modules/projects/reportV3.html`
3. **測試完畢後務必改回 `false`**，否則生產環境會略過身分驗證

### 3.2 其他頁面的 LIFF 限制

大多數功能頁（出勤打卡、假勤申請等）**必須在 LINE App 內的 LIFF 環境**才能完整執行，Cloud Agent 在本地只能：
- 確認頁面能靜態載入（HTML/CSS 渲染正確）
- 用瀏覽器工具查 console 錯誤
- 模擬呼叫 GAS endpoint（用 `curl` 或在 console 直接執行 `fetch`）

---

## 4. 分區域測試流程

### 4.1 InteriorDesigned（室內設計工具）—— 有完整自動測試

```bash
cd modules/InteriorDesigned

# 單元測試（純邏輯，約 3 秒）
npm run test:unit
# 對應檔案：LP_core.test.js（測 LP_core.js 的幾何/碰撞邏輯）

# E2E 測試（Playwright，會自動起 serve@14 在 8765）
npm run test:e2e
# 對應設定：LP_playwright.config.cjs
# 對應測試：e2e/LP_layout-planner.spec.cjs
# 測試重點：LayoutPlanner 互動、拖曳、碰撞偵測

# 兩者合跑
npm test
```

**成功條件**：全部 test cases PASS，無 FAILED 行。

### 4.2 專案管理模組（projects/）—— 手動 + curl 測試

| 頁面 | 路徑 | 本地測試方式 |
|------|------|------------|
| 日報看板 | `modules/projects/daily_report.html` | 靜態載入後查 console；或用 computerUse 訪問正式站 |
| 施工回報 V3 | `modules/projects/reportV3.html` | 開 `ENABLE_LOCAL_TEST_BYPASS: true` 後本地開啟 |
| 專案主控台 | `modules/projects/managementconsole.html` | 靜態載入驗證 UI；完整功能需 LIFF |
| 新增案場 | `modules/projects/NewSiteForm.html` | 同上 |

**GAS API 冒煙測試（curl）**：

```bash
# 主 API 健康確認
curl -s "https://script.google.com/macros/s/AKfycbwbEVAfoO9eRzcUSfESIwih1Poub657h_9jz5UcqTXbxsDQOZ3mjLm1nHZfn_WM2K8/exec?action=ping"

# 出勤 API
curl -s "https://script.google.com/macros/s/AKfycbz5-DUPNNciVdvE5wrOogNgxYt8EpDZppAe9f2cUh8pW9y3i29fB6n0RA5r-A5KuAiz/exec?action=ping"
```

> GAS URL 更新後請同步修改 `shared/js/config.js`。

### 4.3 出勤模組（attendance/）—— 手動瀏覽

```bash
# 靜態載入確認（在伺服器起後訪問）
# http://127.0.0.1:3000/modules/attendance/checkin.html
# http://127.0.0.1:3000/modules/attendance/approval_dashboard.html
```

LIFF 相關功能只能在正式站 `https://info.tanxin.space` 以 LINE App 開啟完整驗證。

### 4.4 整合主控台 SPA（spa/ + index.html）

```bash
# 啟動靜態伺服器後
# http://127.0.0.1:3000/index.html

# 用 computerUse 驗證重點：
# 1. Hash 路由切換是否正常（#/daily-report, #/project-console 等）
# 2. Iframe 子模組是否載入
# 3. Vue 響應式狀態（側邊欄、篩選）
```

### 4.5 正式站端對端驗證（computerUse）

訪問 `https://info.tanxin.space`，確認：
- KPI 看板（`#kpi-dashboard`）載入
- 人員搜尋（`#person-search-input`）可輸入並過濾
- 報告容器（`#reports-container`）顯示資料
- 模式切換（「專案模式」按鈕）切換分組正確

---

## 5. Git 操作（Cloud Agent 環境）

此倉庫在 Cloud Agent 環境（Linux）中直接用 git 指令，**不使用** Windows 限定的 `upload.bat`：

```bash
# 建立功能分支（遵守命名慣例）
git checkout -b cursor/<描述性名稱>-ae06

# 提交
git add .
git commit -m "feat: <簡短說明>"

# 推送
git push -u origin cursor/<描述性名稱>-ae06
```

**重要**：本倉庫部署到 GitHub Pages 的是 `main` 分支，推送到 `main` 即上線。功能分支需透過 PR 合併。

---

## 6. 常見問題速查

| 問題 | 原因 | 解法 |
|------|------|------|
| 頁面開啟後功能全部沒反應 | LIFF init 失敗（非 LINE 環境） | 用 `ENABLE_LOCAL_TEST_BYPASS` 或只驗 UI 渲染 |
| GAS 呼叫回傳 403 / CORS | GAS Web App 權限或 URL 變更 | 確認 `config.js` URL 是否為最新部署 |
| Playwright 測試找不到瀏覽器 | 未安裝 chromium | `npx playwright install --with-deps chromium` |
| `npm ci` 失敗，lockfile 不符 | 環境 Node 版本差異 | 改用 `npm install` |
| 靜態資源 404 | 伺服器根目錄設錯 | 確認 `serve` 指到 repo **根目錄**，非子目錄 |
| Service Worker 快取舊版 | sw.js 已快取 | 瀏覽器開 DevTools > Application > Service Workers > Unregister |

---

## 7. 更新本技能的時機與方式

當你在任務中發現以下情況時，**順手更新本文件**（不需等待指示）：

1. **新的測試指令或開關**：例如新增了功能旗標、新的 npm script、或新的 mock 方法
2. **GAS URL 變更**：在 §4.2 的 curl 範例中同步更新
3. **新模組或新路由**：在 §4 對應區域補上測試流程
4. **踩到坑並解決了**：在 §6 常見問題速查表新增一行
5. **Playwright 或 Vitest 設定變更**：更新 §4.1 的指令

**更新方式**（在任務的最後一步執行）：

```bash
# 1. 直接編輯本文件
# 2. 連同任務的其他變更一起提交
git add .agents/skills/Cloud-Agent-Runbook/SKILL.md
git commit -m "docs: update Cloud-Agent-Runbook skill - <本次更新摘要>"
```

> **原則**：本文件只記「馬上能用的指令與判斷點」，不重複 SPEC 裡已有的業務邏輯細節。若需要深入了解某模組行為，參考 `SPEC/FILE_DOCUMENTATION.md` 作為索引入口。
