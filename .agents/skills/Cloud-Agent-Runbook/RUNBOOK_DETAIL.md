# Cloud Agent Runbook — 細節

> 由 `SKILL.md` 分流；只記操作步驟，業務邏輯仍以 SPEC 為準。

## 本地測試限制

### LIFF 頁（出勤、假勤等）

Cloud Agent 本地通常只能：

- 確認 HTML／CSS 靜態載入、console 無致命錯誤
- 用 `curl` 或 DevTools `fetch` 冒煙測 GAS

完整 LIFF 流程須在 LINE App 開 `https://info.tanxin.space`，或該頁有專用 bypass（目前僅 reportV3，見 `SKILL.md`）。

### 施工回報 V3 本地步驟

1. `reportV3.html` 內 `ENABLE_LOCAL_TEST_BYPASS: true`
2. 開 `http://127.0.0.1:3000/modules/projects/reportV3.html`
3. 測完改回 `false`

## 分模組測試

### InteriorDesigned（LayoutPlanner）

| 指令 | 說明 |
|------|------|
| `npm run test:unit` | `LP_core.test.js` → `LP_core.js` 幾何／碰撞 |
| `npm run test:e2e` | `LP_playwright.config.cjs`、`e2e/LP_layout-planner.spec.cjs` |
| `npm test` | 單元 + E2E |

規格：`SPEC/04_互動式室內設計規劃工具規格書.md`

### projects/

| 頁面 | 路徑 | 本地 |
|------|------|------|
| 日報看板 | `modules/projects/daily_report.html` | 靜態載入；完整驗證用 `test_daily_report` workflow 或正式站 |
| 施工回報 V3 | `modules/projects/reportV3.html` | bypass 後本地開 |
| 專案主控台 | `modules/projects/managementconsole.html` | 靜態 UI；完整需 LIFF |
| 新增案場 | `modules/projects/NewSiteForm.html` | 同上 |

### attendance/

靜態載入：`checkin.html`、`approval_dashboard.html`（路徑在 `modules/attendance/`）。完整打卡／審核需 LIFF。

### SPA 主控台

`http://127.0.0.1:3000/index.html` — 查 Hash 路由（`#/daily-report` 等）、iframe 載入、側欄／篩選。

## GAS 冒煙（curl）

URL **不要寫死在本檔**；從 `shared/js/config.js` 取 endpoint，加 `?action=ping`：

```bash
# 範例格式（實際 URL 以 config.js 為準）
curl -s "<主_API_URL>?action=ping"
curl -s "<出勤_API_URL>?action=ping"
```

部署變更後先改 `config.js`，再跑 curl。

## 正式站端對端（瀏覽器）

`https://info.tanxin.space` 重點：

- KPI 看板 `#kpi-dashboard`
- 人員搜尋 `#person-search-input`
- 報告區 `#reports-container`
- 「專案模式」切換與分組

細步驟見 `.agents/workflows/test_daily_report.md`。

## Cloud Agent 的 Git

Linux／Cloud 環境直接用 `git`，不用 Windows 的 `upload.bat`：

```bash
git checkout -b cursor/<描述>
git add . && git commit -m "feat: <說明>"
git push -u origin cursor/<描述>
```

`main` 推送即 GitHub Pages 上線；功能用 PR 合併。

## 常見問題

| 問題 | 原因 | 解法 |
|------|------|------|
| 頁面開啟後功能全沒反應 | LIFF init 失敗 | bypass 或只驗 UI |
| GAS 403／CORS | URL 或 Web App 權限 | 更新 `config.js` |
| Playwright 找不到瀏覽器 | 未裝 chromium | `npx playwright install --with-deps chromium` |
| `npm ci` 失敗 | lock 與 Node 不符 | 改 `npm install` |
| 靜態資源 404 | serve 根目錄錯 | 指到 repo 根 |
| Service Worker 舊版 | `sw.js` 快取 | DevTools → Application → SW → Unregister |

## 維護本 runbook

發現新開關、新 `npm script`、新模組測試路徑、或踩坑解法時：

1. 高頻項 → 補 `SKILL.md` 對應表
2. 其餘 → 本檔對應章節
3. 業務行為變更 → 改 SPEC，不在此重複
