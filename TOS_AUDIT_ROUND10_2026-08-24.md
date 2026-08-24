# TOS 系統盤點｜Round 10｜2026-08-24

## 本輪目標

確認 Quotation / Contract 資料是否存在於 Backend_GAS 以外的 GitHub repository、前端或其他已連線程式碼來源。

## 已確認

### 1. GitHub 可存取 Repository 全量盤點

目前 GitHub App 可存取的 nephi4377 repositories 共確認：

- `nephi4377/liff-checkin`
- `nephi4377/Backend_GAS`
- `nephi4377/ts-leave-request-system`
- `nephi4377/TAUpdata`
- `nephi4377/diet-ai-secretary`
- `nephi4377/travel-yt`

後四者依 repository 名稱與描述分別屬請假、更新工具、飲食 AI、旅遊內容，沒有發現另一個明確的添心報價／合約 repository。

### 2. liff-checkin / Backend_GAS 仍未找到完整 Quote / Contract backend

針對 quotation、quote、contract、合約、報價、contract_amount 等關鍵詞再次檢索，未找到可被認定為 canonical Quotation / Contract Domain 的程式模組。

現有 CustomerFinanceModule 從 `ContractAdjustments` 與 `CustomerReceipts` 開始，代表「原始合約」這一層目前沒有在已盤點程式碼中形成正式主檔。

### 3. 結論提升

Round 9 的「可能缺少 Contract Master」現在可提高為：

> 在目前 GitHub App 可存取的添心相關程式碼範圍內，尚未發現正式 Quotation / Contract Master 實作。

仍不能排除：

- Google Sheet 內存在人工維護的報價／合約資料
- Google Drive 有報價或合約文件
- 其他未連接 GitHub App 的 repository / 本地程式存在報價工具

因此在真正新增模組前，下一階段應盤點 Google Drive / Sheets 的既有報價與合約資產，避免重複建置。

## 架構判斷

目前已知營運鏈可表示為：

```text
Project Master（案號）
      ↓
[ Quotation ? ]       ← 尚未找到 canonical implementation
      ↓
[ Contract ? ]        ← 尚未找到 canonical implementation
      ↓
ContractAdjustments   ← 已存在
      ↓
CustomerReceipts      ← 已存在
      ↓
Margin Revenue        ← 已存在
      ↓
Close Readiness
```

所以目前 TOS 最大的流程斷點已經非常集中：

```text
Project → Quotation → Contract
```

而不是施工、收款或毛利端。

## Decision Log

### D-032｜新增 Quote / Contract 前先盤 Google Drive / Sheets

理由：GitHub 程式碼未找到不代表公司完全沒有報價／合約資料；既有資料很可能以 Google Sheet / Docs / PDF 等形式存在。

### D-033｜Quotation Domain 應採版本化

預定 canonical model：

- quotation_id
- project_id
- version
- status
- subtotal
- tax
- total
- created_by
- created_at
- customer_accepted_at
- supersedes_quotation_id

報價修改不覆寫舊版。

### D-034｜Contract 只能由 accepted quotation 或經核准的人工基準建立

目的：避免 Contract base amount 成為無來源的手填數字。

Contract 必須保存 `source_type` / `source_id`，例如：

- `quotation / Q-xxx-v3`
- `legacy_import / historical_contract`

### D-035｜Legacy 導入需保留來源

舊案若只有既有合約總額，允許建立 legacy Contract，但必須標記：

- migration_source
- imported_by
- imported_at
- source_document_ref（若有）

避免把歷史資料偽裝成新 TOS 流程產生。

## 下一輪

優先盤點 Google Drive / Google Sheets 是否存在：

1. 報價單
2. 工程報價
3. 合約
4. 工程合約
5. 案件金額／簽約金額
6. 客戶付款期別

若找到既有資料，先建立 Legacy Mapping；若確認不存在，再正式設計 `Quotation v0.1` 與 `Contract v0.1`。