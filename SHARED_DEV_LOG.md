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

（無）

## 最近完成

### 2026-10-07｜Cursor Cloud｜請款審核 ≥3 改廠商／分攤／稅別／備註＋刪除（已上線 @404）

- 修改範圍：`ledger_review.html`、`accounting_api.js?v=100`、SPEC 15 v1.60、LOG、smoke；Backend `LedgerReviewModule`／`VendorPaymentModule`／SPEC／LOG／smoke
- 完成內容：審核**顯示**歷史錯誤標示；≥3 可改**廠商／分攤／稅別／備註**並儲存、**刪除**未匯款；**無**審核頁「錯誤記帳標示」寫入；`vendor_payment_update` 可帶 `vendor_id`；核准／退回仍 ≥5
- 驗證：煙測 OK；正式站 curl `api?v=100`／「廠商／分攤／稅別／備註」／無「錯誤記帳標示」
- Commit／線上：[liff#136](https://github.com/nephi4377/liff-checkin/pull/136) → Pages [`37568963068`](https://github.com/nephi4377/liff-checkin/actions/runs/37568963068)；[GAS#118](https://github.com/nephi4377/Backend_GAS/pull/118) → clasp **@404**（LOG 補推 **@405** 同程式）
- 待處理：權限 3 抽測改／刪；標示仍走歷史記帳；≥5 核准；已匯款不可刪

### 2026-10-07｜Cursor Cloud｜權限3僅檢視請款審核（已上線 @402）

- 修改範圍：`ledger_review.html`、`index.html`、`spa/app.js`、`HubLeftSidebar.js`、SPEC 15／19／流程、help；Backend `LedgerReviewModule`／`VendorPaymentModule`／SPEC／LOG
- 完成內容：≥3 可開請款審核列表／詳情／附件；隱藏核准／退回／改分攤；後端 list／bundle 檢視 ≥3，approve／reject 仍 ≥5
- 驗證：`node modules/accounting/tools/test-ledger-review-perm3-view.js`；GAS 同名煙測；正式站 curl「查看詳情」「檢視 ≥3 · 核准 ≥5」
- Commit／線上：[liff#135](https://github.com/nephi4377/liff-checkin/pull/135) → Pages [`37564166303`](https://github.com/nephi4377/liff-checkin/actions/runs/37564166303)；[GAS#117](https://github.com/nephi4377/Backend_GAS/pull/117) → [`37564150322`](https://github.com/nephi4377/Backend_GAS/actions/runs/37564150322) clasp **@402**
- 待處理：權限 3 抽測可看不可核准；權限 5 核准仍可用

### 2026-10-07｜Cursor Cloud｜重複記帳提醒頁內確認（FE 已上線；GAS 隨 @402）

- 修改範圍：`accounting_ingest.html`（頁內 `#dupConfirmOverlay`）、`accounting_api.js?v=95` soft `needs_dup_confirm`、SPEC 15 v1.39、LOG；Backend `SheetWriter` 日期正規化＋`skipDedup`（[GAS#116](https://github.com/nephi4377/Backend_GAS/pull/116)）
- 根因：`window.confirm` 在主控台巢狀 iframe＋await 後常被擋；疑重回應被當 API 失敗噴錯誤回報
- 驗證：`test-form-dedup-clear.js` OK；正式站已含 `askDupConfirm`／`api?v=95`
- Commit／線上：FE merge [PR #134](https://github.com/nephi4377/liff-checkin/pull/134)／Pages `37557772079`；GAS merge #116 後隨 [#117](https://github.com/nephi4377/Backend_GAS/pull/117) clasp **@402** 一併上線（先前卡 200 versions 已解）
- 待處理：抽測同類型＋金額＋日期再送

### 2026-10-07｜Cursor Cloud｜請款錯誤標示送出修復＋按鈕縮小（隨 @402）

- 修改範圍：`ledger_history.html`、`accounting_api.js?v=95`、SPEC 15、LOG、smoke；Backend `AccountingLineIngest`／CI prune／SPEC／test
- 完成內容：填原因送出時請款只帶 UUID（例 `568e45d0-…`），不帶空 sheet/row；按鈕改小仍可點
- 驗證：`node modules/accounting/tools/test-ledger-flag-button-visible.js`；GAS flag／recent smoke OK
- Commit／線上：見 PR `cursor/payment-flag-submit-fix-8a21`；GAS 隨 **@402** 上線
- 待處理：點 新弘 請款詳情「錯誤記帳標示」填原因確認


### 2026-10-06｜Cursor Cloud｜待付款請款「錯誤記帳標示」＋勿框選（待 merge／部署）

- 修改範圍：`ledger_history.html`、`accounting_api.js?v=94`、SPEC 15、LOG、smoke；Backend `AccountingLineIngest`／`VendorPaymentModule`／SPEC／test
- 完成內容：老闆「不是框選」——拿掉置頂可標示區與截斷優先 `can_flag`；**請款＋收支每一列** ≥3 都有「錯誤記帳標示」＋頁內必填原因；請款寫主檔 note `[error_flag:]`（例：新弘 $2413 案726／`568e45d0-…`）
- 驗證：`node modules/accounting/tools/test-ledger-flag-button-visible.js`；GAS `test-ledger-recent-history`／`test-ledger-flag-delete-perms` OK
- Commit／線上：見本輪 PR（merge main 後 Pages `v=94`＋clasp）
- 待處理：Yang 重開歷史記帳 → 點黃標新弘列「錯誤記帳標示」→ 填原因 → 確認

### 2026-10-06｜Cursor Cloud｜歷史記帳混合來源逾時／無藍標 hotfix（已上線 @396）

- 修改範圍：`ledger_history.html`、`accounting_api.js`、SPEC 15、LOG；Backend SheetWriter／Ingest／VendorPayment／SPEC／test
- 根因：雙來源先掃 12 月收支（可到 50s）再讀請款主檔兩次 → 破前端 90s Abort；藍標收支進不來（只剩黃標或整頁逾時）
- 完成內容：請款主檔先讀一次；收支共用 ~28s／軟截止 18s／每頁 2 塊；前端不重試 HTML 404；`api?v=92`；狀態列藍／黃筆數
- 驗證：單元煙測 OK；auth-fail `ledger_recent` ~2.1s（先前同呼叫可卡 ~59s）；正式站含 `v=92`／藍黃 badge
- Commit／線上：[liff#129](https://github.com/nephi4377/liff-checkin/pull/129) → Pages [`37437189549`](https://github.com/nephi4377/liff-checkin/actions/runs/37437189549)；[GAS#108](https://github.com/nephi4377/Backend_GAS/pull/108) → [`37437184427`](https://github.com/nephi4377/Backend_GAS/actions/runs/37437184427) clasp **@396**
- 待處理：Yang 關舊分頁重開 → 全部 → 應見黃標＋藍標；狀態列有藍N/黃M；點藍標列可開詳情／標註錯誤

### 2026-10-06｜Cursor Cloud｜歷史記帳「標註錯誤」可見＋必填原因 hotfix

- 修改範圍：`ledger_history.html`、`accounting_api.js`、`accounting_nav.js`、`index.html`、SPEC 15、LOG、smoke test；Backend SheetWriter／Ingest
- 完成內容：藍標列表／詳情置頂可按「標註錯誤」；必填錯誤原因寫入 `[error_flag:… reason:…]`；列表／詳情顯示原因；`api?v=91`
- 驗證：flag／mixed／GAS flag smoke OK
- Commit／線上：[liff#128](https://github.com/nephi4377/liff-checkin/pull/128) → Pages [`37431449649`](https://github.com/nephi4377/liff-checkin/actions/runs/37431449649) `api?v=91`；[GAS#107](https://github.com/nephi4377/Backend_GAS/pull/107) → [`37431455841`](https://github.com/nephi4377/Backend_GAS/actions/runs/37431455841) clasp **@395**
- 待處理：Yang 重開 → 收支登錄 → 標註錯誤 → 輸入原因


### 2026-10-06｜Cursor Cloud｜歷史記帳雙來源：待付款請款＋收支登錄（已上線 @393）

- 修改範圍：`ledger_history.html`、`accounting_api.js`、SPEC 15；Backend `VendorPaymentModule`／`AccountingLineIngest`／SPEC
- 完成內容：歷史預設混排兩種來源；分頁篩選；列表標籤可辨；請款唯讀 ≥3；標註／改／刪仍只適用收支
- 驗證：單元測試 OK；Pages 含 `v=89`／來源分頁；clasp **@393**
- Commit／線上：[GAS#105](https://github.com/nephi4377/Backend_GAS/pull/105) → Actions [`37428487693`](https://github.com/nephi4377/Backend_GAS/actions/runs/37428487693) → **@393**；[liff#126](https://github.com/nephi4377/liff-checkin/pull/126) → Pages [`37428493563`](https://github.com/nephi4377/liff-checkin/actions/runs/37428493563)
- 待處理：Yang（權限 3）抽測混合列表與請款唯讀

### 2026-10-06｜Cursor Cloud｜歷史記帳近期收支 90s 逾時 hotfix（已上線 @391）

- 修改範圍：Backend `SheetWriter.js`／SPEC／test；前端 `ledger_history.html`／`accounting_api.js`／LOG
- 根因：≥3 全部人掃 12 月時，無「記帳時間」舊月塊不 early-stop → 整月空轉拖到前端 90s Abort
- 完成內容：無戳記資料塊停月；每頁最多 4 塊；掃表軟截止 50s；`COLLECT_CAP` 200；正式站 `api?v=88`；**不加長** timeout
- 驗證：`node accounting-gas/tools/test-ledger-recent-history.js`；正式站 HTML 含 `api?v=88`／recent-timeout
- Commit／線上：[GAS#103](https://github.com/nephi4377/Backend_GAS/pull/103) → Actions [`37427760840`](https://github.com/nephi4377/Backend_GAS/actions/runs/37427760840) → **@391**；[liff#124](https://github.com/nephi4377/liff-checkin/pull/124) → Pages [`37427765423`](https://github.com/nephi4377/liff-checkin/actions/runs/37427765423)
- 待處理：Yang／老闆重開歷史記帳抽測「近期收支」應數秒內出列表

### 2026-10-06｜Cursor Cloud｜歷史記帳標註／刪除／改帳>4（已上線 @389）

- 修改範圍：`ledger_history.html`、`accounting_api.js`、SPEC 15；Backend SheetWriter／Ingest／WebApp／SPEC／測試
- 完成內容：**僅歷史記帳**——標註錯誤 ≥3；刪除已標註 ≥4；修改記帳需 **>4**（Yang=3 可標不可改）。備註 `[error_flag:]`；刪除作廢 `[void:]`
- 驗證：單元測試；正式站應含「標註錯誤」／`api?v=87`；Pages＋clasp **@389**
- Commit／線上：[liff#122](https://github.com/nephi4377/liff-checkin/pull/122) → Pages [`37426660019`](https://github.com/nephi4377/liff-checkin/actions/runs/37426660019)；[GAS#101](https://github.com/nephi4377/Backend_GAS/pull/101) → Actions [`37426581759`](https://github.com/nephi4377/Backend_GAS/actions/runs/37426581759) → **@389**
- 待處理：老闆抽測：權限3標註、權限4刪已標、權限>4改帳

### 2026-10-06｜Cursor Cloud｜歷史記帳查詢重做（已上線 @387）

- 修改範圍：`ledger_history.html`、`accounting_api.js`、SPEC 15；Backend Ingest／SPEC／測試；文案對齊 PR#120
- 完成內容：≥3 可看全部；**暫緩**強制 mine_only（選用）；嚴格 `recorded_at` 新→舊（Boss 例：10:00 中和基電 > 09:00 弘基傢俱）；勿用交易日排序；查詢頁不暗示 ≥3 可改帳（改帳>4 由 sibling）
- 驗證：單元測試；正式站 `api?v=86`／選用／無 forceMineOnlyOn／`sortHistoryByRecordedAtOnly`；Pages＋clasp **@387**
- Commit／線上：[liff#119](https://github.com/nephi4377/liff-checkin/pull/119)＋[#120](https://github.com/nephi4377/liff-checkin/pull/120) → Pages [`37426257926`](https://github.com/nephi4377/liff-checkin/actions/runs/37426257926)；[GAS#99](https://github.com/nephi4377/Backend_GAS/pull/99) → Actions [`37425723319`](https://github.com/nephi4377/Backend_GAS/actions/runs/37425723319) → **@387**
- 待處理：老闆真人抽測排序；標註／刪除／改帳>4（sibling）

### 2026-10-06｜Cursor Cloud｜可修改已送出的記帳（已上線 @385）

- 修改範圍：`ledger_history.html`、`accounting_api.js`／`ui`；Backend SheetWriter／Ingest／WebApp／SPEC／測試
- 完成內容：歷史詳情「修改這一筆」——金額／對象／事由／備註／交易日／付款／案號／店別／追加照片；保留新增時間 `recorded_at`；寫入上次修改 `edited_at`；≥3 本人、≥4 可改他人；換月搬列
- 驗證：單元測試；正式站 HTML 含「修改這一筆」／`api?v=84`；Pages＋clasp **@385**
- Commit／線上：[liff#117](https://github.com/nephi4377/liff-checkin/pull/117) → Pages [`37425046756`](https://github.com/nephi4377/liff-checkin/actions/runs/37425046756)；[GAS#97](https://github.com/nephi4377/Backend_GAS/pull/97) → Actions [`37425040465`](https://github.com/nephi4377/Backend_GAS/actions/runs/37425040465) → **@385**
- 待處理：老闆真人抽測修改流程；查詢重做（≥3 可看、暫緩只看個人、嚴格 recorded_at 排序）下一步

### 2026-10-06｜Cursor Cloud｜老闆：查詢重做排隊（edit 上線後）

- 規則已存 Project store：權限≥3 可看；暫緩只看個人；排序＝送出時間 recorded_at 新→舊
- 待處理：edit 已上線 → 可開查詢重做

### 2026-10-06｜Cursor Cloud｜記帳詳情 60s 逾時 hotfix（已上線 @381）

- 修改範圍：`ledger_history.html`、`accounting_api.js`／`accounting_ui.js`、SPEC 15；Backend SheetWriter／LedgerPostIngest／Ingest
- 根因：點列 `accounting_ledger_detail` 預設 Abort **60s**；尖峰掃附件索引（曾雙次全表）＋GAS 排隊拖到逾時 → 錯誤回報「記帳詳情 · 60.0 秒」
- 完成內容：點列先用**列表摘要**；詳情預設 lean（`skip_attachments`）；15s 軟失敗不噴錯誤回報；圖片集另載；後端單次欄位定向掃附件
- 驗證：單元測試；正式站 `api?v=81`／`ui?v=27`；probe lean `attachments_deferred=true` ~3s；Pages＋clasp **@381**
- Commit／線上：[liff#112](https://github.com/nephi4377/liff-checkin/pull/112) → Pages [`37423041183`](https://github.com/nephi4377/liff-checkin/actions/runs/37423041183)；[GAS#92](https://github.com/nephi4377/Backend_GAS/pull/92) → Actions [`37423048868`](https://github.com/nephi4377/Backend_GAS/actions/runs/37423048868) → **@381**
- 待處理：楊婕妤從主控台重開歷史記帳→點任一列；應秒見案號，不應再出現 60s 錯誤回報

### 2026-10-06｜Cursor Cloud｜歷史依新增時間嚴格新→舊（已上線 @379）

- 修改範圍：Backend `SheetWriter`／Ingest／SPEC／測試；前端 `ledger_history.html`、SPEC 15
- 根因：掃表途中用回傳 limit 提早停 → 倒填舊交易日的新送出可能被擠掉
- 完成內容：先收齊窗內候選再依 `recorded_at` 新→舊截斷；UI「依新增時間」；前端不依交易日重排
- 驗證：單元 proof（晚送出＋舊交易日置頂）；正式站文案＋`api?v=80`；clasp **@379**
- Commit／線上：[GAS#91](https://github.com/nephi4377/Backend_GAS/pull/91) → Actions [`37422828383`](https://github.com/nephi4377/Backend_GAS/actions/runs/37422828383) → **@379**；[liff#111](https://github.com/nephi4377/liff-checkin/pull/111) → Pages [`37422832681`](https://github.com/nephi4377/liff-checkin/actions/runs/37422832681)
- 待處理：老闆抽測：剛送出（交易日可更早）應在列表最上方

### 2026-10-06｜Cursor Cloud｜請款驗證身分 20s 逾時 hotfix（已上線 @376）

- 修改範圍：`payment_request.html`（AccountingBoot＋cache-bust）、`accounting_api.js`／`accounting_boot.js`／`accounting_ui.js`、SPEC 19；Backend AuthBridge
- 根因：正式站請款頁仍鎖舊 `api?v=63`；選單背景 auth_me 逾時仍噴錯誤回報；payment_request_auth_me 仍清快取／稽核可擋
- 完成內容：hub uid 暫用進門不乾等 20s；auth 逾時軟性 log；後端對齊 @369
- 驗證：單元煙測 OK；正式站 `payment_request` 含 `api?v=79`／`boot?v=11`；Pages＋clasp **@376**
- Commit／線上：[liff#109](https://github.com/nephi4377/liff-checkin/pull/109) → Pages [`37421658336`](https://github.com/nephi4377/liff-checkin/actions/runs/37421658336)；[GAS#89](https://github.com/nephi4377/Backend_GAS/pull/89) → Actions [`37421664569`](https://github.com/nephi4377/Backend_GAS/actions/runs/37421664569) → **@376**
- 待處理：老闆從主控台重開會計→待付款請款應秒開（勿乾等驗證身分）

### 2026-10-06｜Cursor Cloud｜Codex P1 記帳時間窗掃月（跟進 #85/#105）

- 修改範圍：ledger_history 不傳 months；api 不預設 months；Backend LEDGER_HISTORY_SHEET_MONTHS_=12
- 完成內容：倒填交易日仍可被記帳時間近7天掃到（最多12個交易月分頁）
- 驗證：單元測試；正式站 v=79 不傳 months；clasp **@375**
- Commit／線上：[GAS#87](https://github.com/nephi4377/Backend_GAS/pull/87) → **@375**；[liff#107](https://github.com/nephi4377/liff-checkin/pull/107) → Pages
- 待處理：無

### 2026-10-06｜Cursor Cloud｜歷史近N天改依送出／寫入時間（已上線 @373）

- 修改範圍：Backend SheetWriter／Ingest／SPEC；前端 ledger_history／accounting_api／SPEC 15
- 完成內容：近7／30天窗＋排序＝按下送出時間（recorded_at），不是交易日；舊列無戳記仍納入；UI 文案釐清
- 驗證：單元測試；bound proof（倒填交易日仍入窗）；正式站文案＋v=78；clasp **@373**
- Commit／線上：[GAS#85](https://github.com/nephi4377/Backend_GAS/pull/85) → Actions [`37421112662`](https://github.com/nephi4377/Backend_GAS/actions/runs/37421112662) → **@373**；[liff#105](https://github.com/nephi4377/liff-checkin/pull/105) → Pages [`37421116022`](https://github.com/nephi4377/liff-checkin/actions/runs/37421116022)
- 待處理：老闆／Yang 真人抽測本人近七天（應見剛送出、交易日可更早的列）

### 2026-10-06｜Cursor Cloud｜會計驗證身分 60s 逾時 hotfix（已上線 @369）

- 修改範圍：`operator_context.js`、`accounting_api.js`、`accounting_boot.js`、`index.html`／`ledger_history.html`、SPEC 19；Backend AuthBridge／AuditLog
- 完成內容：主控台網址身分先暫用進門；auth_me 逾時 20s 可降級；後端不再每次清員工快取；稽核失敗不擋登入
- 驗證：單元煙測 OK；正式站 HTML `accounting_api.js?v=77`；Pages＋clasp **@369**
- Commit／線上：[liff#103](https://github.com/nephi4377/liff-checkin/pull/103) → Pages [`37419660623`](https://github.com/nephi4377/liff-checkin/actions/runs/37419660623)；[GAS#81](https://github.com/nephi4377/Backend_GAS/pull/81) → Actions [`37419647847`](https://github.com/nephi4377/Backend_GAS/actions/runs/37419647847) → **@369**
- 待處理：請老闆從主控台重開會計抽測（選單應秒開）


### 2026-10-06｜Cursor Cloud｜歷史記帳又慢又空 hotfix（已上線 @367）

- 修改範圍：`ledger_history.html`、`accounting_api.js`；Backend `VendorPortal.js`／`SheetWriter.js`／`AccountingLineIngest.js`
- 根因：民國分頁名字串排序把 9 月排在 10 月前 → 近七天跨月掃錯月整表空轉；本人模式不提早停 → 又慢又空
- 完成內容：數值年月排序；預設本人強制 ON、「所有人紀錄」opt-in；預設 7／上限 30；交易日篩選、記帳時間只排序；空狀態擴查按鈕
- 驗證：後端單元測試；正式站 HTML 含所有人紀錄／v=76；bound proof（修前掃9+8、修後10+9）
- Commit／線上：[liff#101](https://github.com/nephi4377/liff-checkin/pull/101) `4529cfc` → Pages [`37418214431`](https://github.com/nephi4377/liff-checkin/actions/runs/37418214431)；[GAS#79](https://github.com/nephi4377/Backend_GAS/pull/79) `d1f76d5` → Actions [`37418207375`](https://github.com/nephi4377/Backend_GAS/actions/runs/37418207375) → **@367**
- 待處理：老闆真人抽測本人近七天應見本月帳且明顯變快

### 2026-10-06｜Cursor Cloud｜請款／歷史記帳 PR 合併部署（已上線）

- 修改範圍：merge [liff-checkin#100](https://github.com/nephi4377/liff-checkin/pull/100)、[Backend_GAS#78](https://github.com/nephi4377/Backend_GAS/pull/78)；Pages＋accounting-gas clasp
- 完成內容：請款中排版／燈箱／已完成；歷史近七天／只看我記的／已記帳時間排序；廠商搜尋；mine_only／快取整理（見下方同日條目）
- 驗證：正式站 `payment_request.html` 含 AccountingLightbox／已完成；`ledger_history.html` 含只看我記的／近 7 天／已記帳時間；Actions clasp **@365**
- Commit／線上：Backend_GAS#78 `b6652d5` → Actions [`37410319724`](https://github.com/nephi4377/Backend_GAS/actions/runs/37410319724) → **@365**（deploymentId `AKfycbyibVTQk2eYEYXX5vb-TUFYsLIKWEg1bADR-7w1QFSg6kly3gyDAG3GkKuvQ0PBur05DA`）；liff-checkin#100 `08ce628` → Pages [`37410324587`](https://github.com/nephi4377/liff-checkin/actions/runs/37410324587) → https://info.tanxin.space/
- 待處理：真人抽測請款中／已完成、只看我記的、近七天排序、待付款搜廠商

### 2026-10-06｜Cursor Cloud｜待付款請款可直接搜廠商＋顯示分類

- 修改範圍：`payment_request.html`、`accounting_form_helpers.js`
- 完成內容：待付款請款廠商區改為優先「直接搜尋廠商名稱」；選中後顯示工項分類並同步分類下拉；搜尋掃全部名冊
- 驗證：字串／結構檢查；本地 serve 抽測；正式站已含於 #100 Pages
- Commit／線上：liff-checkin#100 `08ce628` → Pages（已部署）
- 待處理：真人抽測搜廠商名稱與分類顯示

### 2026-10-06｜Cursor Cloud｜只看我記的大開關＋快取整理＋歷史加速

- 修改範圍：`ledger_history.html`（整列「只看我記的」開關）、`accounting_api.js`（尊重 mine_only）、`accounting_cache.js`（清 v1–v5 舊 bootstrap）、`quick_review.html`（清單快取 90s TTL）；Backend #78 併入分塊／7 天
- 完成內容：正式站舊 checkbox 擠查詢鈕改為獨立大開關；預設本人可關；清過期主檔舊 key；單據列表不快取到過期；歷史掃表分塊＋7 天硬上限
- 驗證：正式站 HTML 已含整列「只看我記的」；後端 **@365**
- Commit／線上：liff#100 `08ce628`＋Backend#78 `b6652d5` → **@365**（已部署）
- 待處理：Boss 真人確認「只看我記的」外觀與速度

### 2026-10-06｜Cursor Cloud｜歷史記帳：只看我記的排版＋近七天＋已記帳時間排序

- 修改範圍：`ledger_history.html`；Backend `SheetWriter.js`／SPEC／LOG（另 PR）
- 完成內容：「只看我記的」獨立列；預設交易日近七天；列表依已記帳時間新到舊；縮圖燈箱；先前請款中／已完成改動保留
- 驗證：正式站含「已記帳時間」／近 7 天文案；後端 **@365**
- Commit／線上：liff#100 `08ce628`＋Backend#78 `b6652d5` → **@365**（已部署）
- 待處理：真人 ≥3 抽測只看我記的／近七天／排序

### 2026-10-06｜Cursor Cloud｜請款中排版＋點圖放大＋已完成篩選

- 修改範圍：`quick_review.html`、`payment_request.html`、`shared/js/accounting_lightbox.js`、`shared/css/accounting_layout.css`、SPEC 15／資料字典、LOG
- 完成內容：列表卡／請款頁排版整理；點縮圖燈箱放大；快捷篩選「已分類」改稱「已完成」（status 仍 `已分類`）；送出成功才移出請款中的邏輯不變
- 驗證：正式站 `payment_request` 含 AccountingLightbox／已完成
- Commit／線上：liff-checkin#100 `08ce628` → Pages（已部署）
- 待處理：真人 LINE／主控台抽測點圖與已完成篩選


### 2026-10-05｜Cursor Cloud｜快審請款失敗消失＋畫面直覺（已部署）

- 修改範圍：`quick_review.html`、`payment_request.html`、`accounting_api.js`、SPEC／LOG；Backend `VendorQuickReview.js`、`PaymentRequestUnified.js`、`AccountingLineIngest.js`
- 完成內容：請款→「請款中」仍待處理、送出成功才已分類；快捷篩選「請款還沒送完」／綠框徽章／橫幅；待付款失敗條＋回列表；pending 成功才銷票
- 驗證：後端單元煙測；正式站 HTML 已含「請款還沒送完」等字串；真人抽測待做
- Commit／線上：Backend_GAS#75 `e38ca22` → Actions → **@362**；liff-checkin#97 `3f36ab0` → Pages
- 待處理／風險：真人快審→請款失敗／未送完應見「請款還沒送完」；舊誤標仍用「已分類」捷徑

### 2026-10-05｜Codex｜WordPress 案例追蹤與新頁檢查規範（已更新）

- 修改範圍：`SPEC/PORTFOLIO_GA4_TRACKING.md`、`AGENTS.md`、本交接紀錄；WordPress 正式站追蹤外掛 1.0.1。
- 完成內容：把新增案例頁的父層、slug、六種事件、CTA 與影片封面的追蹤檢查寫成固定清單。修正影片封面位於 `iframe[srcdoc]` 時外層無法收到點擊的問題。
- 驗證：WordPress 外掛頁顯示 1.0.1 且已啟用；正式案例頁載入 1.0.1 腳本；`node --check` 通過。GA4 已收到案例瀏覽與互動事件；新版影片封面實際點擊後，即時報表顯示 `youtube_click` 1 次。電話點擊尚未實測。
- Commit／線上：規範 `bf7b659`、AGENTS 指引 `218102b`；本紀錄所在提交。WordPress 外掛 1.0.1 已在正式站更新。
- 待處理／風險：新案例頁發佈前後依規範逐項測試；電話連結需確認事件入站；新版影片封面已實測。

### 2026-10-05｜Cursor Cloud｜待付款請款 pending 照片 Hub 身分（已部署）

- 修改範圍：`payment_request.html`（帶圖失敗改警告）；Backend_GAS `accounting_pending_photos` 接受 Hub `user_id`
- 完成內容：根因＝主控台身分帶圖 API 不認員工編號；後端修通＋前端失敗不開致命回報
- 驗證：正式站 HTML 已含新提示字串；真人快審→請款待抽測
- Commit／線上：Backend_GAS#74 `d3b3038` → Actions → **@359**；liff-checkin#96 `db77e46` → Pages
- 待處理：楊婕妤主控台→快審→請款抽測自動帶圖（pending 票 45 分內）

### 2026-10-05｜Cursor Cloud｜歷史記帳獨立頁＋點列詳情（已部署）

- 修改範圍：新增 `ledger_history.html`；選單改連；`accounting_ingest.html` 移除歷史區；`payment_request.html` 已送出卡加歷史按鈕；api／shell／ui；SPEC 15；Backend `accounting_ledger_detail`
- 完成內容：獨立查詢頁（無登錄表單）；點列案號／圖片集；請款已送出→歷史；權限 ≥3
- 驗證：serve 抽測；後端 smoke；正式站 HTML／Pages
- Commit／線上：Backend_GAS#73 `ab6f3b7` → Actions → **@356**；liff-checkin#95 `1c98d8d` → Pages
- 待處理：真人 ≥3 抽測獨立頁點列詳情／請款成功卡按鈕

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
