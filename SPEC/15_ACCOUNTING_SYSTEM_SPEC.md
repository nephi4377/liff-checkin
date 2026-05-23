# 會計系統模組規格書 (v1.1 - 本機保密版)

本規格書定義「添心會計系統」之核心模組、資料流向與本地持久化方案。為確保財務數據的**高保密性**與**毫秒級極速回應**，系統放棄雲端 Google Sheets 儲存方案，改為直接在「添心生產力助手 (Electron Client)」本機運行，並使用本地 SQLite/JSON 資料庫儲存。

## 1. 系統架構與保密設計

會計系統作為「添心生產力助手 (Electron Client)」的本機擴展模組。

### 1.1 運行平台與 Iframe 整合
- **運行平台**: 「添心生產力助手」Electron 桌面端。
- **UI 載入**: Electron Client 開闢專屬會計視窗，直接載入本地的 `modules/accounting/index.html`。
- **保密設計**:
  * **財務資料不落地雲端**：所有的會計收支明細、付款紀錄、發票 OCR 快取均存放在本機資料庫中，不傳送至 Google Sheets、Firebase 或任何第三方公有雲端資料庫。
  * **Dropbox 自動備份**：本地資料庫檔案儲存在使用者的 Dropbox 同步目錄下（例如 `d:\Dropbox\CodeBackups\CODING\data\accounting.db`），利用 Dropbox 本身的加密傳輸與多版本歷史紀錄進行自動備份，既安全又具防災能力。

### 1.2 專案數據關聯 (與現有專案唯讀對接)
為了與現有專案主控台對接，系統採用**「本機唯讀快取」**機制：
- **專案與員工資料讀取**：Electron 透過 GAS API 或 Sheets API 唯讀拉取「案場資料」與「員工資料」並在本地快取，供會計系統關聯 `案號` 與 `userName` 使用。
- **財務資料隔離**：會計系統內的每一筆帳務只在本機與「案號」關聯，**絕對不會**將任何金額或收支明細回傳寫入雲端 Google Sheets，確保公司財務數據 100% 隱密。

---

## 2. 核心功能規格

### 2.1 協助設定轉帳 (Transfer Setup Assistant)
1. **本機收款人帳戶管理**
   - 於本地資料庫建立 `Payees` 資料表，記錄下包商、材料商與工人的銀行代碼、帳號與戶名。
2. **網銀批次付款媒體檔匯出**
   - 會計在本機勾選多筆應付帳款，點擊「產生批次匯款檔」。
   - 由 Electron 本機 Node.js 直接生成符合國泰世華、台新、富邦等網銀格式的 `TXT`/`CSV` 媒體檔。由於是在本機處理，產生速度為**即時（<10ms）**且無檔案外洩風險。
3. **付款明細 LINE 自動通知**
   - Electron 本機調用 LINE Messaging API，直接將付款通知與明細發送給工務或廠商。
4. **本機付款 QR Code 生成**
   - 本地前端直接使用 `qrcode.js` 生成台灣 Pay 或轉帳資訊的 QR Code，供手機掃描。

### 2.2 發票與估價單辨識 (AI OCR Billing Assistant)
1. **本地圖片預處理**
   - 使用者拖放或選擇發票圖片後，由 Electron 本地端處理圖片壓縮，無需上傳至 Firebase Storage 儲存。
2. **本機直連 AI 辨識**
   - Electron 本地端使用 HTTPS **直接呼叫 Gemini 2.0 Flash / Pro API**，將圖片二進位資料傳入。
   - **優點**：不經過任何中介伺服器，API 金鑰加密儲存於本地配置文件，財務單據直接傳送給 AI 處理，不留任何雲端備份，最大化隱私保護。
3. **辨識欄位**
   - 發票號碼、統一編號（買受人/銷方）、開立日期、發票金額、品項明細、估價單明細等，並自動回填至本地會計表單中。

### 2.3 資料庫直接編輯與查看 (Database Portal)
提供一個類似 Web spreadsheet 的本機資料庫管理入口，可供直接編輯本機會計庫與遠端專案庫。

1. **極速 Web-based Data Grid**
   - 採用 Tabulator 渲染，因資料庫位於本機 SQLite/JSON，查詢與寫入速度在毫秒級完成，**徹底解決 GAS 讀寫 Google Sheets 造成的 1~3 秒延遲與超時問題**。
2. **本地變更稽核與鎖定**
   - **唯讀/可寫入隔離**：本地資料表（會計帳）完全開放修改；遠端 Sheet 資料表（專案、員工）僅供高權限者編輯，且透過 API 寫回 Sheets。
   - **寫入稽核 (Write-Ahead Audit Trail)**：每一次編輯，皆在本地產生 `AuditLog` 記錄，並可選擇同步備份至本地日誌檔案。

---

