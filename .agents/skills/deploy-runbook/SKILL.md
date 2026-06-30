---
name: deploy-runbook
description: >-
  跨倉庫部署前閘門：SPEC 更新 → LOG 撰寫 → 必要備份 → 部署；遇問題回報並暫停請示使用者。
  Use when user says 部署、上線、發布、Deploy、upload、push main、clasp deploy,
  or @ deploy-runbook for any CODING/backend/accounting-gas/core_library/添心生產力助手 release.
---

# 部署 Runbook（全專案通用）

> **不論哪個倉庫要部署**，皆依本 skill 執行。僅在使用者**明確**說「部署／上線／發布／Deploy」時才進入 Step 4；其餘情況只做前三步或完全不跑部署指令。

## 部署前閘門（四步，不可跳步）

```
- [ ] Step 1  SPEC 更新
- [ ] Step 2  LOG 撰寫
- [ ] Step 3  必要部份的備份
- [ ] Step 4  部署
```

**有任何問題要回報，並暫停部署、請示使用者。** 不得在未通過閘門或使用者未回覆前執行 `upload.bat`、`deploy.bat`、`clasp deploy`、`git push`。

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

僅在 Step 1–3 勾選完成且使用者已要求部署時執行。

| 目標 | 指令（倉庫根或模組目錄） | 部署後驗證 |
|------|--------------------------|------------|
| CODING 前端 | `CODING/upload.bat` | GitHub `main`；必要時開正式站抽測 |
| backend（project-console／CheckinSystem 等） | `backend/upload.bat` | [Backend_GAS Actions](https://github.com/nephi4377/Backend_GAS/actions) 綠燈 |
| accounting-gas | `backend/accounting-gas/deploy.bat` | clasp `@N`；Web App 抽測 |
| core_library | `backend/core_library/deploy.bat` | push 成功；提醒引用專案需再部署 |
| 本機緊急 GAS | `<模組>/deploy.bat` | `clasp deployments` 或前端／LINE 實測 |

自動化：`set NONINTERACTIVE=1` 再跑 bat（略過結尾 pause）。

**失敗即停**：`git push`、`clasp push`、`clasp deploy`、Actions 紅燈 → 回報完整錯誤、**勿**重試 deploy 除非使用者指示。

部署成功後：在 LOG 補版號／Actions run；簡短回報使用者（備份路徑、commit、線上狀態）。

---

## 暫停請示（強制）

遇到以下任一項，**立刻回報並暫停部署**，等使用者回覆後再從對應 Step 繼續：

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
