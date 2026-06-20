---
name: gas-sheets-batch-io
description: >-
  審查 GAS 試算表讀寫效能：找出迴圈內 getValue/setValue、改為批次 getValues/setValues。
  用於使用者要求檢查 Sheets 效能、GAS 變慢、記帳/回填逾時，或改 accounting-gas／CheckinSystem／project-console 試算表邏輯前。
disable-model-invocation: true
---

# GAS 試算表批次讀寫審查

## 核心原則（必記）

GAS + Google Sheets **90% 變慢**來自：**在 for/forEach 迴圈裡反覆呼叫 `getValue()` / `setValue()` / `appendRow()`**。

每次呼叫 = 一次與 Google 伺服器的往返。正確做法是：

1. **讀**：`getDataRange().getValues()` 或 `getRange(起始列, 1, 列數, 欄數).getValues()` → 在 JS 記憶體處理
2. **寫**：組好二維陣列 → **一次** `setValues()`
3. **同一流程只讀表一次**：掃描、找列、去重共用同一份 block，勿重複 `getDataRange()`

公式欄需另讀 `getFormulas()`，同樣批次取回。

## 何時載入本 skill

- 使用者說「GAS 很慢／逾時／檢查讀寫／批次優化」
- 改 `SheetWriter`、`MarginModule`、`SheetCrud` 或任何大量試算表邏輯
- 新增掃描歷史資料、回填、報表彙總功能

## 審查流程

### 1. 搜尋熱點（在目標 GAS 專案目錄）

```bash
# 逐格讀寫（嫌疑）
rg "\.getValue\(|\.setValue\(" --glob "*.js"

# 批次讀寫（良好）
rg "\.getValues\(|\.setValues\(" --glob "*.js"

# 迴圈內 API（高風險，需人工看上下文）
rg "for\s*\(|\.forEach\(" --glob "*.js" -A2
```

### 2. 分級

| 等級 | 特徵 | 建議 |
|------|------|------|
| 🔴 高 | 迴圈內 `getValue`/`setValue`；每列 `appendRow` 寫多欄 | 優先改批次 |
| 🟡 中 | 單次操作但連續 3+ 次 `setValue` 寫同一列 | 合併成 `setValues([row])` |
| 🟡 中 | 同函式多次 `getDataRange()` / `loadLedgerScanBlock_` | 合併成一次讀取傳入 |
| 🟢 低 | 單筆 CRUD 一列 `appendRow` 或一列 `setValues` | 可接受 |
| ⚪ 另計 | Drive OCR、LINE、Gemini、上傳照片 | 非 Sheets API，另估 |

### 3. 修正模式

**寫入整列（欄位不連續也適用）**

```javascript
function buildRowArray_(colMap, width, patches) {
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  Object.keys(patches).forEach(function (col) {
    row[parseInt(col, 10) - 1] = patches[col];
  });
  return row;
}
// 一次寫入：getRange(row, 1, 1, rowArray.length).setValues([rowArray])
```

**掃描資料區**

```javascript
var numRows = lastRow - DATA_START + 1;
var block = sheet.getRange(DATA_START, 1, numRows, width).getValues();
// 在 block 上找 footer、空白列、案號…
```

**`getRange` 四參數（GAS）**

```javascript
// ✅ 列數、欄數：getRange(起始列, 起始欄, numRows, numColumns)
sheet.getRange(4, 1, 100, 12).getValues();  // 從第 4 列起共 100 列

// ❌ 勿把第三參數當「結束列」
sheet.getRange(start, 1, start + n - 1, cols).setValues(data);  // 常導致列數不符
```

### 4. 修復優先順序（會計／大量寫入通用）

1. **日常寫入路徑**（如 `writeAccountingCells_`）→ 一次 `setValues`
2. **寫入前的找列**（`nextDataRow_`、`findFooterRow_`）→ 批次讀 block
3. **連動彙總**（如 `recalcMarginOverviewForTab_`）→ 多欄一次 `setValues`
4. **一次性回填／維護** → 可暫緩；若 GAS 6 分鐘逾時再考慮分月參數

### 5. 部署後驗證

-  bump `config_.js` 的 `getXxxGasVersion()`
- `clasp push` + deploy Web App（使用者明確要求部署時）
- 確認 `?action=health` 或 `doGet` 回傳 version
- 量測：記一筆／dry_run 回填是否在合理時間內（勿只靠感覺）

## 輸出格式（審查報告）

```markdown
## 一句結論
（是否發現 🔴 熱點、估計影響）

## 發現
| 檔案 | 函式 | 等級 | 問題 | 建議 |
|------|------|------|------|------|

## 已符合批次模式
- …

## 建議修改順序
1. …
```

## 本 repo 已知對照

詳見同目錄 [reference.md](reference.md)（accounting-gas 熱路徑、已優化函式）。

## 與其他 skill 的關係

- 改 GAS 邏輯、部署規範 → 先載入 `GAS-Backend-Expert`
- 本 skill **只做讀寫效能審查**，不取代業務 SPEC

## 禁止

- 未讀檔就斷言「已批次化」
- 為微優化把可讀的單筆 CRUD 過度抽象
- 擅自 deploy（除非使用者要求）
