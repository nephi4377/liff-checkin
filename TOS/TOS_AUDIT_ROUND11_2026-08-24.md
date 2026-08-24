# TOS 系統盤點｜Round 11｜2026-08-24

## 本輪目標
確認 `project-console` / `CheckinSystem` 是否已具備 Dropbox 唯讀能力，以及是否可依案號定位案件資料夾。

## 已確認

### 1. Dropbox 並非只有上傳能力
`CheckinSystem/dropbox_api.js` 已具備 OAuth refresh token、自動刷新 access token、重試、上傳、資料夾建立、分享連結／temporary link 等底層能力。

### 2. project-console 已存在唯讀 Dropbox API
`project-console/CompletionMediaList.js` 已實作：

- 依 `project_code / projectNo / project_no` 取得案件 Dropbox 專案資料夾
- 呼叫 `findProjectFolder_(projectCode)` 對應案號→專案資料夾
- 列出專案夾下名稱含「完工照」且不含「美照」的子資料夾
- 使用 Dropbox `/2/files/list_folder` 與 `/continue` 遞迴列檔
- 依 Dropbox path 抓取檔案
- 產生 preview / temporary link
- WebApp 暴露 `list_project_completion_media` 與 `fetch_project_completion_media` 兩支受 shared secret 保護的唯讀轉接 API

因此 TOS 已可確認「透過現有 GAS 代理層存取 Dropbox」是既有架構，而非新概念。

### 3. WebApp 路由已把 Dropbox 當正式資料來源之一
`project-console/WebApp.js` 已登記：

- `list_project_completion_media`
- `fetch_project_completion_media`
- `material_upload_photo`（Dropbox＋Drive 副本）
- `material_designer_list`（缺路徑／暫時連結則自動補）
- `material_scan_import`（單案比對選材夾並匯入未入列照片）

表示 `project-console` 已有多個 Domain 直接依賴 Dropbox。

## 架構判斷

目前正式資料來源可定義為：

```text
Google Sheets = 結構化營運資料
Dropbox       = 正式文件／案件檔案／媒體資產
GitHub        = 程式碼／規格／技術決策
Firebase      = 即時狀態／通知／中繼
```

## 關鍵缺口

現有 Dropbox 唯讀 API 主要針對「完工媒體」與「選材」，尚未確認有通用的：

- 列出任意案件資料夾
- 搜尋檔名（合約／報價／驗收）
- 取得任意文件 metadata
- 下載 PDF / DOCX / XLSX 文件內容

所以要讓 TOS 查合約，應該優先沿用既有 `findProjectFolder_()` 與 `dbxJson_()` 能力，新增「受限唯讀文件閘道」，而不是讓 AI 直接碰 Dropbox token。

## 建議新增的唯讀 API

```text
list_project_documents(project_id, category?)
search_project_documents(project_id, keyword)
get_project_document_metadata(project_id, path)
fetch_project_document(project_id, path)
```

安全原則：

1. 僅允許 path 位於該 project 專案資料夾下。
2. 僅 GET / read，不提供刪除、移動、覆寫。
3. 使用既有 shared secret 或更細的 service token。
4. PDF / DOCX / XLSX 下載需設檔案大小上限。
5. 所有讀取寫 Audit Log。

## Decision Log

### D-036｜Dropbox 透過 GAS Proxy 存取
TOS / AI 不直接取得 Dropbox OAuth token；一律透過 project-console/CheckinSystem 代理。

### D-037｜Dropbox 是 Document Source of Truth
正式合約、重要原始文件以 Dropbox 為文件主來源；Google Sheet 僅保存結構化索引與摘要欄位。

### D-038｜沿用 `findProjectFolder_(project_id)`
後續 Contract / Inspection / Completion 等文件 Domain 優先使用既有案號→Dropbox 專案夾解析，不另造第二套資料夾 mapping。

### D-039｜新增通用唯讀 Document Gateway
在現有 CompletionMedia API 基礎上，抽象出通用專案文件唯讀閘道，供 TOS Contract/Inspection/AI 使用。

## 下一輪

1. 找出 `findProjectFolder_()` 實際實作與 Dropbox 根目錄／命名規則。
2. 盤 `MaterialSelectionModule` 的 Dropbox folder scanner，確認是否已有更通用的 list/search helpers。
3. 從 Google Sheets 建立第一版 TOS Data Dictionary，對照案號與 Dropbox 專案夾。