## 3. 資料持久化方案 (本機私有)

本地資料庫採用 SQLite (使用 `better-sqlite3` 庫) 或結構化加密 JSON 檔，儲存路徑為：
- `d:\Dropbox\CodeBackups\CODING\data\accounting.db`

### 3.1 本地資料表結構

#### **會計收支明細表 (ledger)**
| 欄位名 | 型態 | 說明 |
| :--- | :--- | :--- |
| **id** | TEXT (PK) | 唯一編號 (UUID) |
| **created_at** | DATETIME | 建立時間 |
| **project_no** | TEXT | 關聯案號 (可為空，代表公司全域支出) |
| **type** | TEXT | 類別 (IN / OUT) |
| **category** | TEXT | 科目 (材料費/工資/租金/文具等) |
| **title** | TEXT | 項目名稱 |
| **amount** | INTEGER | 金額 (未稅) |
| **tax** | INTEGER | 稅額 |
| **status** | TEXT | 付款狀態 (已付/未付/核銷中) |
| **payee_id** | TEXT | 收款人 ID |
| **operator_id** | TEXT | 經辦人 ID (對應員工資料 `userId`) |
| **attachment_path** | TEXT | 本地發票/單據圖片儲存路徑 (存於本地 data/attachments/ 目錄) |
| **note** | TEXT | 備註 |

#### **收款人帳戶表 (payees)**
| 欄位名 | 型態 | 說明 |
| :--- | :--- | :--- |
| **payee_id** | TEXT (PK) | 收款人唯一 ID |
| **name** | TEXT | 姓名/廠商名稱 |
| **bank_code** | TEXT | 銀行代碼 (3碼) |
| **branch_code** | TEXT | 分行代碼 (4碼) |
| **account_no** | TEXT | 銀行帳號 |
| **account_name** | TEXT | 戶名 |
| **phone** | TEXT | 聯絡電話 |
GAS 串接 Google Cloud Vision OCR，或調用 Gemini 1.5/2.0 Flash API)。
   - **辨識欄位約束**:
     - 發票/收據：發票號碼、統一編號 (買受人/銷方)、開立日期、發票金額 (銷售額/稅額/總計)、品項明細。
     - 估價單：估價單號、估價單位、日期、工項明細、單價、數量、總價。
3. **自動表單回填與核銷**
   - AI 解析結果以標準 JSON 格式傳回前端。
   - 系統自動帶入「會計記帳表單」，並標記出信心度較低的欄位，由會計核對無誤後一鍵存入資料庫。
   - 若辨識出與特定「案號」相關之品項，自動關聯至該案之材料費/工務費。

### 2.3 資料庫直接編輯與查看 (Database Portal)
提供一個類似 Web spreadsheet 的高權限資料管理入口，供管理人員在不開啟 Google Sheets 試算表的情況下，直覺且安全地維護資料。

1. **Web-based Data Grid 介面**
   - 採用高效能的 Data Grid 庫 (如 Tabulator 或 Handsontable) 嵌入前端頁面。
   - 支持搜尋、高級篩選、排序、多行複製貼上、以及行內直接編輯 (Inline Editing)。
2. **細粒度安全防護與變更稽核 (Audit Logs)**
   - **權限管控**: 只有 `權限 >= 8` 的使用者能使用此功能。
   - **唯讀/可寫入隔離**: 根據資料表屬性（如：員工資料表僅能修改非核心欄位，系統配置表唯讀）。
   - **寫入稽核 (Write-Ahead Audit Trail)**:
     - 任何新增、更新或刪除操作，在寫入 Google Sheets 前，必須同步將變更紀錄寫入 `DatabaseAuditLogs` Sheet。
     - 紀錄格式：`Timestamp`, `UserID`, `UserName`, `TableTarget` (資料表名稱), `Action` (INSERT/UPDATE/DELETE), `OriginalData` (原始 JSON), `ModifiedData` (變更後 JSON)。
   - **防衝突機制 (Concurrency Control)**:
     - 編輯前比對該行資料之 `Timestamp`，若偵測到與雲端資料不一致，將提示「資料已被他人修改」，防止覆蓋。

---

## 3. 資料持久化方案

會計系統資料表延續既有 Backbone 架構：
- **會計明細表 (Accounting Ledger Sheet)**
  - 欄位：`LedgerID`, `Timestamp`, `案號`, `收支類別` (收入/支出), `科目` (如: 材料/工資/租金), `項目名稱`, `金額`, `稅額`, `付款狀態`, `收款人/付款對象`, `經辦人UserID`, `PhotoLinks` (憑證圖片), `備註`。
- **資料庫稽核表 (DatabaseAuditLogs Sheet)**
  - 欄位：`LogID`, `Timestamp`, `UserID`, `UserName`, `ActionType`, `TargetSheet`, `Payload`。
