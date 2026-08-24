# TOS 系統盤點｜Round 12｜2026-08-24

## 本輪目標

1. 修正 Dropbox「完工照」與公司實際主要用途「施工照／案件重要文件」的區分。
2. 找出 Project Console 的 Dropbox 根目錄、案件資料夾匹配規則與施工照預設路徑。
3. 重新檢查驗收／報價相關程式，修正前面過度簡化的結論。

---

## 1. Dropbox 的主要專案路徑確實是「施工照」

`project-console/config_.js` 的 `getRootFormat()` 預設值為：

```text
/添心設計/設計圖/{project}/施工照
```

`DBX_ROOT` 則由此格式反推出：

```text
/添心設計/設計圖
```

因此：

- 公司 Project Console 的主要 Dropbox 專案結構，是以「案件資料夾 → 施工照」為核心。
- `CompletionMediaList.js` 的「完工照」讀取器，是後來針對 FB／行銷完工媒體增加的專用功能，不代表 Dropbox 只存完工照。
- 後續 TOS 文件必須將「施工照」與「完工媒體」分開建模。

### 修正先前敘述

先前將 Dropbox 讀取能力描述成「完工照為主」過於狹窄，現正式修正為：

> Dropbox 是案件施工照片、正式合約與重要文件的主要文件儲存層；Project Console 另有一支專門針對「完工照」的唯讀媒體 API。

---

## 2. `findProjectFolder_()` 的案號匹配規則已確認

`project-console/dropbox_api.js`：

```text
findProjectFolder_(projectCode)
```

規則：

1. 只在 `DBX_ROOT` 第一層子資料夾搜尋。
2. 案號會先去除前導 0。
3. 資料夾名稱必須「以案號開頭」，後面接非數字字元或直接結尾。
4. 若有多個符合，依資料夾名稱長度排序後取第一個。
5. 找不到時回 `null`，不會建立新資料夾。

因此下列名稱可被案號 `734` 找到：

```text
734 王宅
734-王宅
734_王宅
734
```

而 `7341 王宅` 不應被誤認為 `734`。

### 建立新專案資料夾

`findOrCreateProjectFolder_()`：

- 先呼叫 `findProjectFolder_()`。
- 找不到才在 `DBX_ROOT` 新建資料夾。
- 資料夾名稱由傳入的 `projectNameRaw` 清除非法字元後建立。

此規則可以直接延用至 TOS Document Gateway，不需另造案件與 Dropbox 的映射表，除非日後遇到例外命名。

---

## 3. Project Console Dropbox 已具備通用讀取 primitives

`project-console/dropbox_api.js` 已有：

- `dbxGetMetadata_(path)`
- `dbxDownloadFile_(path)`
- `listDbxFolderChildren_(path)`
- `listDbxFilesInFolder_(path)`
- `dbxShareRawUrl_(path)`
- `findProjectFolder_(projectCode)`
- `findOrCreateProjectFolder_()`

這代表未來的通用 Document Gateway，不需要重寫 Dropbox SDK，只需在現有 primitives 上增加：

```text
listProjectDocuments(project_id)
searchProjectDocuments(project_id, keyword, recursive)
getProjectDocumentMetadata(project_id, path)
fetchProjectDocument(project_id, path)
```

並加入 project-folder path gate、權限與稽核。

---

## 4. 施工照與完工媒體應拆成兩個語意

### Construction Media

來源：案件資料夾中的 `施工照`。

用途：

- 現場施工回報
- 日誌
- AI 施工分析
- 工程佐證
- 客訴／保固回溯

### Completion Media

來源：案件資料夾內名稱含「完工照」、排除「美照」的資料夾。

用途：

- FB / 社群工作室
- 完工案例挑圖
- 行銷素材

兩者可共用 Dropbox transport，但不應共用同一個 Domain 語意。

---

## 5. 驗收 Domain 前一輪結論需要修正

前面 Round 8 曾判斷「尚未找到正式 Inspection Domain」。本輪發現 `project-console/SiteReportAcceptance.js` 已存在實際驗收相關能力。

