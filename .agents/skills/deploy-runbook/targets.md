# 部署目標對照表

> 由 `deploy-runbook` 分流。路徑以 `CodeBackups` 為根。

## 倉庫一覽

| 倉庫 | 根目錄 | 日常部署指令 | LOG | 主要 SPEC |
|------|--------|--------------|-----|-----------|
| CODING 前端 | `CODING/` | `upload.bat` | `CODING/LOG/` | `CODING/SPEC/`、`專案全域資料字典.md` |
| Backend GAS | `backend/` | `upload.bat` → Actions | `backend/LOG/` + 模組 `LOG/` | `project-console/SPEC/DEPLOYMENT_SPEC.md` |
| accounting-gas | `backend/accounting-gas/` | `deploy.bat` | `accounting-gas/LOG/` | `accounting-gas/SPEC/` |
| core_library | `backend/core_library/` | `deploy.bat`（僅 push） | `CheckinSystem/LOG/` 等交叉記錄 | Library 無 Web App |
| 添心生產力助手 | `添心生產力助手/` | `upload.bat`（見該倉庫） | 倉庫內 `部署記錄*.md` | `SPEC/PROJECT_CONTEXT.md` |

## backend 子模組（GitHub Actions 路徑觸發）

| 變更路徑 | Workflow 行為 | 本機例外 |
|----------|---------------|----------|
| `project-console/**` | clasp push + deploy | `project-console/deploy.bat` |
| `CheckinSystem/**` | clasp push + deploy | `CheckinSystem/deploy.bat` |
| `ProjectSchedule/**` | 通常僅 push | `ProjectSchedule/deploy.bat` |
| `core_library/**` | **無**自動 workflow | **必須** `core_library/deploy.bat` |
| `accounting-gas/**` | accounting-gas workflow | `accounting-gas/deploy.bat` |

僅改 `backend/LOG/` 或根目錄 SPEC **不會**觸發 GAS 重部署（預期行為）。

## 備份命名

| 腳本 | BAK 資料夾範例 |
|------|----------------|
| `CODING/upload.bat` | `../BAK/CODING_YYYYMMDD_HHmm_<電腦名>/` |
| `backend/upload.bat` | `../BAK/Backend_GAS_YYYYMMDD_HHmm_<電腦名>/` |
| `project-console/deploy.bat` | `../../BAK/project-console_YYYYMMDD-HHmm_<電腦名>/` |
| `CheckinSystem/deploy.bat` | `../../BAK/CheckinSystem_YYYYMMDD-HHmm_<電腦名>/` |
| `accounting-gas/deploy.bat` | 同模組子目錄規則（見 bat 內） |

## 跨倉庫注意

- 改 **API／欄位**：backend 與 CODING 字典、前端呼叫端須一致；部署順序通常 **backend → CODING**（或同一輪兩邊都跑閘門）。
- 改 **core_library**：先 deploy Library，再 deploy 引用它的專案。
- **會計** Web App 執行身分應為 nephihuang；見 `GAS-Backend-Expert/reference.md`。

## 不必跑完整部署閘門

- 僅 `git status`／`diff`／`log` 且使用者**不要** push
- 純本機測試（`Cloud-Agent-Runbook`）
- 使用者明確說「先不要部署／只改 SPEC」
