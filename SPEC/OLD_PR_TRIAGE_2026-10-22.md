# 舊 Open PR 分類報告（2026-10-22）

> **任務**：OLD-PR-TRIAGE-LIFF-1  
> **基準**：`origin/main` @ 2026-10-22（`46a4c8f` 一帶，含 LayoutPlanner 3D 等近期合併）  
> **範圍**：#56–#70、#72、#73、#78、#82、#92、#98、#170（**不含** #174–#179；**未**關閉任何 PR、**未**改動那些 PR 的分支）

## 分類說明

| 分類 | 意義 |
|------|------|
| **仍有價值需 rebase** | main 上問題仍可重現或僅部分修掉；建議 cherry-pick／rebase 後另開新 PR 合入 |
| **已被 main 取代可關閉** | 修復或等價行為已在 main；保留 open PR 易誤合 |
| **需 Nephi 決定** | 產品方向、後端配對、或與現行流程（如 tanxin-dev-kb）衝突 |

**Rebase 難度**（相對 main）：**高** ≈ 400+ commits 落後；**中** ≈ 200–400；**低** ≈ &lt;100。

## 總表

| PR | 標題（短） | 分類 | 一句理由 | Rebase |
|----|------------|------|----------|--------|
| [#56](https://github.com/nephi4377/liff-checkin/pull/56) | 任務交辦「全體」不可送 `ALL` | 仍有價值需 rebase | main `taskSender.js` 仍 `recipients: ['ALL']` | 高 |
| [#57](https://github.com/nephi4377/liff-checkin/pull/57) | 收支登錄 LINE 帶圖失敗 | 仍有價值需 rebase | `loadPendingPhotos` 失敗仍 `.catch(()=>{})` 靜默 | 高 |
| [#58](https://github.com/nephi4377/liff-checkin/pull/58) | 假勤核准失敗不裝已審 | 仍有價值需 rebase | `approval_dashboard.html` 仍 `no-cors` + 樂觀滑走卡片 | 高 |
| [#59](https://github.com/nephi4377/liff-checkin/pull/59) | 驗收表進度寫上雲 | 仍有價值需 rebase | `updateProgress` 只改 UI，**未** `syncToFirebase` | 高 |
| [#60](https://github.com/nephi4377/liff-checkin/pull/60) | 報價單同步讀失敗不覆蓋 | 仍有價值需 rebase | `BudgetWeb_Standalone.html` 無讀失敗護欄／mock | 高 |
| [#61](https://github.com/nephi4377/liff-checkin/pull/61) | 離場說明失敗不裝完成 | 仍有價值需 rebase | 失敗仍 `completeOffSiteFlow()` →「打卡完成」 | 高 |
| [#62](https://github.com/nephi4377/liff-checkin/pull/62) | 客人收款確認讀失敗 | 部分取代 | 選材區已有再試；**收款**列表失敗文案仍可能像「無待確認」 | 高 |
| [#63](https://github.com/nephi4377/liff-checkin/pull/63) | 主控台班表失敗接線 | 仍有價值需 rebase | UI 有 `scheduleError` 但 `spa/app.js` **未**傳入 Dashboard | 高 |
| [#64](https://github.com/nephi4377/liff-checkin/pull/64) | 看單據讀失敗不裝沒單據 | 仍有價值需 rebase | `ledger_review` 等仍「這筆沒有上傳單據」；lightbox 無「讀不到再試」 | 高 |
| [#65](https://github.com/nephi4377/liff-checkin/pull/65) | 廠商自填開頁失敗 | 仍有價值需 rebase | `vendor_register.html` 開頁失敗仍易停在「載入中…」 | 高 |
| [#66](https://github.com/nephi4377/liff-checkin/pull/66) | 病假文案／LINE FAQ | 仍有價值需 rebase | 成功仍多用後端 `result.message`；FAQ「#案號」修正未見於 main | 高 |
| [#67](https://github.com/nephi4377/liff-checkin/pull/67) | 選材上傳失敗作廢 | 部分取代 | API 失敗已 `materialVoid`；**逾時 throw** 的 catch 可能留幽靈紀錄 | 高 |
| [#68](https://github.com/nephi4377/liff-checkin/pull/68) | 工作區發佈日誌保留草稿 | 仍有價值需 rebase | `logActions.js` 發佈後**立即**清空表單／假卡片未移除 | 高 |
| [#69](https://github.com/nephi4377/liff-checkin/pull/69) | 客人輪：追加減勿開收款頁 | 需 Nephi 決定 | 前端多為 SPEC／巡檢回報；實作在 Backend_GAS 分支 | 高 |
| [#70](https://github.com/nephi4377/liff-checkin/pull/70) | 人員排程讀失敗可見 | 仍有價值需 rebase | `tools/SchedulePlan.html` 批次／月分頁錯誤處理仍薄；矩陣未掛 Hub | 高 |
| [#72](https://github.com/nephi4377/liff-checkin/pull/72) | 總監人事筆記 Phase 1 | 需 Nephi 決定 | main 無 `director_hr_notes`；需對 Backend_GAS #46 與權限策略 | 中 |
| [#73](https://github.com/nephi4377/liff-checkin/pull/73) | 對話重點板 MVP | 需 Nephi 決定 | main 無 `digest_board`；新功能＋ SPEC 25，是否仍要做 | 中 |
| [#78](https://github.com/nephi4377/liff-checkin/pull/78) | 單據存檔驗證逾時 | 仍有價值需 rebase | `quick_review.html` 仍 `AccountingApi.initSession` 直連 | 中 |
| [#82](https://github.com/nephi4377/liff-checkin/pull/82) | 案場編輯入口可發現 | 仍有價值需 rebase | Hub 卡片在很下方；工作區無「編輯案場」深連結 | 中 |
| [#92](https://github.com/nephi4377/liff-checkin/pull/92) | Agent 多任務交接 TASKS.md | 需 Nephi 決定 | 與現行 **tanxin-dev-kb**／`SHARED_DEV_LOG.md` 指標重疊 | 中 |
| [#98](https://github.com/nephi4377/liff-checkin/pull/98) | 歷史記帳只顯示本人 | 需 Nephi 決定 | main `ledger_history.html` 仍 `mine_only: false`（刻意？） | 低 |
| [#170](https://github.com/nephi4377/liff-checkin/pull/170) | 客戶選材大圖燈箱 | 仍有價值需 rebase | `customer-finance-portal.html` 仍 88×88 縮圖＋簡易 lightbox | 低 |

---

## 9 月巡檢 #56–#70（P0/P1）— main 查證摘要

### P0

| PR | main 現況（查證位置） | 結論 |
|----|----------------------|------|
| **#56** | `shared/js/taskSender.js` L331：`recipients: sendToAll ? ['ALL']` | **未修** |
| **#57** | `accounting_ingest.html` L756：`loadPendingPhotos(...).catch(function () {})`；L607 失敗僅 `setMsg` 無重試 | **未修** |
| **#58** | `approval_dashboard.html` L754–779：`no-cors` + `if (true)` 樂觀移除卡片 | **未修** |
| **#60** | `tools/BudgetWeb_Standalone.html` Firebase 同步路徑無 PR 的讀失敗阻斷 | **未修** |
| **#61** | `checkin.html` L1315–1326：離場 API 失敗仍呼叫 `completeOffSiteFlow()` | **未修** |
| **#62** | `customer-finance-portal.html` 選材有再試（L694+）；收款列表 L501 仍「目前無待確認收款」 | **部分** |
| **#63** | `Dashboard.js` 有班表錯誤 UI；`spa/app.js` L1198 未傳 `:scheduleError`，抓取失敗無 `.catch` 設錯 | **未完整** |
| **#64** | `ledger_review.html` L1730/1801；`ledger_history.html` L1065 等：空附件仍「沒有上傳單據」 | **未修** |
| **#67** | `designer-material-selection.html` L1396–1404 已作廢；L1413 `catch` 未保證作廢 | **部分** |

### P1

| PR | main 現況 | 結論 |
|----|-----------|------|
| **#59** | `BudgetAuditor_Standalone_V2.html` `updateProgress`（L2972+）無 debounced `syncToFirebase` | **未修** |
| **#65** | `vendor_register.html` 無 boot 重試／mock 路徑 | **未修** |
| **#66** | `leave_request.html` 有病假補件提醒（L1384+）；「已報備」成功文案／LINE FAQ 案號格式未對齊 PR | **部分** |
| **#68** | `modules/projects/js/logActions.js` L546–565：未等 API 成功即清空輸入 | **未修** |
| **#69** | 本 repo 以 SPEC／`TOS/巡檢回報.md` 為主；行為依 Backend_GAS | **待決** |
| **#70** | `shift_schedule.html` 已有班表再試；`SchedulePlan.html` 獨立工具錯誤 UX／Hub 入口仍 PR 待決議題 | **未完整** |

---

## 其他 PR 細節

### #72 總監人事筆記

- main：**無** `modules/attendance/director_hr_notes.html`、`#/director-hr-notes`。
- 依 PR 說明需 **Backend_GAS PR #46** `director_hr_notes`。
- **建議**：Nephi 確認是否仍要做 Phase 1、權限 ≥5 與資料存放後，再 rebase（**中**）。

### #73 對話重點板

- main：**無** `digest_board.html`／`#/digest-board`。
- **建議**：產品是否取代／並存既有交辦與 LINE 流程 — **Nephi**（**中**）。

### #78 單據與存檔逾時

- main：`quick_review.html` 已載入 `accounting_boot.js`，但啟動仍見 `AccountingApi.initSession`（約 L1203），非 PR 的 `AccountingBoot.run` 先出殼。
- 搭配 Backend_GAS #64。
- **建議**：rebase 合入（**中**）。

### #82 案場編輯可發現性

- main：`Dashboard.js` L733+ 仍有「新增／修改案場資料」，但排在多張工具卡之後；`modules/projects` **無** PR 的「編輯案場資料」`#/new-site?project=` 連結。
- **建議**：UX 小改，rebase 成本低（**中**）。

### #92 TASKS.md 交接

- main：無 `TASKS.md`；AGENTS／規則已指向 **tanxin-dev-kb**。
- **建議**：關閉或改寫進 kb，避免雙軌 — **Nephi**（**中**）。

### #98 歷史記帳 mine_only

- main：`ledger_history.html` L1474 `mine_only: false`；測試 `test-ledger-history-search-readonly.js` 斷言「always all users」。
- PR 改為永遠只看本人＋後端 #76。
- **建議**：是否允許主管看他人列 — **Nephi**（**低** rebase）。

### #170 客戶選材大圖

- main：`customer-finance-portal.html` L76–79 仍 **88×88** `object-fit: cover`；lightbox 為簡版（L672+）。
- PR 分支檔名為 `material-gallery-lightbox` 但 diff 亦為同檔。
- **建議**：體驗改進仍有效，rebase（**低**）。

---

## 建議後續（本報告不執行）

1. **P0 巡檢類（#56–#64、#61、#67、#68）**：優先 cherry-pick 行為修復到新分支，避免一次 rebase 整包 9 月 LOG/SPEC。
2. **需 Nephi（#69、#72、#73、#92、#98）**：開一次決策清單後再關閉或重開 PR。
3. **#179 派工清單**：依 Nephi 2026-10-22 21:27 **暫緩**，不在本表處理。

## 驗證方式（本輪已做）

- `git fetch origin main`；靜態搜尋 main 上關鍵字與檔案（見上文路徑）。
- `gh pr view`／分支落後 main 約 **29–452** commits（2026-10-22 量測）。
