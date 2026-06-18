---
name: cloud-agent-runbook
description: 跑環境與測試
---

# Cloud Agent Runbook

在本倉庫**跑起來、驗證、改完要測**時先讀本檔。架構與模組行為見 SPEC；分模組測試細節見同目錄 `RUNBOOK_DETAIL.md`。

## 快覽

| 項目 | 重點 |
|------|------|
| 前端 | Vue 3 SPA + iframe 模組；靜態站，根目錄 `serve` |
| 後端 | GAS 在 `../backend/`；URL 以 `shared/js/config.js` 為準 |
| 身分 | LINE LIFF；本地多數頁只能驗 UI，完整流程要正式站或 bypass |
| 自動測試 | 僅 `modules/InteriorDesigned/`（Vitest + Playwright） |
| 正式站 | `https://info.tanxin.space` |

## 首次環境

```bash
node -v                    # 需 >= 20
npm ci                     # 失敗改 npm install
cd modules/InteriorDesigned && npm ci
npx playwright install --with-deps chromium   # 首次 E2E
cd ../..
```

## 啟動本地

```bash
npx --yes serve -l 3000 .          # http://127.0.0.1:3000
# LayoutPlanner 單獨：cd modules/InteriorDesigned && npm run serve  # :8765
```

## 本地略過 LIFF（施工回報）

`modules/projects/reportV3.html` → `window.__REPORT_V3_CONFIG__.ENABLE_LOCAL_TEST_BYPASS: true`  
測完**必改回 false**。其他 LIFF 頁見 `RUNBOOK_DETAIL.md` §本地測試限制。

## 跑自動測試

```bash
cd modules/InteriorDesigned
npm run test:unit    # 單元，約數秒
npm run test:e2e     # Playwright，自動起 serve@8765
npm test             # 兩者合跑
```

## 常見卡關

| 現象 | 先查 |
|------|------|
| 功能全沒反應 | 非 LINE 環境 → bypass 或只驗 UI |
| GAS 403／CORS | `config.js` URL 是否最新 |
| Playwright 缺瀏覽器 | `npx playwright install --with-deps chromium` |
| 靜態 404 | `serve` 指到 repo **根目錄** |

## 延伸

| 需求 | 去哪 |
|------|------|
| 各模組怎麼測、curl、正式站驗證 | `RUNBOOK_DETAIL.md` |
| 檔案與路由索引 | `SPEC/專案完整檔案清冊.md` |
| 架構、模組規格 | `SPEC/01_系統架構深編規格書.md` |
| 部署／上線 | `.agents/workflows/deploy.md`；Windows 用 `upload.bat` |
| 日報瀏覽器測試 | `.agents/workflows/test_daily_report.md` |
| 改 GAS | `GAS-Backend-Expert` skill |

踩到新坑：FAQ 補進 `RUNBOOK_DETAIL.md` §常見問題，本檔只留最常查的幾行。
