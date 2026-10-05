# 共用開發紀錄

這是 Cursor、ChatGPT、Codex 與人工開發共同使用的唯一交接紀錄。

## 使用方式

開始修改前：

1. 執行 `git pull --ff-only origin main`。
2. 讀取本檔的「目前進行中」與最近完成項目。
3. 如果預計修改超過 10 分鐘、跨多個檔案，或可能和別人重疊，先在「目前進行中」登記範圍並推送。
4. 不要修改別人標示為進行中的相同檔案；需要重疊時先與使用者確認。

完成修改後：

1. 從「目前進行中」移除自己的項目。
2. 在「最近完成」最上方新增一筆。
3. 記錄日期、工具／開發者、修改範圍、結果、驗證方式與 commit。
4. 有未完成事項或風險時，寫進「待處理」。

## 目前進行中

| 開始時間 | 工具／開發者 | 工作內容 | 預計修改範圍 | 狀態 |
|---|---|---|---|---|
| 2026-10-05 | Cursor Cloud (bc-009e3968) | 歷史記帳點列詳情（案號／圖片集） | modules/accounting/accounting_ingest.html、shared/js/accounting_api.js；Backend accounting_ledger_detail | 進行中 |

## 最近完成

### 2026-10-05｜Cursor Cloud｜歷史記帳紀錄查詢篩選（已部署）

- 修改範圍：`accounting_ingest.html`、`index.html`、`accounting_api.js`；Backend `SheetWriter`／`AccountingLineIngest`／SPEC
- 完成內容：選單／區塊改名「歷史記帳紀錄」；篩選日期區間／類型／關鍵字／金額／只看我記的；權限 ≥3
- 驗證：後端 smoke；`node --check` api；正式站 HTML 已含「歷史記帳紀錄」與查詢控件
- Commit／線上：Backend_GAS#72 `655bb2e` → Actions → **@354**／LOG **@355**；liff-checkin#94 `fa4b5b8` → Pages 綠燈
- 待處理：真人權限 ≥3 抽測篩選；權限 2 應看不到查詢區


### 2026-10-05｜Cursor Cloud｜記帳歷史：會計選單／登錄頁近期紀錄（已部署）

- 修改範圍：`modules/accounting/accounting_ingest.html`、`index.html`、`shared/js/accounting_api.js`／`accounting_shell.js`／`accounting_ui.js`；LOG；Backend `accounting_ledger_recent`
- 完成內容：送出後「剛剛記的」補欄位；同頁「近期收支紀錄」＋會計選單「收支歷史」（`history=1`）；**僅會計模組內**；權限 **≥3**
- 驗證：`node --check`；後端 smoke；正式站 HTML 含選單／閘門字串
- Commit／線上：merge Backend_GAS#71 `87c19dd` → Actions → **@352**；liff-checkin#93 `cf1b85a` → Pages 綠燈
- 待處理：真人權限 ≥3 登入抽測送出一筆後列表是否出現


### 2026-10-05｜Cursor（TX34 本機）｜Hermes 本機知識包：MCP＋官方 LINE 進知識庫（本機／無 repo 程式改動）

