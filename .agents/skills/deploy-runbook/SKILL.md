---
name: deploy-runbook
description: >-
  跨倉庫部署前閘門：SPEC 更新 → LOG 撰寫 → 必要備份 → 部署 → 回報討論串重點；遇問題回報並暫停請示使用者。
  Use when user says 部署、上線、發布、Deploy、upload、push main、clasp deploy,
  or @ deploy-runbook for any CODING/backend/accounting-gas/core_library/添心生產力助手 release.
---

# 部署 Runbook（全專案通用）

> **不論哪個倉庫要部署**，皆依本 skill 執行。僅在使用者**明確**說「部署／上線／發布／Deploy」時才進入 Step 4；其餘情況只做前三步或完全不跑部署指令。

## 部署前閘門（六步，不可跳步）

```
- [ ] Step 0  部署狀態檢查（已部署則跳過 Step 4）
- [ ] Step 1  SPEC 更新
- [ ] Step 2  LOG 撰寫
- [ ] Step 3  必要部份的備份
- [ ] Step 4  部署（使用者明確要求時；Step 0 判定已上線則跳過）
- [ ] Step 5  回報討論串重點（最終動作，必做）
```

**有任何問題要回報，並暫停部署、請示使用者。** 不得在未通過閘門或使用者未回覆前執行 `upload.bat`、`deploy.bat`、`clasp deploy`、`git push`。

---

## Step 0 — 部署狀態檢查（避免重複部署）

**進入 Step 1 之前先做**；若判定**已部署且無新程式變更**，完成 Step 0 後**直接跳過 Step 4**，仍須 **Step 5** 回報（仍可補 LOG 說明「查過，不重複部署」）。

### 要查什麼

| 來源 | 用途 |
|------|------|
| 當日／近期 **LOG** | 上次部署：commit、`@N`、備份路徑、`upload.bat` 時間 |
| `git log -1 --format="%ci %H %s"` | 目前 HEAD 與時間 |
| `git status -sb` | 是否與 `origin/main` 同步；工作區是否還有未 commit 程式 |
| `git diff <上次部署commit>..HEAD --stat` | 上次部署後是否還有新程式進 HEAD |
| 變更檔 **LastWriteTime**（選用） | 工作區未 commit 時，比對 LOG 部署時間 |

### 判定（滿足則不重複部署）

1. LOG 已記錄本次變更的部署（commit 與 HEAD **一致**或 HEAD 為其祖先且無額外程式 diff）。
2. `git status -sb` 為 `main...origin/main`（**無 ahead**）；落後則先 `git pull` 再重查。
3. 工作區**無**未 commit 的程式／SPEC（僅 `LOG/` 微調可忽略，或併入下一輪）。
4. 另一對話／使用者已跑過 `upload.bat`／Actions／`deploy.bat` 且上述一致 → **勿再跑 Step 4**。

### 仍需部署

- HEAD 比 LOG 最後部署 commit **新**，或有未 commit 程式／SPEC。
- LOG 寫「待部署」且 commit 尚未 push。
- 僅 GAS：LOG 有 push 但無 `@N`／Actions 未綠燈 → 查 Actions 或 `clasp deployments`，**只補缺的那一步**，不全套重跑（除非使用者要求）。

### 回報格式（跳過部署時）

```markdown
## 部署狀態 — 無需重複部署

**目標**：（倉庫／模組）
**LOG 最後部署**：commit、時間、版號
**目前 HEAD**：commit、時間
**結論**：程式已上線；Step 4 跳過
```

---

## Step 1 — SPEC 更新

1. 確認本次變更影響哪個倉庫／模組（見 [targets.md](targets.md)）。
2. 對照 `git diff`（或工作區變更）與對應 SPEC：
   - **CODING**：`SPEC/`、`SPEC/專案全域資料字典.md`（欄位／action 有動必更）
   - **backend**：模組 `SPEC/`、`backend/SPEC/GOOGLE_ACCOUNTS.md`；跨前後端同步 CODING 字典
   - **accounting-gas**：`backend/accounting-gas/SPEC/`（含 `SHEET_COLUMN_MAP.md`）
3. 程式與 SPEC 不一致 → **先更新 SPEC**（或標註為刻意延後並在 LOG 說明）。
4. **暫停請示**（未完成前不進 Step 2）若：
   - 不確定該改哪份 SPEC
   - 變更觸及 `@STABLE`、刪欄位、改 API 契約且前端未同步
   - SPEC 與程式衝突無法自行裁定

---

## Step 2 — LOG 撰寫

在**該倉庫**當日 LOG 追加一筆（無檔則新建 `LOG/YYYY-MM-DD_LOG.md`）：

| 倉庫 | LOG 路徑 |
|------|----------|
| CODING 前端 | `CODING/LOG/` |
| backend 跨模組摘要 | `backend/LOG/` |
| 單一 GAS 模組 | `backend/<模組>/LOG/`（如 `project-console/LOG/`） |
| accounting-gas | `backend/accounting-gas/LOG/` |

**每筆至少含**：日期標題、**Diff／目的**、**技術**（檔名／action／版號）、**驗證**（待測或已測）。部署相關另記：備份路徑、git commit、GAS `@N` 或 Actions run。

