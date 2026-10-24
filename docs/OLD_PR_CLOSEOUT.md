# 舊巡檢 Open PR 關閉建議（OLD-PR-CLOSEOUT-LIFF-1）

> **任務**：OLD-PR-CLOSEOUT-LIFF-1  
> **整合分支**：`cursor/old-pr-closeout-liff-1`（自 `main` @ 2026-10-22 起，以 **merge commit** 合入 7 支重寫 PR，**未** merge main、**未**關閉任何舊 PR）  
> **分類參考**：[PR #180](https://github.com/nephi4377/liff-checkin/pull/180) `SPEC/OLD_PR_TRIAGE_2026-10-22.md`（OLD-PR-TRIAGE-LIFF-1）  
> **刻意不處理**：#179 派工（Nephi 暫緩）、平面配置系列（已由 #204 整合，不重複）

## 本分支已合入的 merge commit（新 PR）

| 新 PR | 取代舊巡檢 PR | 主要依據（檔案／行為） |
|-------|----------------|------------------------|
| [#182](https://github.com/nephi4377/liff-checkin/pull/182) | **#68** | `modules/projects/js/logActions.js` `handleCreateNewPost`：僅 `result.success` 後清空草稿 |
| [#185](https://github.com/nephi4377/liff-checkin/pull/185) | **#61** | `modules/attendance/checkin.html` 離場 API 失敗不再 `completeOffSiteFlow()` |
| [#189](https://github.com/nephi4377/liff-checkin/pull/189) | **#62** | `customer-finance-portal.html` 收款列表讀失敗／再試 UI |
| [#193](https://github.com/nephi4377/liff-checkin/pull/193) | **#63** | `spa/app.js` + `spa/hubSchedule.js`：班表失敗傳 `scheduleError`、保留舊班表 |
| [#197](https://github.com/nephi4377/liff-checkin/pull/197) | **#64** | `shared/js/accounting_lightbox.js`：附件讀失敗顯示再試，非「沒有單據」 |
| [#199](https://github.com/nephi4377/liff-checkin/pull/199) | **#57** | `accounting_ingest.html` LINE 待傳照片失敗可見／再試 |
| [#201](https://github.com/nephi4377/liff-checkin/pull/201) | **#38** | `payment_request.html` LINE 待傳照片失敗可見／再試 |

### 另開 PR（未在本分支 merge commit 合入）

| 新 PR | 取代舊巡檢 PR | 主要依據（檔案／行為） |
|-------|----------------|------------------------|
| [#208](https://github.com/nephi4377/liff-checkin/pull/208) | **#56** | `taskSenderRecipients.js`／`taskSender.js`：全體發送展開 UID，不送 `ALL`（OLD-PR-CHERRYPICK-LIFF-7）；**#208 合入 main 後**才可關 #56 |

合併衝突：**1 處** — `SPEC/18_會計與主檔快取策略.md`（#199 與 #201 各加一行說明，已保留兩行）。

### Merge 後與單支 PR 的差異備註

| 項目 | 說明 |
|------|------|
| **#201 → 整合分支** | `payment_request.html` 相對 #201 分支 **僅** `accounting_lightbox.js?v=20` → **`v=22`**（其餘待付款 LINE 帶圖失敗行為與 #201 一致）。 |
| **#197 → 整合分支** | `shared/js/accounting_lightbox.js` 與 #197 分支 **無 diff**；與 #201 同批 merge 後，待付款頁因跟進 lightbox 而 bump 查詢參數，**不**表示 #197 範圍被改寫。 |

### 舊 PR vs 重寫 PR（`payment_request.html`／`checkin.html` 逐行 diff）

比對方式：各分支相對 `origin/main` 的 unified diff 中 `+`/`-` 行集合互比（2026-10-22）。

| 舊 PR | 重寫 PR | 檔案 | 合計異動行（聯集） | 對不到的行 |
|-------|---------|------|-------------------|------------|
| #38 | #201 | `payment_request.html` | **109** | **41**（僅舊／僅新各約半數；見下） |
| #61 | #185 | `checkin.html` | **60** | **30** |

**#38 ↔ #201 對不到的重點（功能意圖相近，實作與範圍不同）**

- **腳本與版本**：#201 基於較新 main，含 `accounting_boot.js`、`accounting_amount_formula.js` 與較高 `?v=`；#38 僅 bump 當時少數腳本。
- **待傳照片失敗 UX**：#38 用 `humanLineCarryErr`、`pendingPhotoError`／`ocrDraftError` 文案鍵；#201 用 `notifyPendingPhotoCarryError`／`showPendingPhotoCarryError`、`updateUploadUi`、`pendingPhotosLoadedOk`。
- **OCR 草稿再試**：#38 含 `fetchOcrDraftOnce`／`Retry` 與「再帶一次草稿」；#201 聚焦 LINE 待傳照片與快審帶圖，路徑較精簡。
- **版面**：#201 含雙欄照片格、燈箱縮圖、`pay-totals` 等當時 main 已有之待付款 UI；#38 diff 不含這些（舊分支較舊）。
- **文件與測試**：#38 含 LOG／SPEC／`TOS/巡檢回報.md`；#201 含 `tools/test-payment-request-pending-photos-fail.mjs`，**無** LOG。

**#61 ↔ #185 對不到的重點**

- **錯誤處理結構**：#185 抽出 `AppCore.applyOffSiteReasonSubmitError`；#61 以 `restoreOffSiteReasonReady` 等內联處理。
- **離場完成文案**：#185 用 `AppOffSite.buildReasonUpdateParams()` 組 `reasonNote`、`completeButtonText: '說明已暫存'`；#61 文案與 `completeOffSiteFlow` 參數形狀不同。
- **本機 mock**：#61 `AppActionLog` 細項較多；#185 對齊 `mock離場說明失敗模式` 與雙測試腳本（`test-checkin-offsite-reason-*.js`）。
- **文件**：#61 含 LOG／SPEC／TOS；#185 **無** LOG。

**#57、#62、#63、#64、#68**（舊 ↔ 新 merge PR 全檔 diff）：差異行 **多數** 為舊 PR 獨有的 LOG／SPEC／`TOS/巡檢回報.md` 與 `?v=` 腳本版本；**核心失敗可見／再試行為** 與整合分支一致，故仍列可關閉（見下表）。

## 巡檢 LOG 是否已搬入 repo（2026-10-22 查）

檢查範圍：本文件對照表所列舊 open PR（共 50 筆；其中 **46** 筆 PR 含 `LOG/*.md`）。  
判定：`main` 與本整合分支是否出現同名 `LOG/` 檔。

| 舊 PR | LOG 檔（檔名摘要） | 舊 PR 分支 | `main` | 整合分支 | 新 merge PR |
|-------|-------------------|------------|--------|----------|-------------|
| #38 | `…待付款請款LINE帶圖失敗不顯空.md` | 有 | **無** | **無** | **無**（#201） |
| #57 | `…收支登錄LINE帶圖.md` | 有 | **無** | **無** | **無**（#199） |
| #61 | `…打卡離場說明失敗可再試.md` | 有 | **無** | **無** | **無**（#185） |
| #62 | `…客人收款失敗可再試.md` | 有 | **無** | **無** | **無**（#189） |
| #63 | `…主控台班表失敗再接線.md` | 有 | **無** | **無** | **無**（#193） |
| #64 | `…單據讀失敗不裝成沒單據.md` | 有 | **無** | **無** | **無**（#197） |
| #68 | `…新建日誌失敗保留草稿.md` | 有 | **無** | **無** | **無**（#182） |
| #28 | `…日報總覽失敗不顯示成空.md` | 有 | **無** | **無** | —（本輪未合入） |
| #36 | `…客人收款失敗回歸.md` | 有 | **無** | **無** | — |
| #14–#55、#56–#70、#78、#82、#170 等其餘 37 筆含 LOG 的舊 PR | 各舊 PR 內 `LOG/2026-*_LOG_巡檢*.md` | 有 | **無** | **無** | — |

**結論**：巡檢 LOG **尚未**搬入 `main`；整合分支僅帶入部分 **SPEC** 與程式／測試，**未**帶入 `LOG/` 或 `TOS/巡檢回報.md` 更新。關閉舊 PR 前若需留存 LOG，請另開文件 PR 或手動 cherry-pick LOG 檔（非本任務範圍）。

## 本機測試（整合分支 HEAD）

| 套件 | 來源 | 結果 |
|------|------|------|
| LayoutPlanner Vitest | 同 [#188](https://github.com/nephi4377/liff-checkin/pull/188) CI 單元步驟 | **18** passed |
| LayoutPlanner Playwright e2e | 同 #188 CI e2e 步驟 | **11** passed |
| Merge commit 靜態／`node --test` | 7 支 PR 附帶測試 | **29** passed（4+4+3+10+4+3 檔內案例 + 3 支 `node` 腳本 OK） |
| 主控台 smoke | [#195](https://github.com/nephi4377/liff-checkin/pull/195) `test:console-e2e`（暫合 #195 分支跑完後已 revert，**未**留在本分支） | **5** passed |

**合計（可重現於本分支）**：LayoutPlanner **29** + merge commit 測試 **29** = **58** 則通過；console smoke **5** 則需 checkout `cursor/console-e2e-smoke-3ebd` 或等 #195 合 main 後再跑。

## 與 #180 分類不一致之處

| 項目 | #180 | 本文件 |
|------|------|--------|
| #63 | 「部分已改善」 | 整合分支已含 #193 全線；**舊 #63 仍建議關閉**，改跟 #193 |
| #61 | 仍列「需 rebase」 | 已有 #185；**舊 #61 功能等同、需人工確認後關閉**（非直接可關） |
| #38 | 需 rebase | 已有 #201；**功能等同、需人工確認**（非直接可關） |
| #57、#64、#62、#68 | 多數列「需 rebase」 | 已有對應 merge PR；**可關閉**（差異多為版本號／文件） |
| #28 | P0 待修 | 本輪 **未涵蓋**；`daily_report_main.js` 相對 main **無變更** → **不可關** |
| #36 | P1 客人收款 | **大致被 #189 與 #62 取代**；舊 PR 仍含獨立 LOG，關閉前請人工對 diff |
| #68 標籤 | #180 寫 **[巡檢P1]** | GitHub 舊 PR 標題亦為 P1；與 #34（發佈失敗草稿）不同議題 |

---

## 舊 PR 對照表（建議動作）

**建議動作**說明：

- **已由 #xxx 取代，可關閉**：對應 merge PR 合入 main 後可關舊 PR；舊／新 diff 以版本號與文件為主（本任務不執行關閉）。
- **功能等同、需人工確認**：行為意圖一致，但逐行 diff 仍有實作差異；Nephi 對過表內重點後再關。
- **不可關／下一輪 merge commit**：本整合分支未帶入修正。
- **main 已有同等修正，可關閉**：main 行為已滿足巡檢意圖（舊 PR 僅 rebase 成本高）。
- **仍需 merge commit（獨立 PR）**：main 仍可重現問題；建議優先序 P0 先。
- **需 Nephi 決定**：產品／後端／權限策略。

### 本輪 seven 之舊 PR

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#38](https://github.com/nephi4377/liff-checkin/pull/38) | **功能等同、需人工確認**（#201） | `payment_request.html` LINE 待傳失敗已驗；與 #201 **109 行中 41 行對不到**（見上表重點） |
| [#57](https://github.com/nephi4377/liff-checkin/pull/57) | 已由 **#199** 取代，**可關閉** | `accounting_ingest.html` 失敗路徑；與 #199 diff 以 `?v=`／LOG 為主 |
| [#61](https://github.com/nephi4377/liff-checkin/pull/61) | **功能等同、需人工確認**（#185） | 離場說明失敗不進完成流程；**60 行中 30 行對不到**（見上表重點） |
| [#62](https://github.com/nephi4377/liff-checkin/pull/62) | 已由 **#189** 取代，**可關閉** | 客人收款失敗再試；diff 多為版本號／LOG |
| [#63](https://github.com/nephi4377/liff-checkin/pull/63) | 已由 **#193** 取代，**可關閉** | Hub 班表 `scheduleError`；diff 多為版本號／LOG |
| [#64](https://github.com/nephi4377/liff-checkin/pull/64) | 已由 **#197** 取代，**可關閉** | lightbox 讀附件失敗；#197 與整合分支 lightbox 一致 |
| [#68](https://github.com/nephi4377/liff-checkin/pull/68) | 已由 **#182** 取代，**可關閉** | 新建日誌成功才清空草稿 |

### 8 月／9 月巡檢 #14、#28–#55（尚無本輪 merge）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#14](https://github.com/nephi4377/liff-checkin/pull/14) | 仍需 merge commit **P0** | 薪資審核／待匯列表讀失敗易顯示成空；對照 `payroll_review`／列表快取錯誤 UX（同 #52 族） |
| [#28](https://github.com/nephi4377/liff-checkin/pull/28) | **不可關**；下一輪 merge commit **P0** | 日報總覽讀失敗勿顯示成空；本分支 **未改** `modules/projects/js/daily_report_main.js`（相對 main 無 diff） |
| [#29](https://github.com/nephi4377/liff-checkin/pull/29) | 仍需 merge commit **P0** | 廠商待匯款列表失敗；`vendor_payment_finance` 類列表錯誤護欄 |
| [#30](https://github.com/nephi4377/liff-checkin/pull/30) | 仍需 merge commit **P0** | 未登記打卡失敗仍像完成；`checkin.html` 登記流程 |
| [#31](https://github.com/nephi4377/liff-checkin/pull/31) | 仍需 merge commit **P1** | LayoutPlanner 元件表讀失敗；`modules/InteriorDesigned` 載入狀態（**非** #204 平面整合範圍） |
| [#32](https://github.com/nephi4377/liff-checkin/pull/32) | 仍需 merge commit **P0** | 報價解析器案號檢查卡住；`tools/BudgetWeb` 解析 boot |
| [#34](https://github.com/nephi4377/liff-checkin/pull/34) | 仍需 merge commit **P1** | 工作區**發佈**失敗保留草稿；與 **#68／#182**（新建日誌）不同檔案路徑 |
| [#35](https://github.com/nephi4377/liff-checkin/pull/35) | 仍需 merge commit **P0** | 施工回報空包仍像成功；`daily_report` 送出驗證 |
| [#36](https://github.com/nephi4377/liff-checkin/pull/36) | **大致被 #189 與 #62 取代** | 客人收款讀失敗像空；舊 PR 範圍／LOG 仍獨立，關閉前請人工對 diff |
| [#37](https://github.com/nephi4377/liff-checkin/pull/37) | 仍需 merge commit **P0** | 主控台出席班表失敗像沒人休假；Hub `presence`／班表（#193 未涵蓋此子視圖） |
| [#39](https://github.com/nephi4377/liff-checkin/pull/39) | 仍需 merge commit **P1** | 出勤儀表板員工名單失敗；`attendance` 儀表板載入 |
| [#40](https://github.com/nephi4377/liff-checkin/pull/40) | 仍需 merge commit **P1** | OpenCV 校正引擎失敗可見；LayoutPlanner 校正（與 #31 可同批） |
| [#41](https://github.com/nephi4377/liff-checkin/pull/41) | 仍需 merge commit **P1** | 案場驗收表讀失敗；`BudgetAuditor` 類頁 |
| [#42](https://github.com/nephi4377/liff-checkin/pull/42) | 仍需 merge commit **P1** | 出勤申訴讀失敗；`leave`／申訴列表 |
| [#43](https://github.com/nephi4377/liff-checkin/pull/43) | 仍需 merge commit **P1** | FAQ 搜尋失敗；FAQ 模組 |
| [#44](https://github.com/nephi4377/liff-checkin/pull/44) | 仍需 merge commit **P0** | 團隊工作總覽失敗像假缺交；與 #28 同源 |
| [#45](https://github.com/nephi4377/liff-checkin/pull/45) | 仍需 merge commit **P1** | 薪資歷史補登名單失敗；`payroll` 表單 |
| [#46](https://github.com/nephi4377/liff-checkin/pull/46) | 仍需 merge commit **P1** | 假勤年度統計讀失敗；`leave_request` 統計區 |
| [#47](https://github.com/nephi4377/liff-checkin/pull/47) | 仍需 merge commit **P0** | SketchUp 開頁失敗；`sketchup` 批次流程 |
| [#48](https://github.com/nephi4377/liff-checkin/pull/48) | 仍需 merge commit **P0** | 日誌補照片失敗未還原；`logActions` 照片路徑 |
| [#49](https://github.com/nephi4377/liff-checkin/pull/49) | 仍需 merge commit **P0** | 客人確認收款失敗不可當已記下；客人端收款 |
| [#50](https://github.com/nephi4377/liff-checkin/pull/50) | 仍需 merge commit **P0** | 主控台通知失敗需還原；Hub 通知 API |
| [#51](https://github.com/nephi4377/liff-checkin/pull/51) | 仍需 merge commit **P0** | 單據存檔讀失敗；與 #64／#197 重疊部分已修 lightbox，**存檔列表**仍待 merge |
| [#52](https://github.com/nephi4377/liff-checkin/pull/52) | 仍需 merge commit **P0** | 已發薪明細讀失敗；`payroll` 明細列表 |
| [#53](https://github.com/nephi4377/liff-checkin/pull/53) | 仍需 merge commit **P0** | 工程排程讀失敗；排程模組 |
| [#54](https://github.com/nephi4377/liff-checkin/pull/54) | 仍需 merge commit **P0** | 日誌編輯文字失敗像已改好；`logActions` 編輯 |
| [#55](https://github.com/nephi4377/liff-checkin/pull/55) | 仍需 merge commit **P0** | 客人施工進度讀失敗；客人進度頁 |

### 9 月巡檢 #56–#70（#180 已查 main）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#56](https://github.com/nephi4377/liff-checkin/pull/56) | **已由 [#208](https://github.com/nephi4377/liff-checkin/pull/208) 取代；#208 合入 main 後才可關閉** | main 仍 `['ALL']`；#208 `resolveHubStaffRecipientIds` + `test-task-sender-resolve-recipients.mjs` **4/4**（2026-10-23） |
| [#58](https://github.com/nephi4377/liff-checkin/pull/58) | 仍需 merge commit **P0** | `approval_dashboard.html` 樂觀審核（#180） |
| [#59](https://github.com/nephi4377/liff-checkin/pull/59) | 仍需 merge commit **P1** | `BudgetAuditor_Standalone_V2.html` 進度未 `syncToFirebase` |
| [#60](https://github.com/nephi4377/liff-checkin/pull/60) | 仍需 merge commit **P0** | `BudgetWeb_Standalone.html` 同步讀失敗護欄 |
| [#65](https://github.com/nephi4377/liff-checkin/pull/65) | 仍需 merge commit **P1** | `vendor_register.html` boot 失敗 UX |
| [#66](https://github.com/nephi4377/liff-checkin/pull/66) | 仍需 merge commit **P1** | 病假文案／LINE FAQ 案號；#180：**部分已改善** |
| [#67](https://github.com/nephi4377/liff-checkin/pull/67) | 仍需 merge commit **P0** | `designer-material-selection.html` 逾時 catch 可能留幽靈紀錄 |
| [#69](https://github.com/nephi4377/liff-checkin/pull/69) | **需 Nephi 決定** | 客人輪追加減勿開收款；行為在 Backend_GAS（#180） |
| [#70](https://github.com/nephi4377/liff-checkin/pull/70) | 仍需 merge commit **P1** | `SchedulePlan.html` 排程錯誤；#180：矩陣／Hub 未完整 |

### 其他舊 open PR（#180 範圍）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#78](https://github.com/nephi4377/liff-checkin/pull/78) | 仍需 merge commit **P0** | `quick_review.html` 仍偏 `AccountingApi.initSession` 直連；#180 + Backend_GAS #64 |
| [#82](https://github.com/nephi4377/liff-checkin/pull/82) | 仍需 merge commit **P1** | Hub 案場編輯入口可發現性；`Dashboard.js`／`#/new-site` |
| [#92](https://github.com/nephi4377/liff-checkin/pull/92) | **需 Nephi 決定** | `TASKS.md` 與 **tanxin-dev-kb** 雙軌（#180） |
| [#98](https://github.com/nephi4377/liff-checkin/pull/98) | **需 Nephi 決定** | `ledger_history.html` `mine_only: false` vs 只看本人（#180） |
| [#170](https://github.com/nephi4377/liff-checkin/pull/170) | 仍需 merge commit **P2** | `customer-finance-portal.html` 選材縮圖／燈箱體驗 |
| [#72](https://github.com/nephi4377/liff-checkin/pull/72) | **需 Nephi 決定** | 總監人事筆記 Phase 1 + Backend_GAS #46 |
| [#73](https://github.com/nephi4377/liff-checkin/pull/73) | **需 Nephi 決定** | 對話重點板 MVP 是否仍要做 |

### 參考用（非關閉目標）

| PR | 說明 |
|----|------|
| [#180](https://github.com/nephi4377/liff-checkin/pull/180) | 分類報告原文；本表延伸並對齊 merge commit 現況 |
| [#179](https://github.com/nephi4377/liff-checkin/pull/179) | **暫緩**，不在關閉清單 |
| [#204](https://github.com/nephi4377/liff-checkin/pull/204) | 平面配置工具整合；舊平面相關 PR 不重複開工 |

---

## 建議 Nephi 批次關閉（在 #182–#201 依序合入 main **之後**）

1. **可直接排程關閉（5）**：**#57、#62、#63、#64、#68** — merge 行為已對齊；diff 差異多為 `?v=` 與未搬入之 LOG。  
2. **功能等同、請人工確認後再關（2）**：**#38**（#201）、**#61**（#185）— 見上文逐行 diff 重點。  
3. **勿關**：**#28**（本輪未合入；優先下一輪 merge commit）。  
4. **勿**在未決策前關閉：**#69、#72、#73、#92、#98**。  
5. 下一輪 merge commit 建議順序：**#28**（與 #44 可併）→ **#58** → **#60** → **#67** → **#78** → 其餘 P0 列表。（**#56**：[#208](https://github.com/nephi4377/liff-checkin/pull/208) **合入 main 後**才可關閉）

## 驗證方式（本輪）

- `git merge` 7 支 `cursor/*` merge commit 分支；`SPEC/18` 手動合併兩行說明。  
- LayoutPlanner：`npm ci && npm run test:unit && npx playwright install chromium && npm run test:e2e`（`modules/InteriorDesigned`）。  
- Merge commit 測試：見上文各 `tools/test-*.mjs`、`modules/*/tools/test-*.js`。  
- Console smoke：暫 merge `cursor/console-e2e-smoke-3ebd` → `npm run test:console-e2e` → revert（不納入本分支永久 diff）。

---

## 交接（本 commit）

| 項目 | 內容 |
|------|------|
| **做了什麼** | `#208↔#56` 自 merge commit 表移至「另開 PR」；#56 關閉條件改為 **#208 合入 main 後**。（沿用前次：#38／#61 功能等同、**需人工確認**；**#28 不可關**，需**另開 merge PR** 合入，非本分支範圍。） |
| **驗收** | 僅文件；與 `git`／`gh` 對照 #208 為獨立 draft PR；#28 仍不在本分支 merge commit 內。 |
| **風險** | 若 #208 未合 main 即關 #56，main 仍會送 `ALL`；#38／#61 未人工對 diff 即關舊 PR 可能漏差異。 |
| **需核准** | **是** — **#28 需另開 merge PR**；**#208 合入 main 後**再關 #56；#38／#61 仍待人工確認。 |