- 修改範圍：僅 TX34 本機（不含 repo 程式）。本機 MCP server「tanxin」：`C:\Users\a9999\AppData\Local\hermes\mcp\tanxin-mcp\`；Cursor 使用者層 `~/.cursor/mcp.json`、Hermes `config.yaml` 註冊；Hermes tanxin-kb 匯入流程；Hermes 記憶／skill
- 原因：讓 TX34 上的 agent 能直接查公司知識（報價單、廠商報價、案件文件、官方 LINE 對話、客戶提供圖片），不必每次手動翻資料夾或 LINE 後台
- 完成內容：
  - MCP「tanxin」：stdio、只讀、6 個工具——`kb_search`（知識庫，含報價單／廠商報價／案件文件／官方 LINE 對話；問句帶「官方LINE」只搜 LINE）、`case_overview`、`find_customer_images`（Dropbox 客戶提供圖路徑）、`line_oa_digest`、`local_llm`（Ollama qwen3:8b）、`describe_image`（qwen2.5vl:7b）
  - 只有 TX34 上的 agent 能用 MCP；不在 TX34 的 agent 改走 KnowledgeBase API（ngrok）＋金鑰。備用指令列：`C:\Users\a9999\AppData\Local\hermes\kb-ask.bat "問題"`（AppData 為隱藏資料夾，搜尋要加 `-Force`）
  - 官方 LINE 對話進 Hermes tanxin-kb：source_type `line_oa`，同對話同天合併一筆；每小時（排程 Hermes LINE OA Watch 第二動作）＋每日 10:00 增量匯入。LINE 監看為只讀（Playwright 讀 chat.line.biz 後台），不回訊、不標已讀
  - Hermes 記憶／skill 補齊：LINE 監看、Camera Uploads 分類工作流、客人圖片 LINE→GAS→Dropbox 路徑
- 驗證：MCP 6 工具以 stdio client 實測成功；`hermes mcp test tanxin` 成功；Hermes 問答實際呼叫工具
- Commit／線上：僅本紀錄（docs）；無部署
- 待處理／風險：KnowledgeBase API（`C:\Users\a9999\KnowledgeBase`）加收 `line_oa` 另一工作進行中（權限 ≥2 可見），完成前 API 端查不到官方 LINE 對話；TX34 需開機登入，MCP／排程才會運作

### 2026-10-03｜Cursor Cloud｜主控台登入減少重複 GET（已部署）

- 修改範圍：`spa/app.js`、`index.html`（`v26.10.03.4`）、SPEC 19 v1.9.1、`LOG/2026-10-03_LOG_主控台登入減少重複GET.md`
- 根因：`get_hub_core_data` 只在整頁初始化打；日誌大量重複＝LIFF／連開多次完整載入。單次 0.6–3.5s 正常；店長權限清單約 43 案較重，連開＋GAS 排隊拉長體感。舊程式有快取仍每輪重抓、無 single-flight／短時間合併。
- 完成內容：核心／專案同頁 single-flight；有快取改背景更新不擋驗證畫面；session 20 秒內剛抓過或上一輪仍在飛則略過本輪（有快取才略過）；手動重試／invalidate 仍立刻重抓
- 驗證：`node --check spa/app.js`；合併策略單元情境（cold／warm／剛抓過／inflight 重整）
- Commit／線上：merge `5f7f3cb`（[PR #90](https://github.com/nephi4377/liff-checkin/pull/90)）→ Pages（見 LOG／store `docs/deploy-spa-login-slow-manager.md`）
- 待處理／風險：真人店長帳號硬重整主控台，對 DEBUG 確認 20 秒內連開核心／專案不應再疊多輪；單次專案仍慢再考慮後端瘦身


### 2026-10-03｜Grok Bot（代 Nephi）｜公司知識庫 #/kb 登入憑證過期自動重新登入（PR／未部署）

- 修改範圍：`modules/kb/index.html`（每次呼叫 API 前向主控台重新索取 token 並解 JWT `exp`，剩 ≤60 秒視同過期；token 空／過期或 API 回 401 → `request_hub_liff_relogin` 自動重登一次，重新載入後自動重送剛才的問題；仍失敗才顯示錯誤＋「🔄 重新登入」按鈕；直接開頁加「用這個瀏覽器開啟主控台」連結）；`spa/app.js`（新增 `reloginHubLiff`：`liff.logout()` 後 LINE 內 reload、外部／桌機瀏覽器 `liff.login({ redirectUri })`，自動重登 2 分鐘內只一次防迴圈，按鈕 `force` 不受限；回應 iframe `request_hub_liff_relogin` → `hub_liff_relogin_result`（只收同源）；重登回來還原 `#/路由`）；`index.html` 版本 `v26.10.03.3`、`app.js?v=26.10.03.3`
- 根因：Nephi 看到的「登入憑證已過期，請關閉後從 LINE 重新開啟主控台」是前端字串（`modules/kb/index.html` 拿不到 token 時丟出），不是 API 回應（API 401 文字為「登入憑證無效或已過期…」）。主控台 `refreshHubIdToken()` 發現 `liff.getIDToken()` 已過期（LINE ID token 約 1 小時、LIFF SDK 存在 localStorage 不會自動更新）就回空字串，KB 頁直接報錯、沒有任何刷新機制；TX34 `kb_api_log.txt`／ngrok 紀錄當時無真人請求，後端（LINE verify＋GAS `accounting_auth_me`）未參與、無需修改
- 驗證：`node --check` app.js／kb 模組 script；本機 headless Chrome 模擬主控台＋模擬 API：token 空→自動重登→成功、token 剩 30 秒→重登、API 401→重登→成功、提問中過期→重登後自動重送並顯示答案、重登後仍過期→顯示「重新登入」按鈕→按下 force 重登
- Commit／線上：PR（未 merge、未上 Pages）
- 待處理／風險：真實 LINE App（LIFF browser）與桌機外部瀏覽器的 `liff.logout()`→重登流程尚未以真人帳號實測；merge 部署後請在主控台開著超過 1 小時再進 #/kb 驗證

