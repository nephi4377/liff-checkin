# 中信薪資轉帳檔規格（薪轉）

**狀態**：已實作（`accounting-gas/master/CtbcSalaryTransferFile.js`）  
**關聯**：廠商整批匯款見 `CtbcBatchFile.js`（**500 byte／列**）；本檔為員工月薪 **薪轉**（**1000 byte／列**）

## 與廠商匯款差異

| 項目 | 廠商整批匯款 | 員工薪資轉帳 |
| --- | --- | --- |
| 模組 | `CtbcBatchFile.js` | `CtbcSalaryTransferFile.js` |
| 每列 byte 數 | 500 | **1000** |
| 中信上傳類型 | 整批匯款 | **薪資轉帳** |
| 編碼 | BIG-5（cp950） | BIG-5（cp950） |
| 前端頁面 | `vendor_payment_finance.html` | `payroll_finance.html` |
| 資料來源 | `vendor_payment_request` | `payroll_request` |

**禁止**用 `handleVendorPaymentExportCtbc_` 產生員工薪資檔。

## 檔案結構

- 第 1 列：表頭 `H` 列（固定語意，pad 至 1000 byte）
- 第 2 列起：資料列，每員工一列

行尾：`CRLF`（`\r\n`）

## 資料列（`2` 開頭）欄位

依歷史樣本 `CODING/modules/accounting/assets/11505.txt` 與實作：

| 區段 | 長度（byte） | 說明 |
| --- | --- | --- |
| 列別 | 1 | 固定 `2` |
| 帳號 | 16 | 右靠左補 0，僅數字 |
| 金額 | 14 | **分**為單位，右靠左補 0（元 × 100） |
| 銀行代碼 | 3 | 例 `822` |
| 保留／填充 | 至 byte 117 | 空白補滿 |
| 戶名 | 117～1000 | BIG-5 半形 1 byte、全形 2 byte 計算 |

戶名優先取 `account_name`，否則 `employee_name`。

## 表頭列

字串開頭 `H姓名`，接續 `應 發 項 目         代 扣 項 目`，整列 pad 至 1000 byte（與歷史檔一致）。

## API 與流程

1. 員工於出勤頁送出薪資核對 → Checkin `薪資核對申請` 狀態 `已送會計`
2. 會計 `payroll_request_sync` 或 list 時自動同步 → 主檔 `薪資請款申請`
3. 主管 `payroll_review.html` 核准（≥5）→ `review_status=已審`、`payment_status=未匯款`
4. 財務 `payroll_finance.html` 匯出（≥4）→ `payroll_request_export` 回傳 `content` + `filename`
5. 匯出同時寫入收支明細（`payment_method=薪轉`）、更新 Checkin 狀態

## 驗證

```bash
cd backend/accounting-gas
node tools/test-ctbc-salary.js
```

應全部 `OK`，且 `11505.txt` 每列 byte 寬度為 1000。

## 上傳中信注意事項

- 選擇功能：**薪資轉帳**（非整批匯款）
- 編碼：**BIG-5**
- 前端下載使用 `iconv-lite` cp950 編碼（與廠商待匯款頁相同模式）
