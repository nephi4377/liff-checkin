# 2026-07-25 — FB 發文工作室 Phase 0：依案號列出完工照／影片 API

## Diff／目的

實作後端「依案號從 Dropbox 完工照資料夾列出照片與實拍影片」（list only）。**不**部署、**不**做前端案號 UI、**不**做 AI 剪輯。

## 技術

| 區 | 檔案 |
|----|------|
| SPEC | `CODING/SPEC/21_FB_POST_STUDIO_SPEC.md`（分期＋API）、`22_FB_REEL_STUDIO_SPEC.md`（一句註記）、`專有名詞白話對照.md` |
| Dropbox 找夾 | `project-console/dropbox_api.js` → 新增 `findProjectFolder_`（找-only；`findOrCreateProjectFolder_` 改呼叫它） |
| 列檔 | `project-console/CompletionMediaList.js`（新） |
| 路由 | `project-console/WebApp.js` → `page=list_project_completion_media` |
| 轉呼 | `accounting-gas/FbPostStudio.js`＋`WebApp.js` → `action: list_project_completion_media` |
| 會計 SPEC | `accounting-gas/SPEC/README.md` 補 action |

## 行為重點

- 子夾：名稱含「完工照」且不含「美照」（例：`1160722完工照`）
- `media_type`：`image`｜`video`｜`all`
- 找專案夾時**不**新建空夾
- 認證：前端走 accounting-gas（權限 ≥3 或 ingest secret）；PC 內部用轉接 secret

## 部署

本輪**未部署**。上線需 project-console 與 accounting-gas 皆推／deploy 後才可測正式 URL。

## 手動驗（部署後）

1. POST accounting-gas：`action=list_project_completion_media`，`project_code=734`，`media_type=all`（帶 LIFF token 或 secret）
2. 應見 `completion_folders` 含完工照夾、`items[].kind` 為 image／video
3. `media_type=video` 應只回影片；勿改 Dropbox 原檔