### 2026-10-03｜Grok Bot（代 Nephi）｜公司知識庫 #/kb 權限 ≥3 → ≥2（PR／未部署）

- 修改範圍：`spa/app.js`（`canUseKnowledgeBase` ≥2、`#/kb` 路由守門 <2 導回主控台）；`spa/Dashboard.js`（卡片 ≥2）；`modules/kb/index.html`（說明文字、範例問題改真實資料）；`shared/js/config.js` 註解；`index.html` 版本 `v26.10.03.2`
- 完成內容：入口與路由守門改為權限 ≥2；實際授權仍在 TX34 知識庫 API（`kb_api.ini` `min_permission = 2`、非離職）。API 端另外：廠商報價（topic 廠商報價）僅權限 ≥3 可檢索；電話／帳號／身分證一律遮蔽、統編權限 <3 遮蔽；知識庫改用 Hermes tanxin-kb 真實資料（不含 webhook 外部進線與只有檔名的圖片），範例假資料已移出正式索引
- 驗證：`node --check` app.js／Dashboard.js／config.js；TX34 API 真資料測試（權限 2／3 對照）
- Commit／線上：PR（未 merge、未上 Pages）
- 待處理／風險：merge 後 Pages 部署才生效；API 端（TX34）已先改為 ≥2，舊前端權限 2 的人暫時看不到入口直到部署

### 2026-10-03｜Grok Bot（代 Nephi）｜公司知識庫 #/kb（PR／未部署）

- 修改範圍：新增 `modules/kb/index.html`；`shared/js/config.js`（`KB_API_BASE`）；`spa/app.js`（路由 `#/kb`、權限 ≥3 頂部分頁、權限 <3 導回主控台）；`spa/Dashboard.js`（權限 ≥3 卡片）；`index.html` 版本 `v26.10.03.1`
- 完成內容：iframe 頁向主控台索取 LIFF token（`request_hub_liff_token`，只收同源回覆）→ 呼叫 TX34 知識庫 API（ngrok 固定網域）`/api/me`、`/api/ask` → 輪詢 `/api/jobs/{id}`；只顯示答案＋來源摘錄。授權全在 API：LINE verify（Channel 2007974938）＋會計 GAS `accounting_auth_me`（只送 token，不送 user_id）→ 權限 ≥3 且非離職；網址 uid／permission 不作授權依據
- 注意：`#/knowledge` 已被 index.html 轉去公開 FAQ（SQAQ2），故用 `#/kb`
- 驗證：本機 headless Chrome（模擬主控台送 token＋真 kb_api 程式碼、模擬登入）提問→輪詢→顯示答案／來源；直接開頁顯示「請從主控台開啟」；`node --check` app.js／Dashboard.js／config.js；正式 ngrok 網址：無 token → 401、假 token → 401、CORS 只允許 https://info.tanxin.space
- Commit／線上：PR（未 merge、未上 Pages）
- 待處理／風險：TX34 需開機並登入（工作排程器 TanxinKB-API 自動開 API＋ngrok）；首次正式用 LINE 帳號實測 `/api/me`（真 token 路徑尚未以真人帳號驗證）

