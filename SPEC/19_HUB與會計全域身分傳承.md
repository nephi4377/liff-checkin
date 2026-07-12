# HUB 與會計 — 全域身分與應傳承資料

**版本**：v1.5（2026-07-12）  
**關聯**：[`15_會計系統模組規格書.md`](15_會計系統模組規格書.md)、[`18_會計與主檔快取策略.md`](18_會計與主檔快取策略.md)、[`08_專案主控台核心功能與通訊協定規格書.md`](08_專案主控台核心功能與通訊協定規格書.md)、backend `accounting-gas/SPEC/LINE_OA_SPEC.md`、`accounting-gas/SPEC/VENDOR_LINE_BINDING_SPEC.md`

---

## 0. 定案：方案 A（員工進會計）

| 項目 | 規格 |
|------|------|
| **員工入口** | **添心設計官方 LINE** → HUB 主控台 → 會計子頁（iframe） |
| **員工身分鍵** | Checkin「員工資料」的 **`userId`**（官方 LINE UID）；**不要求**員工加會計 LINE |
| **權限** | 同一張員工表的「權限」欄；HUB 帶 `uid`／`permission`，後端仍以查表為準 |
| **會計 LINE（行政／@672zolga）** | 給**廠商**私訊、群組、`#請款`、Webhook；**不是**財務同仁開 HUB 用的帳號 |
| **廠商身分** | 與員工分開：`vendor_id` + `廠商LINE綁定`（可多筆 UID／GID）；見 backend `accounting-gas/SPEC/VENDOR_LINE_BINDING_SPEC.md` §6 雙來源搜尋（未來） |

---

## 1. 為什麼 HUB 的 UID 和會計頁看起來「不同」

| 層級 | 說明 |
|------|------|
| **唯一員工鍵** | Checkin「員工資料」的 **`userId`（LINE UID）** 是全公司員工身分的準則，HUB、會計、考勤都應對到同一列 |
| **HUB 主控台** | SPA 用 **LIFF 登入** → `userProfile.userId`；iframe 開子頁時帶 `uid`／`permission` 等 query |
| **會計靜態頁（員工）** | 方案 A：隨 HUB iframe，沿用**官方 LINE** 的 `userId`；正式可驗官方 LIFF token 或 HUB 已傳 `uid`；開發：`ACCOUNTING_AUTH_BYPASS` + `dev_user_id` |
| **看起來不同** | 常見原因：① bypass 沒帶 HUB 的 `uid`；② 子頁相對連結丟失 query；③ **把廠商 `vendor_id`／綁定 UID 和員工 `userId` 搞混**；④ 誤用**會計 LINE** 的 UID 去查員工表（官方與會計 Channel 的 UID **本來就不同**） |

**結論（員工）**：財務同仁只認 **官方 LINE → HUB → 會計** 這條路；`userId` 對應**同一份**員工試算表同一列即可。  
**結論（廠商）**：認 `vendor_id`；兩條 LINE 各有 UID 名冊，在 `廠商LINE綁定` 掛到同一廠商（見廠商規格 §6）。

### 1.1 員工試算表（單一主檔）

全公司員工只維護**一份**打卡／人事試算表（例如「公司打卡系統 的副本」、`員工資料` 分頁）。HUB、考勤、會計後端都應讀**同一檔**。

| 系統 | GAS 專案 | Script Property |
|------|----------|-----------------|
| HUB／考勤 | `CheckinSystem` | `SPREADSHEET_CHECKIN_ID` |
| 專案主控台 | `project-console` | `SPREADSHEET_CHECKIN_ID` |
| 會計（查員工權限） | `accounting-gas` | `CHECKIN_SPREADSHEET_ID` |

**維運**：若三處 Property 曾設成不同 ID，才需對齊（`master_status` 比對 → `setCheckinSpreadsheetIdOnce`）。**日常不必重複操作**；員工資料表本身只有一份。

---

## 2. 應全域傳承的資料（定案）

以下指：**同一位操作者、同一瀏覽器分頁（或 HUB iframe 樹）內**，從主控台進會計／考勤子模組時應一致。

### 2.1 操作者身分（必傳）