小修可併成一段；**跨檔、改 API、要上線者不可略過**。

寫入失敗或不知寫哪個 LOG → **回報並暫停**。

---

## Step 3 — 必要部份的備份

依目標選擇（細節見 [targets.md](targets.md)）：

| 方式 | 何時用 |
|------|--------|
| `upload.bat` 內建 robocopy | CODING／backend 日常上線（Step 4 會一併執行，但 Step 3 須先**確認**將用此腳本且路徑正確） |
| `<模組>/deploy.bat` 開頭 BAK | 本機 clasp 緊急部署 |
| 試算表／設定手動匯出 | LOG 註明的一次性維護、大量資料異動（依模組 SPEC） |

Step 3 完成標準：

- 已知備份將寫入 `../BAK/<名稱>_YYYYMMDD-HHmm_<電腦名>/`（或模組子目錄備份規則）
- 若將執行 `upload.bat`／`deploy.bat`，**先向使用者摘要**：倉庫、備份資料夾命名、是否有未 commit 變更

**robocopy errorlevel ≥ 8、磁碟空間不足、BAK 路徑不存在且無法建立** → 回報並暫停（除非使用者明確同意略過備份）。

---

## Step 4 — 部署

僅在 **Step 0 判定需要部署**，且 Step 1–3 勾選完成、使用者已要求部署時執行。

| 目標 | 指令（倉庫根或模組目錄） | 部署後驗證 |
|------|--------------------------|------------|
| CODING 前端 | `CODING/upload.bat` | GitHub `main`；必要時開正式站抽測 |
| backend（project-console／CheckinSystem 等） | `backend/upload.bat` | [Backend_GAS Actions](https://github.com/nephi4377/Backend_GAS/actions) 綠燈 |
| accounting-gas | `backend/accounting-gas/deploy.bat` | clasp `@N`；Web App 抽測 |
| core_library | `backend/core_library/deploy.bat` | push 成功；提醒引用專案需再部署 |
| 本機緊急 GAS | `<模組>/deploy.bat` | `clasp deployments` 或前端／LINE 實測 |

自動化：`set NONINTERACTIVE=1` 再跑 bat（略過結尾 pause）。

**失敗即停**：`git push`、`clasp push`、`clasp deploy`、Actions 紅燈 → 回報完整錯誤、**勿**重試 deploy 除非使用者指示。

部署成功後：在 LOG 補版號／Actions run，再進 **Step 5**。

---

## Step 5 — 回報討論串重點（最終動作）

**不論** Step 4 有無執行、是否暫停、是否跳過重複部署，runbook 結束前**最後一則回覆**須給使用者一段**極短摘要**（3～6 行、人話、不貼 log／JSON）。

### 必含（有則寫，無則略）

| 項目 | 範例 |
|------|------|
| **結果** | 已上線／無需重複部署／暫停待確認 |
| **目標** | CODING、CheckinSystem、兩邊皆有 |
| **改了什麼** | 一句話目的（對齊本次對話主題） |
| **線上狀態** | commit 短 hash、`@N`、Actions 綠燈／待驗 |
| **你要做什麼** | 抽測哪一頁、或「不用動」 |

### 格式範例

```markdown
**部署摘要**
- 結果：CODING + backend 已 push
- 變更：申訴納入主控台紅點、員工端改「待審核」文案
- 線上：CODING `abc1234`；CheckinSystem Actions 綠燈
- 請你：開主控台確認紅點；假勤審核 → 出勤申訴有那筆待審
```

```markdown
**部署摘要**
- 結果：無需重複部署（LOG 與 HEAD 一致）
- 線上：維持 6/30 版
- 請你：不用動
```

**禁止**：把 Step 1–4 全文複誦、貼整段 `git diff`、未收斂就結束 runbook。  
**暫停時**亦用本格式，結尾改 **「待你確認：A／B」**。

---

## 暫停請示（強制）

遇到以下任一項，**立刻暫停部署**（Step 5 簡短說明原因與選項），等使用者回覆後再從對應 Step 繼續：

- Step 0 顯示已部署，但使用者堅持重跑（請確認是否真要重複部署）

- 不確定部署哪個倉庫或模組
- SPEC／字典／前端 `config.js` 三方不一致
- 工作區含疑似金鑰、`.env` 將被 commit
- `git status` 有非預期檔案將被 `git add .`
- 備份失敗或使用者未確認略過
- 網路／權限／clasp 登入／Actions Secret 問題
- 改 `appsscript.json` 或新增定時函式（提醒部署後查 GAS「觸發器」）

回報格式建議：

```markdown
## 部署暫停 — 請確認

**目標**：（倉庫／模組）
**已完成**：Step 1–3 狀態
**問題**：（錯誤訊息或決策點）
**建議選項**：A … / B … / 略過備份繼續 …
```

---

## 關聯 skill

| Skill | 何時一起載入 |
|-------|----------------|
| `GAS-Backend-Expert` | 部署 backend GAS；clasp／Actions 細節 |
| `gas-sheets-batch-io` | 部署前改了大量試算表讀寫 |
| `conversation-handoff` | 部署到一半要換對話 |
| `plain-language-explain` | 向非技術使用者說明暫停原因 |

專案對照表 → **[targets.md](targets.md)**
