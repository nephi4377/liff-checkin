/**
 * 併入 CustomerFinanceModule.js 的試算表欄寬修正片段。
 * 解決：setValues 資料 5 欄、範圍 24 欄（ensure 表頭／寫列未 pad）。
 */

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
