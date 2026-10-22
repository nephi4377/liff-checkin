# LayoutPlanner CI 測試範圍

Workflow：`.github/workflows/layout-planner-tests.yml`  
觸發：`pull_request`、`workflow_dispatch`（**不**部署、**不**寫 GitHub Pages）。

## 納入 CI

| 套件 | 指令 | 說明 |
|------|------|------|
| Vitest | `npm run test:unit` | `LP_core`、`LP_3D_scene`、`LP_3D_furniture`、`LP_LayoutPlanner_3d_lazy` |
| Playwright | `npm run test:e2e` | `e2e/LP_layout-planner.spec.cjs`（`serve@14` 8765） |

本機一鍵（與 CI 步驟一致）：

```bash
npm run test:layout-planner:ci
# 或僅單元：npm run test:layout-planner:unit
```

## 刻意未納入

| 項目 | 原因 |
|------|------|
| `shared/js/accounting_list_cache_portal.test.js` | 獨立 Node 腳本（`require`），非 Vitest；無統一 runner |
| 根目錄 `package.json` 的 `playwright` | 供其他用途，LayoutPlanner 使用 `modules/InteriorDesigned` 內 `@playwright/test` |
| 全站 `npm ci`（根目錄 Playwright） | 與 LayoutPlanner 無關，避免拖慢 CI |

## 未修改

- `.github/workflows/deployment-result.yml`（Pages 部署結果紀錄）仍僅在 `push: main`，本 workflow 不觸發部署。
