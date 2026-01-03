// v2.1 - 2025-12-12 16:30 (Asia/Taipei)
// 檔案說明：GAS 通用 API 後端腳本 (Generic Backend API)
// 功能：提供通用的 CRUD 接口，讓前端可以讀寫任何 Sheet。
// 依賴：此腳本假設與 sheet_initializer.js 位於同一 GAS 專案中 (共用全域變數)。

// ==========================================
// 1. doPost 標準接口
// ==========================================
function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(10000); // 防止多重請求衝突

    var result = {};

    try {
        // 1. 解析參數
        var params = e.parameter || {};
        if (e.postData && e.postData.contents) {
            var postData = JSON.parse(e.postData.contents);
            for (var key in postData) {
                params[key] = postData[key];
            }
        }

        var action = params.action;       // 動作: create, update, delete
        var sheetName = params.sheetName; // 目標工作表: Map_Task_Tools, DB_Tools...

        // [Debug] 記錄請求資訊，方便除錯
        console.log("[API Request] Action:", action, "Sheet:", sheetName);

        // 2. 路由處理
        if (!sheetName) throw new Error("Missing parameter: sheetName");

        if (action === 'create') {
            result = handleCreate(sheetName, params.data);
        } else if (action === 'batch_create') {
            // 批次新增
            console.log("[Batch Create] Processing for:", sheetName);
            result = handleBatchCreate(sheetName, params.data);
        } else if (action === 'update') {
            result = handleUpdate(sheetName, params.keyField, params.keyValue, params.data);
        } else if (action === 'delete') {
            result = handleDelete(sheetName, params.keyField, params.keyValue);
        } else if (action === 'setup_db') {
            // 呼叫 sheet_initializer.js 中的初始化函式
            if (typeof setupDB === 'function') {
                setupDB();
                result = { status: 'success', message: 'Database initialized successfully' };
            } else {
                throw new Error("setupDB function not found. Please ensure sheet_initializer.gs is included.");
            }
        } else {
            console.error("[API Error] Unknown action:", action);
            throw new Error("Unknown or missing action: " + action);
        }

    } catch (err) {
        console.error("[API Exception]", err);
        result = { status: 'error', message: err.toString(), stack: err.stack };
    } finally {
        lock.releaseLock();
    }

    return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 2. 通用 CRUD 邏輯
// ==========================================

/**
 * 通用新增 (Create)
 * @param {string} sheetName - 工作表名稱
 * @param {object} dataObj - 要新增的資料物件 {colName: value, ...}
 */
function handleCreate(sheetName, dataObj) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    // 取得標題列 (第一列)
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 依照標題順序構建 row
    var newRow = headers.map(function (header) {
        var val = dataObj[header];
        return (val === undefined || val === null) ? "" : val;
    });

    sheet.appendRow(newRow);
    return { status: 'success', message: 'Row created', data: dataObj };
}

/**
 * 通用批次新增 (Batch Create)
 * @param {string} sheetName
 * @param {Array<object>} dataList - 資料物件陣列
 */
function handleBatchCreate(sheetName, dataList) {
    if (!Array.isArray(dataList) || dataList.length === 0) {
        return { status: 'success', message: 'No data to create' };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 構建二維陣列
    var rows = dataList.map(function (dataObj) {
        return headers.map(function (header) {
            var val = dataObj[header];
            return (val === undefined || val === null) ? "" : val;
        });
    });

    // 批次寫入 (取得下一列空白處)
    var lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);

    return { status: 'success', message: rows.length + ' rows created' };
}

/**
 * 通用更新 (Update)
 * @param {string} sheetName - 工作表名稱
 * @param {string} keyField - 識別欄位 (Primary Key)，例如 "tool_id"
 * @param {string} keyValue - 識別值
 * @param {object} dataObj - 要更新的欄位 {colName: newValue, ...}
 */
function handleUpdate(sheetName, keyField, keyValue, dataObj) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var keyIndex = headers.indexOf(keyField);

    if (keyIndex === -1) throw new Error("Key field not found: " + keyField);

    var rowIndex = -1;
    // 尋找目標列 (跳過標題，從第1列開始查)
    for (var i = 1; i < data.length; i++) {
        if (String(data[i][keyIndex]) === String(keyValue)) {
            rowIndex = i + 1; // 轉為 Sheet 的列號 (1-based)
            break;
        }
    }

    if (rowIndex === -1) throw new Error("Record not found with " + keyField + "=" + keyValue);

    // 執行更新
    for (var field in dataObj) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
            // 寫入儲存格 (rowIndex, colIndex + 1)
            sheet.getRange(rowIndex, colIndex + 1).setValue(dataObj[field]);
        }
    }

    return { status: 'success', message: 'Row updated' };
}

/**
 * 通用刪除 (Delete) - 支援刪除多筆符合條件的資料
 * @param {string} sheetName
 * @param {string} keyField
 * @param {string} keyValue
 */
function handleDelete(sheetName, keyField, keyValue) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var keyIndex = headers.indexOf(keyField);

    if (keyIndex === -1) throw new Error("Key field not found: " + keyField);

    var deletedCount = 0;
    // 從後面往前找，刪除所有符合條件的列
    for (var i = data.length - 1; i >= 1; i--) {
        if (String(data[i][keyIndex]) === String(keyValue)) {
            sheet.deleteRow(i + 1);
            deletedCount++;
        }
    }

    if (deletedCount === 0) {
        // 為了 API 一致性，若找不到也不報錯，只回傳刪除 0 筆
        return { status: 'success', message: 'No rows deleted (record not found)' };
    }

    return { status: 'success', message: deletedCount + ' row(s) deleted' };
}
