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
| 8 | R+W（後端） | `Backend_GAS/project-console/FirebaseBridge.js` | `applyProjectClosureToFirebase_`、結案對帳寫 `quotations/{案號}`（`is_closed` 等） | **寫入**收緊為 `auth!=null` 時：SPEC/LOG 載明僅在 Script property **`FIREBASE_RTDB_AUTH`（已存在之名稱）** 有值時才帶 auth；**未設則結案寫入會被新規則擋下**。發布前豪哥於 GAS 編輯器核對該**名稱**是否存在（禁止 Cloud Agent 新增）。見 runbook §1.5 |
| 9 | R+W（後端） | `Backend_GAS/project-console/ProjectLogic.js` | `_updateProjectStatus_` 結案時觸發 Firebase 同步 | 同 #8 |
| 10 | R（後端） | `Backend_GAS/project-console/SiteReportAcceptance.js` | `fetchQuotationContextFromFirebase_(projectNo)` → RTDB `quotations/{案號}`（`TOS/TOS_AUDIT_ROUND12`：讀 `items`、`total_summary.overall_completion`、`price` 等；`buildQuotationSummaryFromContext_`） | **讀取**收緊為 `auth!=null` 時：**若 GAS 未帶 auth 會失敗**（本 repo 無法讀 Backend 源碼，無法確認是否共用 `FIREBASE_RTDB_AUTH`）。發布 read 規則前請豪哥試跑驗收／毛利相關 API。前端 BudgetAuditor 不受此條影響（已匿名登入） |

## 非 `quotations` 但同專案 RTDB（本任務不變規則）

| 路徑 | 讀者（本 repo） | 備註 |
|------|-----------------|------|
| `quickRenovationQuote/settingsV2` | `tools/quick-renovation-quote/*` | 本 PR 僅補預設匿名登入；**不修改**該路徑規則 |
| （其他） | 施工回報等見 `reportV3`（Storage 為主） | 部署規則前必從 Console **匯出完整 rules** 比對（runbook） |

## 規則收緊後仍可能失敗的讀者

| 情境 | 原因 | 建議 |
|------|------|------|
| 未部署本 PR 前端、已發布新規則 | 舊 BudgetWeb 無 auth | 先部署前端再發布規則 |
| GAS 未帶 `FIREBASE_RTDB_AUTH` 且 quotations **write** 收緊 | 結案寫入 `quotations` 失敗 | runbook §1.5 選乙（只收緊 read）或甲（延後）或豪哥自行設定屬性 |
| GAS 讀 `quotations` 未帶 auth 且 **read** 收緊 | `SiteReportAcceptance` 等後端讀取失敗 | 同上；或後端改帶 token／Admin SDK |
| 外部直接 `curl` 公開 `.json` | 刻意封閉 | 預期行為 |

*文件版本：RTDB-READ-RULES-1 · 2026-10-23（TINA #215 A/B）*
