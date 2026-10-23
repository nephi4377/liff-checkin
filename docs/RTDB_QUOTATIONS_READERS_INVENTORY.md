# RTDB `quotations/*` 讀寫盤點（RTDB-READ-RULES-1）

專案：`brave-calling-391208` / `default-rtdb`（asia-southeast1）  
路徑：`quotations/{案號}`（含子路徑如 `context`、`is_closed` 等）

> **Backend_GAS**（`nephi4377/Backend_GAS`，本 agent 環境無權 clone／Code Search 無結果）：依本 repo `LOG/2026-05-23_LOG.md`、`SPEC/12_報價單審核與主控台整合規格書.md`、`TOS/TOS_AUDIT.md` 交叉引用，後端讀寫點如下表 #8–#10。規則收緊後需豪哥確認 GAS 是否已設 `FIREBASE_RTDB_AUTH` 或 Admin SDK。

## 讀寫者一覽

| # | 讀/寫 | 位置 | 操作 | 規則收緊後處理 |
|---|------|------|------|----------------|
| 1 | R+W | `tools/BudgetWeb_Standalone.html` | `once('value')` 案號檢查；`set()` 同步 `context` | ✅ 本 PR：`TanxinFirebaseRtdb` 匿名登入 + `ensureAuth()` |
| 2 | R+W | `tools/BudgetAuditor_Standalone_V2.html` | Dashboard 列 `quotations`；載入／`syncToFirebase` `set()`；案名 patch | ✅ 同上 |
| 3 | R+W | `tools/BudgetAuditor_Standalone.html`（舊版） | 同上（仍可能被 Hub 引用） | ✅ 同上 |
| 4 | R | `modules/projects/js/client-progress-main.js` | 客戶施工進度：唯讀 `context.items`（脫敏） | ✅ 同上 |
| 5 | — | `modules/InteriorDesigned/LP_quotation_budgetweb_export.js` | 僅匯出草稿 JSON/CSV，**不寫** RTDB | 無需改 |
| 6 | R+W（計畫） | `modules/InteriorDesigned/LP_budgetweb_firebase_sync.js`（#212/#213 分支） | 透過 BudgetWeb 注入的 `readQuotationSnapshot` / `updateQuotation` | ⚠️ 合併 #213 後沿用 BudgetWeb 登入層；勿在 LP 模組重複一套無 auth 的 SDK 初始化 |
| 7 | 文件／規格 | `SPEC/12`、`SPEC/13`、`docs/FLOORPLAN_QUOTE_IMPORT_PLAN.md` 等 | 敘述與驗收 | 本 PR + runbook |
| 8 | R+W（後端） | `Backend_GAS/project-console/FirebaseBridge.js` | `applyProjectClosureToFirebase_`、結案對帳寫 `quotations/{案號}`（`is_closed` 等） | 規則改 `auth!=null` 後：依 `FIREBASE_RTDB_AUTH`（Script Property，**本任務未新增**）或改 Admin SDK |
| 9 | R+W（後端） | `Backend_GAS/project-console/ProjectLogic.js` | `_updateProjectStatus_` 結案時觸發 Firebase 同步 | 同上 |
| 10 | R（後端） | `Backend_GAS/project-console/SiteReportAcceptance.js`（SPEC/21） | 驗收工項加總對照 Firebase 工項 | 若為 REST 直讀 RTDB，需帶 auth token |

## 非 `quotations` 但同專案 RTDB（本任務不變規則）

| 路徑 | 讀者（本 repo） | 備註 |
|------|-----------------|------|
| `quickRenovationQuote/settingsV2` | `tools/quick-renovation-quote/*` | 本 PR 僅補預設匿名登入；**不修改**該路徑規則 |
| （其他） | 施工回報等見 `reportV3`（Storage 為主） | 部署規則前必從 Console **匯出完整 rules** 比對（runbook） |

## 規則收緊後仍可能失敗的讀者

| 情境 | 原因 | 建議 |
|------|------|------|
| 未部署本 PR 前端、已發布新規則 | 舊 BudgetWeb 無 auth | 先部署前端再發布規則 |
| GAS 未帶 `FIREBASE_RTDB_AUTH` 且規則僅 `auth != null` | 伺服器無 Firebase 身分 | 啟用 Admin SDK 或保留後端寫入路徑（豪哥決策） |
| 外部直接 `curl` 公開 `.json` | 刻意封閉 | 預期行為 |

*文件版本：RTDB-READ-RULES-1 · 2026-10-23*
