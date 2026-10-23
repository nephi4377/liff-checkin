# Runbook：`quotations/*` RTDB 讀取改為需登入（RTDB-READ-RULES-1）

**Cloud Agent 不執行本 runbook 內任何 Console／正式部署步驟。** 供豪哥或值班依序操作。

## 0. 目標

- `quotations/{案號}`：**未登入不可讀**（含單價、案場名稱）。
- 寫入：不得比現行更寬；本 PR 建議與讀取同為 `auth != null`（若現行寫入已更嚴，以 Console 匯出為準）。
- 前端：BudgetWeb、BudgetAuditor V2、客戶進度頁等先支援**匿名登入**再讀寫。

## 1. Firebase Console 前置（豪哥）

1. 專案 `brave-calling-391208` → **Authentication** → Sign-in method → 啟用 **Anonymous**。
2. （建議）記錄目前 **Realtime Database → Rules** 全文：  
   - Rules 頁 → 右上角 **⋮** → 匯出／或複製整份 JSON 存檔 `rules-before-YYYYMMDD.json`。
3. **不要**在未匯出前覆寫整份 rules。

## 2. 合併規則檔（僅改 `quotations`）

Repo 片段：`firebase/database.rules.json`（**僅含 `quotations` 子樹**）。

```json
"quotations": {
  "$projectNo": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

操作：

1. 開啟步驟 1 匯出的完整 rules。
2. 找到既有 `"quotations"` 節點，**只替換**該節點為上列內容（或依現行 write 條件微調，但不可放寬寫入）。
3. 其他 top-level 節點（如 `quickRenovationQuote`、上傳佇列等）**逐字保留**。
4. 本地可用 Emulator 驗證：`npm run test:rtdb-rules`（見 `firebase/database.rules.emulator.json`）。

## 3. 部署順序（重要）

```mermaid
flowchart LR
  A[啟用 Anonymous Auth] --> B[部署前端含匿名登入]
  B --> C[驗證 BudgetWeb / Auditor 同步]
  C --> D[發布新 RTDB Rules]
  D --> E[驗證未登入 curl 被拒]
  E --> F[驗證工具與客戶頁仍可讀工項進度]
```

| 步驟 | 動作 | 通過標準 |
|------|------|----------|
| 3.1 | 合併並 **先** 部署 **liff-checkin** 前端（本 PR） | BudgetWeb 填案號可「檢查雲端」；Auditor 可載入／同步 |
| 3.2 | 正式站開 DevTools → Application → 確認 Firebase Auth 有 anonymous `uid` | Network 無 `permission_denied` on `quotations` |
| 3.3 | 發布 **合併後** 的 RTDB rules | 見 3.4 |
| 3.4 | 未帶 auth token 讀取應失敗：`curl` 測試 URL（勿在公開場合貼案號真資料） | HTTP 401 / `permission_denied` |
| 3.5 | 再測 BudgetWeb 同步、Auditor `syncToFirebase`、客戶施工進度頁 | 功能與收緊前一致 |
| 3.6 | 若有 #212/#213 合併：再測 LayoutPlanner → BudgetWeb 雲端同步 | 寫回安全閘仍正常 |

## 4. 與 PR #212 / #213 合併順序

| 順序建議 | PR | 原因 |
|----------|-----|------|
| 1 | **本 PR**（RTDB 登入層 + rules 片段 + runbook） | 登入初始化集中在 `shared/js/firebase-rtdb-*`，與 LP 合併邏輯分離 |
| 2 | #212 `cursor/floorplan-quote-2-11ea` | BudgetWeb 草稿合併 |
| 3 | #213 `cursor/floorplan-quote-3-writeback-gate-11ea` | 依賴 #212；`LP_budgetweb_firebase_sync.js` 透過 BudgetWeb 的 db 讀寫 |

**可能衝突點**：`tools/BudgetWeb_Standalone.html`（#213 改同步流程）。解決：保留 #213 的 `runBudgetWebQuotationCloudSync` 呼叫，但 Firebase 初始化與 `ensureAuth` 以本 PR 的 `TanxinFirebaseRtdb` 為準。

## 5. 回滾

1. **Rules**：Console 貼回 `rules-before-YYYYMMDD.json` → Publish。
2. **前端**：回退至收緊前之 liff-checkin commit（匿名登入仍可用，不影響舊規則）。
3. 若僅 Anonymous 誤關：重新啟用 Anonymous，無需回滾 rules。

## 6. 安全說明（匿名登入）

- **防護程度**：阻擋「未登入」的網路爬蟲與誤公開的 `.json` 連結；**不**等於案場級授權（任何能開網頁的人仍可匿名取得 uid）。
- **升級路徑**（需後端、可能需 secret，**本任務不做**）：LINE/LIFF → GAS 簽發 **Firebase Custom Token**，rules 改為 `auth.token.company === true` 或 per-project claims；或改由 GAS 唯讀 API 下發脫敏 DTO（SPEC/13 長期方向）。

## 7. 本機驗證指令

```bash
npm run test:rtdb-auth-merge
npm run test:rtdb-rules
npm run test:layout-planner:ci
```

*Runbook 版本：2026-10-23*