| 欄位 | 來源準則 | 用途 | 儲存方式 | 壽命 |
|------|----------|------|----------|------|
| **`userId`** | Checkin `員工資料.userId` | 稽核、請款 `reviewed_by` 關聯、快取 key | ① HUB iframe URL：`uid`；② `sessionStorage`：`acct_dev_user`（過渡）／目標 `tanxin_operator_v1`；③ 正式會計：`liff_id_token` 僅記憶體，**不寫入 localStorage** | URL：僅當次導向；sessionStorage：**到分頁關閉**；token：LIFF 效期（約 1 小時內） |
| **`userName`／`displayName`** | Checkin `userName` 或 LIFF profile | 畫面顯示、稽核欄位 | ① URL：`name`；② 與 operator 一併快取 | 同 `userId` |
| **`permission`** | Checkin「權限」欄（1–5） | 會計 ≥4 進財務、≥5 核准請款 | ① URL：`permission`；② `sessionStorage`：`tanxin_operator_v1`（含 legacy `acct_dev_perm`）；③ 正式：每次 `accounting_auth_me` 由後端查表 | sessionStorage 到分頁關閉；後端 ScriptCache `acct_emp_{userId}` **6 小時** |
| **`hubLiffId`**（選填） | HUB 官方 LIFF Channel ID（`config.js` `HUB_LIFF_ID`） | 會計 iframe 向父層 `postMessage` 索取 `id_token` 時辨識 Channel | ① URL：`hub_liff_id`；② `tanxin_operator_v1.hubLiffId` | 同 operator；**不寫 localStorage** |
| **`group`**（選填） | Checkin 員工分組 | HUB 任務交辦、部分篩選 | URL 可擴充；或 HUB `spa_hub_employees` 內含 | 見 §2.2 |
| **`status`／身份**（選填） | Checkin「身份」 | 離職拒登、廠商／員工區分 | **僅後端**查表，不建議前端快取當授權依據 | GAS 員工 cache 6 小時 |

**寫入／讀取責任**

| 誰寫 | 誰讀 |
|------|------|
| `spa/app.js` iframe `src` 附加 `uid`／`name`／`permission`／`hub_liff_id` | 各 `modules/*` 靜態頁、`operator_context.js`、`accounting_api.js` |
| `operator_context.js` 首次帶 query 時寫 `tanxin_operator_v1`（並同步 legacy `acct_dev_*`） | 會計子頁 `initSession`、相對連結跳轉後仍讀 storage |
| `spa/app.js` 回應 iframe `request_hub_liff_token` → `hub_liff_token` | `accounting_api.js` 在 iframe 內向父層要 token |
| accounting-gas `resolveAccountingAuth_` | 所有會計 `action`；`dev_user_id` 時 `fetchEmployeeByUserId_` |

### 2.2 參考主檔（建議傳承，非授權）

**定案（v1.5）**：員工／案場／官方顧客名冊收斂至 **`HubRefCache`**（`tanxin_ref_v1:*`），HUB 預熱寫入、各 iframe **只讀**；CRUD 後由對應模組 patch／invalidate。

| 資料 | 內容 | 儲存 key | 記憶體 | 壽命 | 讀取模組 |
|------|------|----------|--------|------|----------|
| **員工名單** | 在職員工 `userId`、`userName`、`permission`… | `localStorage` **`tanxin_ref_v1:employees`**（相容 legacy `spa_hub_employees`） | `window.__tanxinRef.employees`；父層 `spaAllEmployees` | **3 天** TTL；**24h SWR** 背景重抓 | HUB、`AccountingContext`、收支登錄快選 |
| **案場列表** | 案號、客戶名、店別… | **`tanxin_ref_v1:projects`**（相容 `spa_hub_projects`） | `window.__tanxinRef.projects`；父層 `spaAllProjects` | **3 天**；**24h SWR** | HUB、`AccountingContext`、記帳案號快選 |
| **官方顧客名冊** | `official_customer_search` 整包 | **`tanxin_ref_v1:customers`**（全公司共用，**不分 userId**） | `window.__tanxinRef.customers` | **24 小時** | `AccountingListCache.searchMasterList`、客戶財務綁定 |
| **當月班表** | HUB 排程 | `spa_hub_schedule_{YYYY}_{MM}` | — | **7 天** | HUB 主控台（會計較少直接用） |
| **會計 bootstrap** | 廠商、收款帳戶、列舉… | `sessionStorage` `tanxin_accounting_bootstrap_v4:{userId}` | 模組內 `_mem` | **3 天** | `AccountingCache`；**依 operator userId 分 key**；CRUD 成功優先 patch |

**讀寫責任（參考主檔）**