### 2026-10-02｜Cursor｜記帳疑重同類型＋同金額＋同日期（已部署）

- 修改範圍：`accounting_ingest.html`、SPEC 15；Backend `SheetWriter`／`AccountingLineIngest`
- 完成內容：送出前掃當月試算表，同類型＋同金額＋同日期 → 確認框顯示既有列細節；確定才 `force_duplicate`；保留指紋 TTL
- 驗證：`node modules/accounting/tools/test-form-dedup-clear.js`；後端 `test-form-dedup-type-amount-date.js`／`test-form-dedup-ttl.js`；正式站已含「同類型、同金額、同日期」；store `docs/deploy-duplicate-ledger-type-amount-date.md`
- Commit／線上：前端 merge `ce44c7f`（[PR #86](https://github.com/nephi4377/liff-checkin/pull/86)）／Pages `36982270430`；後端 merge `94c9888`（[Backend_GAS#70](https://github.com/nephi4377/Backend_GAS/pull/70)）／accounting-gas **@350**
- 待處理／風險：無；請硬重整收支登錄後抽測疑重確認


### 2026-10-01｜Cursor｜薪資審核「此筆已審核過」冪等（已部署）

- 修改範圍：`payroll_review.html`、`accounting_ui.js`；Backend `PayrollSettlementModule.js`
- 完成內容：後端已審改冪等成功；退回不可覆寫已審；前端軟成功刷掉待審；`dismissedPendingIds` 擋 SWR 把卡片刷回
- 驗證：`node modules/accounting/tools/test-payroll-already-reviewed.js`；正式站已含 `dismissedPendingIds`；store `docs/deploy-payroll-already-reviewed.md`
- Commit／線上：前端 merge `f5c8a5d`（PR #84）／Pages `36887155416`；後端 merge `648e0f8`（PR #68）／accounting-gas **@348**
- 待處理／風險：無；請硬重整薪資審核後抽測核准／已審再按

### 2026-10-01｜Cursor｜薪資 EMAIL 手動寄送誤報（已部署）

- 修改範圍：`payroll_finance.html`、`payroll_backfill.html`、測試；後端 `PayrollPayslipModule`／`PayrollSettlementModule`
- 完成內容：僅 `manual_required`／寄信失敗才顯示「EMAIL 待手動寄送」；改 warn 避免錯誤回報／送到 AI；成功摘要顯示已 EMAIL 筆數；後端成功不回 draft
- 驗證：`node modules/accounting/tools/test-payroll-email-manual-drafts.js`；後端 `test-payroll-email-draft-gate.js`；store `docs/deploy-payroll-email-manual-send.md`
- Commit／線上：前端 merge `7148042`（PR #85）／Pages `36882750487`；後端 merge `1679565`（PR #69）／accounting-gas **@346**
- 待處理／風險：無；請硬重整薪資待匯款後抽測「標記已發薪」

### 2026-09-30｜Cursor｜案件毛利 margin_list_overview 逾時（已部署）

- 修改範圍：後端 `MarginModule.js`；前端 `accounting_api.js`／`project_margin.html`；SPEC 15 v1.35
- 完成內容：列表不再每次全表逐列校正分頁名（改 6h 節流＋最多 40 列批次寫）；前端逾時 120s
- 驗證：`node accounting-gas/tools/test-margin-tab-sync-plan.js`；正式站已含 120s／`?v=60`；store `docs/deploy-margin-list-timeout.md`
- Commit／線上：前端 merge `e32b0a8`（PR #83）／Pages `36734580646`；後端 merge `8610f1b`（PR #67）／accounting-gas **@344**
- 待處理／風險：無；請硬重整後抽測案件毛利列表

### 2026-09-24｜Cursor｜表單假失敗防重送＋三種結果畫面（已部署）

- 修改範圍：`accounting_ingest.html`、`shared/js/accounting_api.js`、SPEC 15 v1.34；後端 accounting-gas 表單 ingest／flush
- 完成內容：主列寫入即成功、後置背景補；三種畫面（成功／已記入但後置失敗／未成功請重試）；保留疑重確認＋成功後清空；逾時勿盲目重送
- 驗證：單元 smoke；正式站已含 flush／三種文案／120s；store `docs/deploy-ledger-false-fail.md`
- Commit／線上：前端 merge `3f680b8`（PR #80）／Pages `35946245702`；後端 merge `6f8b439`（PR #66）／accounting-gas **@342**
- 待處理／風險：76／77 作廢仍請人工；請硬重整後抽測收支登錄

### 2026-09-23｜Cursor｜表單疑重確認＋送出清空（PR／未部署）

- 修改範圍：`modules/accounting/accounting_ingest.html`；後端見 Backend_GAS accounting-gas
- 完成內容：疑重時確認框（文案對齊群組「看起來和剛才一樣」）；確認才 `force_duplicate`；**送出成功後清空**金額／品名／分攤／附件／零用金／款項月份
- 驗證：`node modules/accounting/tools/test-form-dedup-clear.js`；後端 `node accounting-gas/tools/test-form-dedup-ttl.js`；store `internal/ledger-form-dedup-clear-verify.md`
- Commit／線上：見 PR #80／Backend #66（未 Pages／未 clasp deploy）
- 待處理／風險：第 77 列是否作廢請人工；正式部署另說

### 2026-09-23｜Cursor｜表單記帳疑重確認（PR／未部署）

- 修改範圍：`modules/accounting/accounting_ingest.html`；後端見 Backend_GAS accounting-gas
- 完成內容：LIFF 送出若判定與稍早同對象同金額，先確認再強制第二筆；搭配後端去重 TTL 加長
- 驗證：對照「115年9月」76／77 稽核為兩次 liff_form；程式邏輯檢視
- Commit／線上：見 PR（未 Pages／未 clasp deploy）
- 待處理／風險：第 77 列是否作廢請人工；正式部署另說


### 2026-09-22｜Cursor｜LINE 開案場遇 quota（已部署）

- 修改範圍：前端 `projectApi`／`ui`／`main`／`managementconsole`；後端 project-console Drive 門牌＋快取＋page=project 容錯
- 完成內容：配額錯誤人話＋再試；GET 接 success:false；後端少驗 Drive、快取寫入不拋、子步驟失敗仍出殼
- 驗證：Playwright 模擬 quota；正式 `page=project&id=726` success；Pages 已含 `main.js?v=26.09.22.1`
- Commit／線上：前端 merge `fd9ef7a`／Pages `35709019967`；後端 merge `96df72a`／Actions `35709002754` → project-console **@626**
- 待處理／風險：無；面談開案場請硬重整後抽測 #726

### 2026-09-21｜Cursor｜匯款通知改推群組＋佇列不算已通知（已部署）

- 修改範圍：`vendors.html`（綁定／補通知摘要顯示 UID／GID）；後端 `VendorLineBinding`／`LineMessaging`／稽核
- 完成內容：綁定群組 GID 也可收【匯款通知】純文字；進 Reply 佇列改為失敗（名冊不標假「已通知」）
- 驗證：正式站 `vendors.html` 已含群組文案／`?v=64`；請真人：名冊懋桔→已匯款→補通知→**手機群組**找【匯款通知】
- Commit：前端 merge `f4e4bf7`（PR #77）／Pages run `35582996609`→LOG `34fbbe8`；後端 merge `be8671a`（PR #55）／accounting-gas **@337**→LOG 後 **@338**
- 待處理／風險：無（前後端已一併上線）

### 2026-09-21｜Cursor｜名冊已匯款補通知＋通知標記（已部署）

- 修改範圍：`vendors.html`、`accounting_api.js`、SPEC／LOG；後端 Backend_GAS accounting-gas
- 完成內容：已匯款列通知小標記；≥4「補通知」只重送 LINE；status 帶回 last_notify_*
- 驗證：store `internal/vendor-resend-notify-verify.md`；正式站 `vendors.html` 已含補通知／標記；請硬重整後抽測
- Commit：前端 merge `6e9a58f`（PR #76）／Pages run `35580821976`；後端 merge `22d440c`（PR #51）／accounting-gas **@335**→LOG 後 **@336**
- 待處理／風險：無（前後端已一併上線）；真人抽測：名冊→已匯款列看標記→補通知


### 2026-09-21｜Cursor｜標記已匯款加速第 1 刀（已部署）

- 修改範圍：`modules/accounting/vendor_payment_finance.html`、`shared/js/accounting_api.js`、SPEC／LOG／help；後端 Backend_GAS `accounting-gas`
- 完成內容：逐筆 LINE 勾選（預設開）、確認 N／M、多筆進度、通知結果摘要；標記後背景 flush 後置 token
- 驗證：本機見 store `internal/mark-paid-phase1-verify.md`；正式站請硬重整後抽測待匯款→勾選→確認 N／M→標記
- Commit：前端 merge `0129009`（PR #75）／Pages run `35564644001`；後端 merge `a63966b`（PR #50）／accounting-gas **@333**
- 待處理／風險：無（前後端已一併上線）

### 2026-09-21｜Codex｜待付款請款辨識提醒不再誤報為錯誤

- 修改範圍：`modules/accounting/payment_request.html`
- 完成內容：待付款請款模式隱藏多餘的「套用至表單」按鈕；舊快取或特殊狀況觸發時改為一般提醒，不再產生正式錯誤回報。
- 驗證：確認請款模式初始化會隱藏按鈕，備援點擊路徑使用 `setWarn`，不會進入錯誤回報流程。
- Commit：見本紀錄所在提交。
- 待處理／風險：存檔歸檔已轉往 `quick_review.html`，原有 archive 分支保留相容性。

### 2026-09-20｜Cursor｜會計分攤明細打字不失焦（部署）

- 修改範圍：`shared/js/accounting_form_helpers.js`、`modules/accounting/accounting_ingest.html`；SPEC／LOG
- 完成內容：分攤案號／金額連打不再整表重繪失焦；helpers `?v=6`；合 PR #74 並上 Pages
- 驗證：PR 內單元／GUI；正式站請硬重整後抽測收支登錄→支出→分攤
- Commit：merge `9bb97cd`（PR #74）；文件 `0dcfea1`（Pages 綠燈）
- 待處理／風險：無（後端未動）

### 2026-09-19｜Codex｜舊作品集轉址與 sitemap 整理

- 修改範圍：`modules/info/cases/*.html`、`modules/info/cases/index.html`、`sitemap.xml`
- 完成內容：55 個舊案例頁與舊作品集首頁改為導向 WordPress 新作品集；舊站 sitemap 移除重複案例網址。
- WordPress：補上遺漏的案例 #626；作品集目前共 55 案。
- 驗證：GitHub Pages 部署成功；舊 #150、#626 與案例首頁均已實測導向新官網；SEOPress sitemap 健康檢查 13 項通過。
- Commit：`d35b16f seo: redirect legacy portfolio cases to WordPress`

## 待處理

- 修正 WordPress 案例搬移後殘留的錯誤站內連結，例如 #150 的 `/portfolio//blog/` 與 #626 的 `SQAQ2.html` 連結。
- 統一案例 SEO 標題，避免案號或品牌名稱重複。
- 建立台南、高雄、老屋翻新、透天住宅等主題入口頁。

## 紀錄格式

```md
### YYYY-MM-DD HH:mm｜工具／開發者｜工作名稱

- 修改範圍：
- 完成內容：
- 驗證：
- Commit：
- 待處理／風險：
```
