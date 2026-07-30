# 2026-07-30 CODING 部署 — 選材 API 改打 project-console

## Diff／目的

選材相關 `margin_material_*` 前端改走 **project-console**（不再經 accounting-gas），與 Backend_GAS main `7966583` 選材 Phase2 對齊。

## 技術

| 項目 | 內容 |
|------|------|
| `shared/js/accounting_api.js` | 新增 `postMaterial()` → `PROJECT_CONSOLE_API`；`material*` 系列全改主控台 |
| `modules/projects/designer-material-selection.html` | `accounting_api.js?v=45` |
| `modules/accounting/customer-finance-portal.html` | 選材區塊 `accounting_api.js?v=45` |
| 同步來源 | `backend/tools/coding-sync/material-selection-pc-api/` + `deploy-material-selection.bat` |
| 後端依賴 | project-console `MaterialSelectionModule.js`（GitHub main 已 merge；Actions 部署） |

## 驗證（部署後）

| 項目 | 自動驗收 | 結果 |
|------|----------|------|
| `material_ping` | GET project-console | ✅ `success: true` |
| 設計師頁 HTML | 正式站開頁 | ✅ 不再 404，`v=45` |
| API 路由 | POST `margin_material_designer_list` | ✅ 回「缺少 liff_id_token」（非「未知的 action」） |
| 設計師列表／新增 | 需 LINE LIFF | ⏳ 瀏覽器無法代測，請 LINE 內驗 |
| 客戶 portal `staff_preview=1` | 需員工 LINE | ⏳ 同上 |

### LINE 內手動驗收

1. https://info.tanxin.space/modules/projects/designer-material-selection.html?project_no=790  
2. https://info.tanxin.space/modules/accounting/customer-finance-portal.html?staff_preview=1&project_no=790&entity=material  
3. Network：POST 目標為 `AKfycbwbEVAfoO9e…`（project-console）

### 一次性設定（若客戶 portal 綁定未設）

`.../exec?page=setup_material_portal&secret=<SITE_CACHE_INVALIDATE_SECRET>`

## 部署結果

- 備份：`../BAK/CODING_20260730_2337_NEPHI筆電001`（upload.bat Step1）
- commit：`9d05be5`（feat(deploy): v26.07.01.1 at 20260730_2337）
- push：`origin/main` 成功（f08b9f1 → 9d05be5）
- 備註：本機 `.git/objects` 曾缺 `hub_ref_cache.js` blob；`git hash-object -w` 修復後完成 commit

## 本機 backend

- `main` 已 fast-forward 至 `7966583`（與 origin/main 同步）
- 本地 WIP 保留於 `cursor/sketchup-render-studio-6b2a`（merge main 進行中）
