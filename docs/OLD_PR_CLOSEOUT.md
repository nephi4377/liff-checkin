# 舊巡檢 Open PR 關閉建議（OLD-PR-CLOSEOUT-LIFF-1）

> **任務**：OLD-PR-CLOSEOUT-LIFF-1  
> **整合分支**：`cursor/old-pr-closeout-liff-1`（自 `main` @ 2026-10-22 起，合入 7 支 cherry-pick PR，**未** merge main、**未**關閉任何舊 PR）  
> **分類參考**：[PR #180](https://github.com/nephi4377/liff-checkin/pull/180) `SPEC/OLD_PR_TRIAGE_2026-10-22.md`（OLD-PR-TRIAGE-LIFF-1）  
> **刻意不處理**：#179 派工（Nephi 暫緩）、平面配置系列（已由 #204 整合，不重複）

## 本分支已合入的 cherry-pick（新 PR）

| 新 PR | 取代舊巡檢 PR | 主要依據（檔案／行為） |
|-------|----------------|------------------------|
| [#182](https://github.com/nephi4377/liff-checkin/pull/182) | **#68** | `modules/projects/js/logActions.js` `handleCreateNewPost`：僅 `result.success` 後清空草稿 |
| [#185](https://github.com/nephi4377/liff-checkin/pull/185) | **#61** | `modules/attendance/checkin.html` 離場 API 失敗不再 `completeOffSiteFlow()` |
| [#189](https://github.com/nephi4377/liff-checkin/pull/189) | **#62** | `customer-finance-portal.html` 收款列表讀失敗／再試 UI |
| [#193](https://github.com/nephi4377/liff-checkin/pull/193) | **#63** | `spa/app.js` + `spa/hubSchedule.js`：班表失敗傳 `scheduleError`、保留舊班表 |
| [#197](https://github.com/nephi4377/liff-checkin/pull/197) | **#64** | `shared/js/accounting_lightbox.js`：附件讀失敗顯示再試，非「沒有單據」 |
| [#199](https://github.com/nephi4377/liff-checkin/pull/199) | **#57** | `accounting_ingest.html` LINE 待傳照片失敗可見／再試 |
| [#201](https://github.com/nephi4377/liff-checkin/pull/201) | **#38** | `payment_request.html` LINE 待傳照片失敗可見／再試 |

合併衝突：**1 處** — `SPEC/18_會計與主檔快取策略.md`（#199 與 #201 各加一行說明，已保留兩行）。

## 本機測試（整合分支 HEAD）

| 套件 | 來源 | 結果 |
|------|------|------|
| LayoutPlanner Vitest | 同 [#188](https://github.com/nephi4377/liff-checkin/pull/188) CI 單元步驟 | **18** passed |
| LayoutPlanner Playwright e2e | 同 #188 CI e2e 步驟 | **11** passed |
| Cherry-pick 靜態／`node --test` | 7 支 PR 附帶測試 | **29** passed（4+4+3+10+4+3 檔內案例 + 3 支 `node` 腳本 OK） |
| 主控台 smoke | [#195](https://github.com/nephi4377/liff-checkin/pull/195) `test:console-e2e`（暫合 #195 分支跑完後已 revert，**未**留在本分支） | **5** passed |

**合計（可重現於本分支）**：LayoutPlanner **29** + cherry-pick **29** = **58** 則通過；console smoke **5** 則需 checkout `cursor/console-e2e-smoke-3ebd` 或等 #195 合 main 後再跑。

## 與 #180 分類不一致之處

| 項目 | #180 | 本文件 |
|------|------|--------|
| #63 | 「部分已改善」 | 整合分支已含 #193 全線；**舊 #63 仍建議關閉**，改跟 #193 |
| #61 | 仍列「需 rebase」 | 已有 #185；**舊 #61 可關閉** |
| #57、#64、#62、#68、#38 | 多數列「需 rebase」 | 已有對應 cherry-pick；見下表「已由 #xxx 取代」 |
| #68 標籤 | #180 寫 **[巡檢P1]** | GitHub 舊 PR 標題亦為 P1；與 #34（發佈失敗草稿）不同議題 |

---

## 舊 PR 對照表（建議動作）

**建議動作**說明：

- **已由 #xxx 取代，可關閉**：請在對應 cherry-pick PR 合入 main 後關閉舊分支 PR（本任務不執行關閉）。
- **main 已有同等修正，可關閉**：main 行為已滿足巡檢意圖（舊 PR 僅 rebase 成本高）。
- **仍需 cherry-pick**：main 仍可重現問題；建議優先序 P0 先。
- **需 Nephi 決定**：產品／後端／權限策略。

### 已有 cherry-pick、舊 PR 可排程關閉（7）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#38](https://github.com/nephi4377/liff-checkin/pull/38) | 已由 **#201** 取代，可關閉 | `payment_request.html` 待傳照片失敗 UI；整合分支已驗 |
| [#57](https://github.com/nephi4377/liff-checkin/pull/57) | 已由 **#199** 取代，可關閉 | `accounting_ingest.html` `loadPendingPhotos` 失敗路徑 |
| [#61](https://github.com/nephi4377/liff-checkin/pull/61) | 已由 **#185** 取代，可關閉 | `checkin.html` 離場說明失敗不進完成流程 |
| [#62](https://github.com/nephi4377/liff-checkin/pull/62) | 已由 **#189** 取代，可關閉 | `customer-finance-portal.html` 收款區失敗文案 |
| [#63](https://github.com/nephi4377/liff-checkin/pull/63) | 已由 **#193** 取代，可關閉 | `spa/app.js` 班表錯誤接線（#180 部分已改善之殘項） |
| [#64](https://github.com/nephi4377/liff-checkin/pull/64) | 已由 **#197** 取代，可關閉 | `accounting_lightbox.js` 讀附件失敗 |
| [#68](https://github.com/nephi4377/liff-checkin/pull/68) | 已由 **#182** 取代，可關閉 | `logActions.js` 新建日誌成功才清空 |

### 8 月／9 月巡檢 #14、#28–#55（尚無 cherry-pick）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#14](https://github.com/nephi4377/liff-checkin/pull/14) | 仍需 cherry-pick **P0** | 薪資審核／待匯列表讀失敗易顯示成空；對照 `payroll_review`／列表快取錯誤 UX（同 #52 族） |
| [#28](https://github.com/nephi4377/liff-checkin/pull/28) | 仍需 cherry-pick **P0** | 團隊工作總覽讀失敗；與 #44 重疊，可一次修 `team` 總覽模組 |
| [#29](https://github.com/nephi4377/liff-checkin/pull/29) | 仍需 cherry-pick **P0** | 廠商待匯款列表失敗；`vendor_payment_finance` 類列表錯誤護欄 |
| [#30](https://github.com/nephi4377/liff-checkin/pull/30) | 仍需 cherry-pick **P0** | 未登記打卡失敗仍像完成；`checkin.html` 登記流程 |
| [#31](https://github.com/nephi4377/liff-checkin/pull/31) | 仍需 cherry-pick **P1** | LayoutPlanner 元件表讀失敗；`modules/InteriorDesigned` 載入狀態（**非** #204 平面整合範圍） |
| [#32](https://github.com/nephi4377/liff-checkin/pull/32) | 仍需 cherry-pick **P0** | 報價解析器案號檢查卡住；`tools/BudgetWeb` 解析 boot |
| [#34](https://github.com/nephi4377/liff-checkin/pull/34) | 仍需 cherry-pick **P1** | 工作區**發佈**失敗保留草稿；與 **#68／#182**（新建日誌）不同檔案路徑 |
| [#35](https://github.com/nephi4377/liff-checkin/pull/35) | 仍需 cherry-pick **P0** | 施工回報空包仍像成功；`daily_report` 送出驗證 |
| [#36](https://github.com/nephi4377/liff-checkin/pull/36) | 仍需 cherry-pick **P1** | 客人收款讀失敗像空；與 #62／#189 同域但舊 PR 範圍可能更廣 |
| [#37](https://github.com/nephi4377/liff-checkin/pull/37) | 仍需 cherry-pick **P0** | 主控台出席班表失敗像沒人休假；Hub `presence`／班表（#193 未涵蓋此子視圖） |
| [#39](https://github.com/nephi4377/liff-checkin/pull/39) | 仍需 cherry-pick **P1** | 出勤儀表板員工名單失敗；`attendance` 儀表板載入 |
| [#40](https://github.com/nephi4377/liff-checkin/pull/40) | 仍需 cherry-pick **P1** | OpenCV 校正引擎失敗可見；LayoutPlanner 校正（與 #31 可同批） |
| [#41](https://github.com/nephi4377/liff-checkin/pull/41) | 仍需 cherry-pick **P1** | 案場驗收表讀失敗；`BudgetAuditor` 類頁 |
| [#42](https://github.com/nephi4377/liff-checkin/pull/42) | 仍需 cherry-pick **P1** | 出勤申訴讀失敗；`leave`／申訴列表 |
| [#43](https://github.com/nephi4377/liff-checkin/pull/43) | 仍需 cherry-pick **P1** | FAQ 搜尋失敗；FAQ 模組 |
| [#44](https://github.com/nephi4377/liff-checkin/pull/44) | 仍需 cherry-pick **P0** | 團隊工作總覽失敗像假缺交；與 #28 同源 |
| [#45](https://github.com/nephi4377/liff-checkin/pull/45) | 仍需 cherry-pick **P1** | 薪資歷史補登名單失敗；`payroll` 表單 |
| [#46](https://github.com/nephi4377/liff-checkin/pull/46) | 仍需 cherry-pick **P1** | 假勤年度統計讀失敗；`leave_request` 統計區 |
| [#47](https://github.com/nephi4377/liff-checkin/pull/47) | 仍需 cherry-pick **P0** | SketchUp 開頁失敗；`sketchup` 批次流程 |
| [#48](https://github.com/nephi4377/liff-checkin/pull/48) | 仍需 cherry-pick **P0** | 日誌補照片失敗未還原；`logActions` 照片路徑 |
| [#49](https://github.com/nephi4377/liff-checkin/pull/49) | 仍需 cherry-pick **P0** | 客人確認收款失敗不可當已記下；客人端收款 |
| [#50](https://github.com/nephi4377/liff-checkin/pull/50) | 仍需 cherry-pick **P0** | 主控台通知失敗需還原；Hub 通知 API |
| [#51](https://github.com/nephi4377/liff-checkin/pull/51) | 仍需 cherry-pick **P0** | 單據存檔讀失敗；與 #64／#197 重疊部分已修 lightbox，**存檔列表**仍待 cherry-pick |
| [#52](https://github.com/nephi4377/liff-checkin/pull/52) | 仍需 cherry-pick **P0** | 已發薪明細讀失敗；`payroll` 明細列表 |
| [#53](https://github.com/nephi4377/liff-checkin/pull/53) | 仍需 cherry-pick **P0** | 工程排程讀失敗；排程模組 |
| [#54](https://github.com/nephi4377/liff-checkin/pull/54) | 仍需 cherry-pick **P0** | 日誌編輯文字失敗像已改好；`logActions` 編輯 |
| [#55](https://github.com/nephi4377/liff-checkin/pull/55) | 仍需 cherry-pick **P0** | 客人施工進度讀失敗；客人進度頁 |

### 9 月巡檢 #56–#70（#180 已查 main）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#56](https://github.com/nephi4377/liff-checkin/pull/56) | 仍需 cherry-pick **P0（最優先）** | `shared/js/taskSender.js` L331 仍 `recipients: ['ALL']`（#180 查證） |
| [#58](https://github.com/nephi4377/liff-checkin/pull/58) | 仍需 cherry-pick **P0** | `approval_dashboard.html` 樂觀審核（#180） |
| [#59](https://github.com/nephi4377/liff-checkin/pull/59) | 仍需 cherry-pick **P1** | `BudgetAuditor_Standalone_V2.html` 進度未 `syncToFirebase` |
| [#60](https://github.com/nephi4377/liff-checkin/pull/60) | 仍需 cherry-pick **P0** | `BudgetWeb_Standalone.html` 同步讀失敗護欄 |
| [#65](https://github.com/nephi4377/liff-checkin/pull/65) | 仍需 cherry-pick **P1** | `vendor_register.html` boot 失敗 UX |
| [#66](https://github.com/nephi4377/liff-checkin/pull/66) | 仍需 cherry-pick **P1** | 病假文案／LINE FAQ 案號；#180：**部分已改善** |
| [#67](https://github.com/nephi4377/liff-checkin/pull/67) | 仍需 cherry-pick **P0** | `designer-material-selection.html` 逾時 catch 可能留幽靈紀錄 |
| [#69](https://github.com/nephi4377/liff-checkin/pull/69) | **需 Nephi 決定** | 客人輪追加減勿開收款；行為在 Backend_GAS（#180） |
| [#70](https://github.com/nephi4377/liff-checkin/pull/70) | 仍需 cherry-pick **P1** | `SchedulePlan.html` 排程錯誤；#180：矩陣／Hub 未完整 |

### 其他舊 open PR（#180 範圍）

| 舊 PR | 建議動作 | 一句理由與依據 |
|-------|----------|----------------|
| [#78](https://github.com/nephi4377/liff-checkin/pull/78) | 仍需 cherry-pick **P0** | `quick_review.html` 仍偏 `AccountingApi.initSession` 直連；#180 + Backend_GAS #64 |
| [#82](https://github.com/nephi4377/liff-checkin/pull/82) | 仍需 cherry-pick **P1** | Hub 案場編輯入口可發現性；`Dashboard.js`／`#/new-site` |
| [#92](https://github.com/nephi4377/liff-checkin/pull/92) | **需 Nephi 決定** | `TASKS.md` 與 **tanxin-dev-kb** 雙軌（#180） |
| [#98](https://github.com/nephi4377/liff-checkin/pull/98) | **需 Nephi 決定** | `ledger_history.html` `mine_only: false` vs 只看本人（#180） |
| [#170](https://github.com/nephi4377/liff-checkin/pull/170) | 仍需 cherry-pick **P2** | `customer-finance-portal.html` 選材縮圖／燈箱體驗 |
| [#72](https://github.com/nephi4377/liff-checkin/pull/72) | **需 Nephi 決定** | 總監人事筆記 Phase 1 + Backend_GAS #46 |
| [#73](https://github.com/nephi4377/liff-checkin/pull/73) | **需 Nephi 決定** | 對話重點板 MVP 是否仍要做 |

### 參考用（非關閉目標）

| PR | 說明 |
|----|------|
| [#180](https://github.com/nephi4377/liff-checkin/pull/180) | 分類報告原文；本表延伸並對齊 cherry-pick 現況 |
| [#179](https://github.com/nephi4377/liff-checkin/pull/179) | **暫緩**，不在關閉清單 |
| [#204](https://github.com/nephi4377/liff-checkin/pull/204) | 平面配置工具整合；舊平面相關 PR 不重複開工 |

---

## 建議 Nephi 一次批次關閉（在 cherry-pick #182–#201 依序合入 main 之後）

1. **#38、#57、#61、#62、#63、#64、#68**（共 7 支）— 已由對應 cherry-pick 取代，勿再 rebase 舊分支。  
2. **勿**在未決策前關閉：**#69、#72、#73、#92、#98**。  
3. 下一輪 cherry-pick 建議順序：**#56** → **#58** → **#60** → **#67** → **#78** → 其餘 P0 列表。

## 驗證方式（本輪）

- `git merge` 7 支 `cursor/*` cherry-pick 分支；`SPEC/18` 手動合併兩行說明。  
- LayoutPlanner：`npm ci && npm run test:unit && npx playwright install chromium && npm run test:e2e`（`modules/InteriorDesigned`）。  
- Cherry-pick 測試：見上文各 `tools/test-*.mjs`、`modules/*/tools/test-*.js`。  
- Console smoke：暫 merge `cursor/console-e2e-smoke-3ebd` → `npm run test:console-e2e` → revert（不納入本分支永久 diff）。