它會從 Firebase：

```text
quotations/{project_no}
```

讀取：

- items
- category_tag
- work_type
- completion_percent
- status
- total_summary.overall_completion

並能依工種列出未完成項目。

因此更精確的結論應改為：

> 系統已有「驗收／工項完成度讀取能力」，但尚待確認是否有完整、canonical 的 Inspection / Defect / Customer Acceptance transaction model。

目前看到的是以 quotation items 的完成百分比推導未完成工項，而不是已確認存在一套獨立的驗收缺失主檔。

---

## 6. 更重要的新發現：Firebase 已存在 Quotation Context

`SiteReportAcceptance.js` 的：

```text
fetchQuotationContextFromFirebase_(projectNo)
```

直接讀取：

```text
/quotations/{案號}.json
```

`buildQuotationSummaryFromContext_()` 會從 items：

- 排除 cancelled / is_cancelled
- 加總 `price`
- 整理 work_type / category_tag
- 推導 `contract_amount_auto`
- 推導工種 vendor slots

因此 Round 9 / 10 的「GitHub 未找到 Quote Domain」必須修正為：

> 尚未找到「正式版本化 Quotation Master backend」，但 Firebase 已經保存一套實際使用中的 quotation context，而且驗收與毛利摘要正在依賴它。

目前最重要的新問題不再是「有沒有報價資料」，而是：

1. Firebase quotation 是從哪裡產生？
2. 它是否有版本？
3. 它代表最新報價、施工驗收表，還是正式簽約版本？
4. `contract_amount_auto` 是否可視為正式合約金額？目前不能直接假設。
5. Dropbox 正式合約金額與 Firebase quotation 加總是否一致？

---

## 7. TOS Source of Truth 再修正版

目前較合理的分工是：

```text
Google Sheets
  └─ 結構化營運資料
     Project / Employee / Schedule / Logs / Finance / Queue ...

Firebase
  └─ 即時／鏡像／施工驗收與 quotation context

Dropbox
  └─ 正式文件與媒體
     合約 / 重要文件 / 施工照 / 完工媒體

GitHub
  └─ 程式碼、規格、Audit 與 Decision Log
```

注意：Firebase quotation 是否應升格為正式 Quote Source of Truth，尚未確認。

---

## 8. 新增／修正 Decision Log

### D-040｜Construction Media 與 Completion Media 分開

施工照是工程紀錄；完工照是行銷／完工素材。兩者只能共用 Dropbox transport，不應混成一種媒體類型。

### D-041｜沿用現有 Dropbox project-folder resolver

TOS Document Gateway 優先重用 `findProjectFolder_(project_id)`，不另建映射表；例外案件再建立 explicit mapping。

### D-042｜Dropbox Document Gateway 建立於 project-console primitives 之上

不新建 Dropbox 認證層，直接重用 metadata/download/list/share primitives，並維持 server-side token。

### D-043｜修正 Quotation 缺口定義

不再稱「完全沒有 Quotation」。改為：

- 已有 Firebase quotation context
- 尚未確認 canonical source、版本、簽約鎖定與歷史版本

### D-044｜Inspection 缺口重新定義

不再稱「完全沒有驗收」。改為：

- 已有以 quotation items / completion_percent 為基礎的驗收資訊與未完成工項讀取
- 尚需確認正式驗收事件、缺失、客戶簽認與關閉規則

---

## 9. 下一輪必做：全盤統整

依使用者要求，下一輪不再繼續零散下鑽，先產出一份完整 Master Summary，整合 Round 1～12：

1. 現有系統總架構
2. Source of Truth Matrix
3. Domain-by-Domain 現況
4. 已確認資料流
5. D-001～D-044 決策
6. 已發現的技術債／資料風險
7. 哪些應保留、哪些重構、哪些新建
8. P0 / P1 / P2 優先順序
9. TOS 建議最終架構
10. 下一個真正應開始實作的模組

Master Summary 完成後，再繼續追 Firebase quotation 的產生來源與 Dropbox Contract Gateway。