| 誰寫 | 誰讀 | 備註 |
|------|------|------|
| HUB `spa/app.js`：`get_hub_core_data` 成功 → `HubRefCache.set('employees'/'projects')` | 會計 iframe：`HubRefCache.read()` → 父層 `spaAll*` 優先 | iframe **不應**再各自打員工／案場 API |
| 會計 `searchMasterList(official_customer)` 首次 `fetch_all` → `HubRefCache.set('customers')` | 各會計頁本地 keyword 篩選 | 綁定成功 `invalidate('customers')` |
| `NewSiteForm` 等 postMessage `spa_hub_invalidate_projects` | HUB 重抓後 `HubRefCache.set('projects')` | 案場 CRUD 後清快取 |

**與其他快取的分工**

| 模組 | 管什麼 | 為什麼分開 |
|------|--------|------------|
| `OperatorContext` | 操作者 `userId`／權限／`hubLiffId` | **授權**；`sessionStorage`、到分頁關閉 |
| `HubRefCache` | 員工／案場／顧客**參考名冊** | 全站共用、長 TTL；**非授權** |
| `AccountingCache` | 會計 bootstrap（廠商、帳戶…） | 依 **userId** 分 key；含會計專用主檔 |
| `AccountingListCache` | 交易列表、LINE 聯絡人、portal 案號 | 列表依 userId；`official_customer` 已併入 `HubRefCache` |

詳見 [`18_會計與主檔快取策略.md`](18_會計與主檔快取策略.md) §4、§9（HubRefCache）。
### 2.3 僅當次有效（可傳、不持久）

| 資料 | 說明 | 壽命 |
|------|------|------|
| **LIFF `id_token`** | 方案 A 下員工以 **HUB 官方 LIFF** 為準；會計 LINE（廠商用）token **不能**當員工登入 | 記憶體；過期需重新 `liff.login` |
| **款項待辦摘要** | HUB 側邊欄 `pendingReview` | `localStorage` 日快取 `spa_hub_payment_todos_{date}`，當日 |
| **篩選條件** | 審核列表關鍵字等 | 可選 `sessionStorage`，實作未定 |

---

## 3. 不應當成「全域」傳承的資料

| 類別 | 原因 | 正確做法 |
|------|------|----------|
| **會計假身分 `DEV_BYPASS`** | 僅開發 bypass；權限預設 4 | 有 HUB `uid` 時必須改查 Checkin；見 backend `ACCOUNTING_DEV_USER_ID` |
| **廠商 `vendor_id`／廠商 LINE `line_user_id`** | 廠商身分 ≠ 員工 `userId` | 廠商請款、廠商入口各自驗證 |
| **project-console 案場 JWT／secret** | 不同 GAS 專案 | 各模組自有 API |
| **考勤打卡當日狀態** | 高頻變動 | Checkin API 即時查 |
| **薪資、個人出勤** | 敏感 | 不進 long TTL cache（見規劃書 17） |

---

## 4. HUB → iframe 傳參協定（現行）

`spa/app.js` 對所有 `iframe` 路由附加：

```
?uid={userProfile.userId}
&name={userProfile.displayName}
&permission={currentUser.permission}
&hub_liff_id={CONFIG.HUB_LIFF_ID}
&shiftStart=…&shiftEnd=…
```

| 參數 | 對應全域欄位 | 會計頁消費方式 |
|------|----------------|----------------|
| `uid` | `userId` | `OperatorContext` → `dev_user_id`（bypass）或顯示用 |
| `name` | `displayName` | `OperatorContext.userName`／畫面 |
| `permission` | `permission` | `OperatorContext` → `dev_permission`（bypass）；**核准仍以後端查表為準** |
| `hub_liff_id` | 官方 HUB LIFF Channel | iframe 內 `accounting_api.js` 向父層 `postMessage` 取 token；寫入 `tanxin_operator_v1.hubLiffId` |

**注意**

1. 會計子頁若用 `<a href="ledger_review.html">` **相對連結**，query 會丟失 → 靠 `OperatorContext`／`accounting_nav.js` `hubQueryString()` 延續（仍建議導覽走共用 helper）。
2. `spa/app.js` 模板須透過 `setup()` 暴露 `hubLiffId`（**不可**在模板直接讀 `CONFIG`）。
3. 其他模組（報價驗收、施工日報）已約定 `uid`／`userName`；會計應對齊同一組名稱，見 [`12_報價單審核與主控台整合規格書.md`](12_報價單審核與主控台整合規格書.md)。

---

## 5. 開發期 vs 正式期

