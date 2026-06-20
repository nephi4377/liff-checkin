# accounting-gas 試算表熱路徑對照

> 路徑：`backend/accounting-gas/`（相對 CODING 為 `../backend/accounting-gas/`）

## 架構

```
靜態頁 accounting_api.js
  → POST JSON → WebApp.js (action 分派)
    → SheetWriter.js      （115年X月 收支）
    → core/SheetCrud.js   （主檔 CRUD）
    → master/MarginModule.js （案件毛利）
    → core/AuthBridge.js  （員工權限，整表讀一次 + Cache）
```

## 已批次化（v17 起）

| 檔案 | 函式 | 做法 |
|------|------|------|
| `SheetWriter.js` | `writeAccountingCells_` | `buildAccountingRowValues_` + 一次 `setValues` |
| `SheetWriter.js` | `loadLedgerScanBlock_` | 資料區一次 `getValues` + `getFormulas` |
| `SheetWriter.js` | `findFooterRow_` / `nextDataRow_` | 在 block 記憶體掃描；`appendLedgerRow_` 只讀一次 |
| `master/VendorPortal.js` | `scanVendorLedgerItems_` | 每月 `loadLedgerScanBlock_` 一次讀取 |
| `MarginModule.js` | `recalcMarginOverviewForTab_` | 總覽 6–9 欄一次 `setValues` |
| `MarginModule.js` | `ensureProjectMarginTab_` | 總覽 meta 欄 2–5 一次讀、一次寫 |
| `MarginModule.js` | `handleMarginUpdateLine_` | 整列一次讀、一次 `setValues` |
| `MarginModule.js` | `backfillMarginFromLedger_` | 每月分頁一次 `getValues`；`flushPendingMarginLines_` 每 tab 一次 `setValues` |
| `core/SheetCrud.js` | `crudList_` / `crudUpdate_` | 整表或整列批次 |

## 仍可能偏慢（審查時留意）

| 檔案 | 函式 | 說明 |
|------|------|------|
| `SheetWriter.js` | `refreshAnnualStatsFormulas_` | 12 個月各數次 `setFormula`（低頻） |
| `SheetWriter.js` | `appendPhotoToNote_` | 單格讀+寫（重複 ingest 時） |
| `MarginModule.js` | `appendRow` 單筆新增毛利列 | 單筆可接受 |
| `core/SheetCrud.js` | `findEntityRowIndex_` | 每次 get/update 再 `getDataRange()` |
| `AccountingLineIngest.js` | OCR / Drive 上傳 | 非 Sheets，附圖記帳體感慢的主因 |

## grep 快速錨點

```bash
rg "getValue|setValue" backend/accounting-gas --glob "*.js"
rg "getValues|setValues|loadLedgerScanBlock_" backend/accounting-gas --glob "*.js"
```

## 回填維護（`margin_backfill`）

- 歷史掃描屬**低頻維護**；日常記帳走 `appendLedgerRow_` → `LedgerPostIngest` → `appendMarginLineFromIngest_`
- 一次掃 8 個月可能觸及 GAS **~6 分鐘**上限；必要時分次呼叫（months=4、6）或日後加「只掃某月」參數
- 有 dedupe key，重跑不會重複匯入同一列

## 版本確認

`config_.js` → `getAccountingGasVersion()`；部署後 `doGet` Web App URL 應回傳相同 version。
