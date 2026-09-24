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
| — | — | 目前無進行中工作 | — | — |

## 最近完成

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