| 模式 | GAS | 前端身分 | 權限來源 |
|------|-----|----------|----------|
| **開發 bypass** | `ACCOUNTING_AUTH_BYPASS=true` | `dev_bypass` +（應）`dev_user_id`／`dev_permission` | 優先 Checkin 查 `dev_user_id`；否則 `ACCOUNTING_DEV_PERMISSION`（預設 4） |
| **正式（方案 A）** | bypass 關閉 | HUB iframe 內：官方 LIFF `liff_id_token` 或延續 HUB 傳入之 `userId` | `verifyLiffIdToken`（**官方 Channel**）→ `fetchEmployeeByUserId_` |

**Script Properties（accounting-gas，勿寫進版控）**

| 鍵 | 用途 |
|----|------|
| `ACCOUNTING_DEV_USER_ID` | bypass 時模擬的 LINE `userId`（應設真實員工 UID） |
| `ACCOUNTING_DEV_PERMISSION` | 無法查表時的後備權限（預設 4） |
| `ACCOUNTING_DEV_USER_NAME` | bypass 顯示名 |

---

## 6. 統一 operator 快取（已實作）

實作檔：`shared/js/operator_context.js`（`sessionStorage` key：`tanxin_operator_v1`）。

```json
// sessionStorage key: tanxin_operator_v1
{
  "userId": "Uxxxxxxxx",
  "userName": "王小明",
  "displayName": "王小明",
  "permission": 5,
  "hubLiffId": "2007974938-xxxxxxxx",
  "source": "hub_iframe",
  "ts": 1719012345678
}
```

| 項目 | 規格 |
|------|------|
| **壽命** | 到瀏覽器分頁關閉；不寫 `localStorage` |
| **更新** | HUB iframe 帶新 query 時 `mergeFromUrl` 覆寫；`accounting_auth_me` 成功時 `applySession` |
| **清除** | 登出／LIFF 驗證失敗時 `OperatorContext.clear()` |
| **相容** | 仍同步寫入 legacy `acct_dev_user`／`acct_dev_perm`，舊頁可過渡讀取 |

`accounting_api.js`、`accounting_nav.js`、`accounting_boot.js` 已改讀 `OperatorContext`。

---

## 7. 實作現況對照（2026-07-12）

| 能力 | 狀態 |
|------|------|
| HUB iframe 帶 `uid`／`permission`／`hub_liff_id` | ✅ `spa/app.js`（`hubLiffId` 經 `setup()` 暴露）；**會計 iframe 等 `currentUser` 就緒再掛載**，避免 `permission` 更新整頁重載 |
| HUB 父層回應 `request_hub_liff_token` | ✅ `spa/app.js`（`refreshHubIdToken` 須與 `handleIframeMessage` **同 setup 作用域**） |
| 統一 `tanxin_operator_v1` | ✅ `operator_context.js` |
| **全站參考主檔 `HubRefCache`（`tanxin_ref_v1:*`）** | ✅ `hub_ref_cache.js`；HUB 寫入、iframe 只讀 |
| 會計讀 operator + 安全 JSON + iframe token | ✅ `accounting_api.js` v37（`window.top` 索取；token 失敗時 **暫用 operator**；殼層 `pendingTokenRequestSource` 轉發） |
| 會計導覽保留 query | ✅ `accounting_nav.js` `hubQueryString()` |
| 會計全頁 bootstrap 收斂 | ✅ `accounting_boot.js` + `modules/accounting/*.html` |
| bypass 時用 `dev_user_id` 查 Checkin 真實權限 | ✅ `AuthBridge.getDevBypassAuth_` |
| 收支登錄讀 HUB 員工／案場 | ✅ `AccountingContext` → `HubRefCache` |
| 官方顧客名冊共用快取 | ✅ `AccountingListCache` + `tanxin_ref_v1:customers` |
| 會計 bootstrap 依 `userId` 分 key | ✅ `AccountingCache` |
| HUB 傳 `group` 進 operator 快取 | ⏳ |
| 方案 A 定案（員工只走官方 LINE → HUB） | ✅ 本文件 §0 |
| 廠商綁定：會計 LINE 聯絡人 + 官方顧客列表雙搜尋 | ⏳ 見 `VENDOR_LINE_BINDING_SPEC` §6 |
| HUB `index.html` 靜態資源版號（防快取舊 `app.js`） | ✅ `?v=` 與 `FRONTEND_VERSION` 同步 |
| legacy `spa_hub_*` key 自動遷移 | ✅ 首次讀取時寫入 `tanxin_ref_v1:*` |
| **GAS Tier1 定時預熱**（員工／案場／顧客 ScriptCache） | ✅ `MasterCacheWarm.js` 兩專案；每 2h 觸發器需部署後執行 `setupHotMasterCacheWarmTriggers_` 或 Checkin `setupScheduledTriggers` |
---

