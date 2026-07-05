# CustomerFinance 試算表欄數不符修補（5 vs 24）

## 現象

- API：`margin_customer_finance_overview` / `_detail` / `_todos`、`margin_adjustment_create` 等
- 錯誤：`The number of columns in the data does not match the number of columns in the range. The data has 5 but the range has 24.`
- 前端「追加減與收款管理」開頁即失敗（測試模式 perm=5 亦同）

## 根因（已用線上 API 重現）

`CustomerFinanceModule.js` 在 **ensure 客戶財務分頁表頭** 或 **寫入列** 時，對 `setValues` 傳入的列陣列長度與 `getRange(..., numColumns)` 不一致。

常見兩種寫法錯誤：

1. **多張工作表共用「最大欄數」24**（`ContractAdjustments`），但 `ClientPortalAccess` 等分頁表頭只有 **5 欄**，卻寫入 24 欄寬範圍。
2. **升級表頭／寫資料列** 時，用舊列（5 欄）直接 `setValues` 到 24 欄範圍，未補空字串。

## 修補（併入 `master/CustomerFinanceModule.js`）

### 1. 共用 helper（若檔內尚無，加在模組頂部工具區）

```javascript
function padSheetRowToWidth_(row, width) {
  var out = [];
  var src = row || [];
  var w = Math.max(0, parseInt(width, 10) || 0);
  for (var i = 0; i < w; i++) {
    out.push(i < src.length ? src[i] : '');
  }
  return out;
}

function padSheetRowsToWidth_(rows, width) {
  return (rows || []).map(function (row) {
    return padSheetRowToWidth_(row, width);
  });
}
```

### 2. 表頭 ensure：範圍寬度 = **該表 headers.length**（勿用全域 MAX）

```javascript
function ensureCustomerFinanceSheetHeaders_(sheet, headers) {
  headers = headers || [];
  var width = headers.length;
  if (!width) return;

  var headerRow = padSheetRowToWidth_(headers, width);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, width).setValues([headerRow]);
    return;
  }

  var existingWidth = Math.max(sheet.getLastColumn(), width);
  var existing = sheet.getRange(1, 1, 1, existingWidth).getValues()[0];
  var needsUpdate = String(existing[0] || '') !== String(headerRow[0] || '');
  if (!needsUpdate && existingWidth >= width) return;

  sheet.getRange(1, 1, 1, width).setValues([headerRow]);
}
```

**搜尋並刪除** 類似下列錯誤寫法（第三參數用「結束欄」或固定 `CUSTOMER_FINANCE_MAX_COLS`）：

```javascript
// ❌ 錯誤範例
sheet.getRange(1, 1, 1, CUSTOMER_FINANCE_MAX_COLS).setValues([headers]); // headers 可能只有 5 欄
```

### 3. 追加減寫列：`buildContractAdjustmentRow_` 必須回傳 **完整 24 欄**

```javascript
function buildContractAdjustmentRow_(record, headers) {
  headers = headers || CONTRACT_ADJUSTMENT_HEADERS_;
  var row = padSheetRowToWidth_([], headers.length);
  var map = record || {};
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    if (map[key] !== undefined && map[key] !== null) row[i] = map[key];
  }
  return row;
}

function appendContractAdjustmentRow_(sheet, record) {
  var headers = CONTRACT_ADJUSTMENT_HEADERS_;
  var row = buildContractAdjustmentRow_(record, headers);
  var nextRow = Math.max(sheet.getLastRow(), 1) + 1;
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([row]);
}
```

`getRange` 四參數：**列數 = 1、欄數 = headers.length**（勿把第三參數當結束列）。

### 4. 若已有舊資料列需擴欄

```javascript
function rewriteSheetRowsPadded_(sheet, width) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1) return;
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var padded = padSheetRowsToWidth_(data, width);
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
}
```

僅在 migration 路徑呼叫；日常 ensure 表頭用 §2 即可。

## 驗收

```bash
# 線上（Python 範例）
curl -sL -X POST '<ACCOUNTING_GAS_URL>' -H 'Content-Type: text/plain' \
  -d '{"action":"margin_customer_finance_overview","dev_bypass":true,"dev_permission":5,"auth":{"dev_bypass":true,"dev_permission":5}}'
# 預期 success: true
```

- `designer-customer-finance.html?perm=5` 列表可載入
- 新增追加減草稿可成功

## 部署

1. 修改 `backend/accounting-gas/master/CustomerFinanceModule.js`
2. bump `config_.js` → `getAccountingGasVersion()`
3. `cd backend/accounting-gas && deploy.bat`（nephihuang）
4. 記錄於 `accounting-gas/LOG/` 與 `CODING/LOG/`