## 8. 相關程式路徑

| 層 | 路徑 |
|----|------|
| HUB 傳參 | `CODING/spa/app.js`（`IframeView` `src`）、`CODING/index.html`（`hub_ref_cache.js`、`app.js?v=`） |
| 操作者快取 | `CODING/shared/js/operator_context.js` |
| **全站參考主檔** | `CODING/shared/js/hub_ref_cache.js` |
| 會計 API／session | `CODING/shared/js/accounting_api.js` |
| 會計 HUB 案場／員工 | `CODING/shared/js/accounting_context.js`（讀 `HubRefCache`） |
| 會計主檔快取 | `CODING/shared/js/accounting_cache.js` |
| 會計列表／顧客名冊 | `CODING/shared/js/accounting_list_cache.js` |
| HUB 待審紅點 | `spa/app.js`：`pendingApprovals` = 假勤 + 出勤申訴（`pendingAppeals`） |
| 會計後端驗證 | `backend/accounting-gas/core/AuthBridge.js` |
| HUB 員工 API | `backend/CheckinSystem/WebApp.js`（`get_hub_core_data`） |
| 會計對齊 Checkin ID | `backend/accounting-gas/SetupOnce.js` → `setCheckinSpreadsheetIdOnce` |
| 員工資料來源 | **同一份** Checkin 試算表、`員工資料` 分頁（§1.1） |

---

## 9. HubRefCache 模組規格（v1.5 新增）

**檔案**：`shared/js/hub_ref_cache.js` → 全域 `HubRefCache`

### 9.1 Storage 格式

```json
// localStorage: tanxin_ref_v1:employees（projects / customers 同結構）
{
  "data": [ /* 陣列 */ ],
  "expires": 1719900000000,
  "savedAt": 1719800000000
}
```

### 9.2 API（白話）

| 方法 | 用途 |
|------|------|
| `get(kind)` | 讀記憶體 → localStorage（含 legacy 遷移） |
| `set(kind, data, { days })` | 寫入 localStorage + `window.__tanxinRef` + 父層 `spaAll*`（employees/projects） |
| `read(kind)` | iframe：**父層 `spaAll*` 優先**，否則 `get` |
| `isStale(kind)` | 是否超過 24h SWR（供 HUB 背景更新判斷，可選） |
| `invalidate(kind)` | CRUD 或 postMessage 後清除 |
| `sourceLabel(kind)` | 除錯：`'parent'`／`'hub_ref_cache'`／`'none'` |

`kind`：`employees`｜`projects`｜`customers`

### 9.3 載入順序

1. HUB `index.html`：`<script src="shared/js/hub_ref_cache.js">` **早於** `spa/app.js`
2. 會計 iframe：需用 `AccountingContext` 或 `official_customer` 搜尋的頁面，在對應 script **之前**引入 `hub_ref_cache.js`
3. 未引入時：`AccountingContext` fallback legacy `spa_hub_*`；`AccountingListCache` fallback 舊 per-user master key

### 9.4 事件

寫入成功後派發 `tanxin-ref-updated`（`detail.kind`），供未來 HUB 卡片或 iframe 訂閱刷新（現行可選）。

---

## 10. 變更紀錄

| 日期 | 變更 |
|------|------|
| 2026-07-12 | v1.5.1：GAS Tier1 `warmHotMasterCaches_`（CheckinSystem 員工；project-console 案場／顧客／員工）；前端 HubRefCache |
| 2026-07-12 | v1.5：§2.2 參考主檔收斂 `HubRefCache`（`tanxin_ref_v1:*`）；§9 模組規格；§7 對照表；顧客名冊全站共用 |
| 2026-07-01 | v1.4：`get_hub_core_data` 待審紅點含 `pendingAppeals`；假勤審核／申訴 UX |
| 2026-07-01 | v1.3：§4 增 `hub_liff_id` 與 postMessage 協定；§6 OperatorContext 已實作；§7 對齊 6/30 會計收斂與 `hubLiffId` 修復；HUB `index.html` 版號防快取 |
| 2026-06-22 | v1.2：§0 定案方案 A；§1.1 改為單一員工主檔；區分員工／廠商身分；廠商雙來源搜尋列未來 |
| 2026-06-22 | v1.1：§1.1 HUB／會計可能讀不同試算表檔；三處 Script Property 對齊流程 |
| 2026-06-22 | 初版：釐清 HUB／會計 UID 與應傳承欄位、儲存層與壽命；定 `tanxin_operator_v1` 收斂方向 |
