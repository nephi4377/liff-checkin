# 客戶端唯讀施工進度 — 產品與技術規格（v2.5）

## 0.1 產品決策紀錄（**已拍板**，工程依此實作）

| 主題 | 決定 |
|------|------|
| **LINE 官方帳號** | **同一個**官方帳號服務客戶與內部。 |
| **Rich Menu** | **依使用者綁不同選單**（Messaging API **`linkRichMenuToUser`** 等）：客戶看到「含施工進度 LIFF」之選單；員工看到內部選單。 |
| **LIFF** | **客戶與員工分開兩支 LIFF**（不同 LIFF ID、不同 Endpoint 路徑或同網域不同 path）。 |
| **一個客人幾個案** | **同一時間 1 個案**：同一 `CustomerLineUserId` 僅允許 **一筆 `Status=active` 綁定**；多案為日後擴充。 |
| **進度頁是否顯示案場資訊** | **不顯示**：不可出現與主控台右欄「案場資訊」同等內容（含案名、地址、電話、團隊聯絡、備註等）。畫面以 **已發布施工日誌** 為主（時間、工項／標題、內文、照片）＋固定標題「施工進度」；**施工項目**（內部工項完成狀況，見 **§2.3**）為輔、預設摺疊，不與日誌搶焦點。 |
| **對客用詞（施工項目）** | 畫面與對客說明**不使用**「驗收進度／驗收工項」等字眼；改為 **「施工項目」「項目清單／完成狀況」** 等白話。內部文件、試算表欄位名（`audit_*`）與審核器語境仍可依 [12](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md) 沿用，**不必**強制改後端欄位鍵名。 |
| **誰能按「綁定客戶」** | **依主控台既有權限與流程**；本 SPEC 不重複定義角色表，後端沿用現有驗證邏輯即可。 |
| **客戶進度頁架設** | 與其他模組相同：**放 GitHub**，對外網域 **`https://info.tanxin.space`**（HTTPS）。LINE Developers 之 **客戶 LIFF Endpoint URL** 須指向該網域下之正式路徑（例如 `https://info.tanxin.space/.../client-construction-progress.html`）。 |

---

## 0. 政策與範圍（**本期唯一目標**）

**只做一件事**：在 **內部人員完成綁定** 的前提下，讓客戶用 **獨立入口** **唯讀** 查看 **自己案件的施工進度**（以 **已發布之施工日誌** 為主）。

**本期不做**（自 v1.1 收斂移除，日後若要再做另開議題／文件）：

- 客戶在主控台內 **發言、串流回覆、留言串**  
- 語音、推播、站內即時對話  
- 客戶使用與員工相同的 `project` 全量讀取 API  

> 舊版曾討論之串流文字、SocialComments 擴充等，**不納入 v2.0 交付**；實作時勿依賴該部分以免範圍膨脹。

---

## 1. 名詞

| 名詞 | 定義 |
|------|------|
| **內部主控台** | `managementconsole.html`，權限僅內部。 |
| **客戶進度頁** | 新開之 **輕量 HTML**（或 LIFF 開同一網址），**僅 GET 型態資料**，無編輯、無發文。 |
| **施工項目（對客）** | 畫面上與內部審核器／Firebase 同步之 **工項完成狀況**（依區、逐項名稱與完成度）；**不**稱「驗收進度」。資料鍵與內部流程仍見 [12](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md)。 |
| **綁定** | 內部人員將「**案號／專案識別**」與「**客戶身分**（建議 LINE `userId`）」寫入綁定表；**未綁定則客戶端不得讀取任何案資料**。 |
| **Rich Menu（大圖選單）** | LINE 聊天室下方的圖片按鈕列；可設定某一格 **點了開 LIFF**，讓客戶一鍵進「施工進度」。 |
| **LIFF** | LINE 內建瀏覽器開你的網頁，程式可取得 **LINE 使用者 id**（用於綁定與唯讀 API）。 |

---

## 2. 產品行為

### 2.1 綁定流程（必備）

1. 內部在主控台（或後台）選 **專案／案號**。  
2. 指定 **客戶**（實務上多為 LINE；亦可預留欄位，但驗證方式需與入口一致）。  
3. 寫入 **`ClientPortalAccess`**，`Status = active`，並記錄 **BoundByUserId、BoundAt**。  
4. 內部將 **進度頁連結**（含 LIFF 或固定入口＋登入後辨識）交給客戶；客戶開啟後僅能看到 **綁定的那一案**。  

**撤銷**：`revoked` 後，客戶端 API 一律拒絕（建議與「查無綁定」同一錯誤外觀，避免洩漏案號是否存在）。

### 2.2 客戶畫面上顯示什麼（MVP）

- **視覺優先順序**：**現場施工紀錄**（已發布日誌）為客戶理解進度的**主內容**；**施工項目**（內部工項同步之完成狀況）為**輔助**，採摺疊列呈現，預設收合，不佔首屏大量版面。  
- **建議預設**：**已發布施工日誌** 列表（時間、標題／工項、**對客安全** 之文字內容、照片連結）。  
- **資料來源判定**：後端既有 `getLogsByProject_V3_FINAL` **僅含 `Status === '已發布'`** 之日誌，與「只給客人看正式發出內容」一致，**可直接作為進度來源**，不必另做「對客再發布」按鈕即可上線 MVP。  
- **回傳前必做 — 欄位白名單（DTO）**：客戶 API **不得**把整張 log 物件原樣轉 JSON；只允許例如：`Timestamp`、`Title`（或既有工項欄位名）、`Content`／`workDescription`（依試算表實際欄位對齊）、`PhotoLinks`、以及供前端排序用的穩定 id（可用 `LogID` 或僅序號，**勿帶 UserID／內部備註欄**）。若日誌列上有 **明顯內部用欄位**，一律剔除。  
- **工程排程表**：**預設不開放**（常含工班、聯絡方式）；若日後要「里程碑-only」再單獨規格化。

### 2.3 案場識別與隱私（**已拍板：零「案場聯絡」資訊，但須可看工項完成狀況（對客：施工項目）**）

- **禁止**在客戶進度頁展示 **案場聯絡與識別面板** 同等內容：**案名、地址、電話、地圖、團隊／工班聯絡、保證金、內部備註** 等（與內部主控台右欄「案場資訊」一覽）。  
- **允許（對客統稱「施工項目」；資料仍為審核器／戰情之工項完成度）**：  
  - 自 **`page=project` 之 `overview`** 僅取用 **`audit_items_total`、`audit_items_verified`、`audit_percent`（及同等戰情欄位）** 作摘要（來源為 [12](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md) 同步寫入之 Sheets 欄位）。  
  - 自 **Firebase `quotations/{案號}`**（與 **`BudgetAuditor_Standalone_V2`** 相同路徑；舊檔名 `BudgetAuditor_Standalone.html` 所寫之結構同）讀取 **`context.items`**，**僅渲染**：`name`、`zone`、`completion_percent`／`is_ui_done`、**已取消**狀態；**嚴禁**顯示 `raw_line`、單價、數量、**`price`** 與可辨識之報價／金額等細節。  
- **版面與互動（雛形頁已實作，正式對客可沿用原則）**  
  - **區塊順序**（由上而下）：頁首標題「施工進度」與案號副標 →（錯誤／載入提示）→ **施工項目**（外層 **`<details>` 預設摺疊**；摺疊時**單列**摘要：左為「施工項目」、右為 **「未完成 n · 已完成 m」**，避免日誌很長時需捲到頁尾才看到）→ **「現場施工紀錄」** 標題與已發布日誌列表。  
  - **展開施工項目後**：可顯示與內部同步之說明、戰情摘要（若有）、整體比例條；**依 `zone` 分區**，每區一個 **`<details>` 預設摺疊**，摘要列為 **區域名稱 +「未完成 x · 已完成 y」**；分區排序：**仍有未完成項的分區優先**，其餘依區域名稱排序。  
  - **對客文案**：說明「現場狀況以**下方**現場施工紀錄為主」；**不使用**「驗收進度／驗收工項／驗收單」等對客標題。  
- **客戶端禁止行為（硬性）**：客戶 **不得** 在進度頁 **標示完成**、**變更工項完成狀態**、**編輯內部項目表** 或 **對 Firebase／GAS 寫入** 任何與工項／審核相關之資料。本頁僅 **唯讀瀏覽**；狀態變更 **僅能** 由內部於 **報價單審核器**（或同等內部流程）操作。前端 **不得** 提供按鈕、表單、`set()`／`update()` 等寫入路徑。  
- **允許（施工紀錄）**：已發布日誌之 **標題、現場描述、照片**（與右欄案場卡片無關）。  
- **過渡實作**：雛形頁 `client-construction-progress.html` 仍呼叫既有 `project` GET 取得 `overview` + `dailyLogs`；工項細項由前端讀 RTDB（與審核器共用 `localStorage` 鍵 `fb_audit_config` 以支援匿名讀規則）。正式 **`getClientConstructionProgress`** 上線時，應改由後端合併並脫敏後下發，避免客戶端依案號直連 Firebase 之風險。  
- **本地測試**：`?local=1`（或本機 hostname）時略過 LIFF；**不顯示**黃底「已略過 LIFF／userId」提示橫幅。開發者依 **`__DEV_CLIENT_DEFAULTS`** 或網址 **`userId=`／`uid=`** 帶入試算表可辨識之 LINE userId；若未帶且未啟用預設，僅以錯誤橫幅（紅底）提示，不額外佔用成功路徑版面。

### 2.4 LIFF 客戶頁與 **LINE Rich Menu**（從選單一鍵進施工進度）

**目標**：客戶在 LINE 聊天室下方有 **Rich Menu（大圖選單）**，點其中一區（例如「**查看施工進度**」）即開啟 **客戶專用 LIFF**，進入 **§2.2** 之唯讀進度頁。

#### 2.4.1 LINE 後台設定（營運／工程協作）

1. **在 LINE Developers 建立「客戶專用」LIFF**（與內部員工主控台 **不同 LIFF ID**）：  
   - **Endpoint URL**：指向 **`https://info.tanxin.space`** 上已部署之 **`client-construction-progress.html`**（完整 HTTPS URL，與其他頁面同一發佈流程）。  
   - **Scope**：至少需能取得使用者身分以對應綁定表 — 通常勾選 **profile**（`getProfile()` → `userId`）。  
2. **取得 LIFF URL**：形式為 `https://liff.line.me/{客戶端_LIFF_ID}`（以 LINE 後台顯示為準）。  
3. **在 LINE Official Account Manager（或 Messaging API）建立 Rich Menu**：  
   - 新增一個 **URI 類型** 的區塊，連結填上 **上一步的 LIFF URL**（勿填一般網頁網址若你希望以 LIFF 身分開頁；若填一般 https，則不會自動帶 LIFF context，**不利於用 userId 綁定**）。  
   - 文案／圖稿：例如主按鈕「施工進度」、其餘區塊可放官方網站、客服電話等（非本 SPEC 範圍）。  
4. **發佈 Rich Menu** 並與官方帳號綁定，使好友在聊天室下方看得到選單。

#### 2.4.2 與內部員工 Rich Menu 分離（**已採用：做法 A**）

**前提**：**同一個官方帳號**（見 **§0.1**）。

| 做法 | 狀態 |
|------|------|
| **A. 依使用者綁不同 Rich Menu（Messaging API）** | **已採用**。於適當時機（例如完成 **綁定客戶**、或 webhook 辨識身分）對該 `userId` 呼叫 **`linkRichMenuToUser`**，掛上「客戶版」Rich Menu（含施工進度 LIFF）；員工帳號掛「內部版」Rich Menu。需 **Channel Access Token** 與 Rich Menu ID（客戶／內部各至少一張）。 |
| **B. 兩個官方帳號** | **不採用**（與 §0.1 衝突時以 §0.1 為準）。 |
| **C. 全員同一張 Rich Menu** | **不採用**（已由 A 取代）。 |

#### 2.4.3 檢核項目（Rich Menu 相關）

- [ ] 客戶手機 LINE 聊天室下方可見 **客戶版** Rich Menu。  
- [ ] 點「施工進度」後 **正確開啟客戶 LIFF**（網址列或開啟方式符合 LIFF，且 `liff.getProfile()` 可取得 `userId`）。  
- [ ] 已綁定：進入後可載入該案已發布日誌；未綁定：顯示與 SPEC 一致之錯誤／引導聯絡（**不洩漏**他案資訊）。  

---

## 3. 技術實作判定（工程怎麼做）

### 3.1 後端（`project-console` / GAS）

| 項目 | 判定 |
|------|------|
| **新試算表** | `ClientPortalAccess`（欄位至少：`ProjectKey`, `CustomerLineUserId`, `Status`, `BoundByUserId`, `BoundAt`, `RevokedAt` 選填）。 |
| **新 action（內部）** | `bindClientToProject`：驗證呼叫者為內部角色後 `appendRow`；可選 `revokeClientPortalAccess`。 |
| **新 action（客戶）** | `getClientConstructionProgress`（名稱可調）：請求帶 **LINE userId**（由 LIFF `getProfile()` 取得，**不可**信任前端任意傳案號當主鍵）。後端：用 `CustomerLineUserId` 找 **唯一一筆 `active` 綁定**（**已拍板：一客戶同一時間僅一案**；`bindClientToProject` 應拒絕第二筆 active 或先要求撤銷／結案流程）。 |
| **綁定權限** | **依主控台既有設定與流程**；本 SPEC 不另定角色名單。 |
| **資料組裝** | 以綁定得到的 `ProjectKey` 呼叫既有 `getLogsByProject_V3_FINAL(ProjectKey)`，再 **`map` 成白名單 DTO** 回傳。 |
| **資安** | 禁止客戶端呼叫現有 **`project` 全案 GET**；**禁止**以客戶 token 列出所有專案。錯誤訊息統一、不洩漏他案。 |

### 3.2 前端（`CODING/modules/projects/` 或獨立子資料夾）

| 項目 | 判定 |
|------|------|
| **新頁（已建立前端雛形）** | `modules/projects/client-construction-progress.html` + `js/client-progress-main.js`：**GET `page=project`** 取 `dailyLogs` + **`overview` 內 `audit_*` 摘要**；另以 Firebase **`quotations/{案號}`** 載入與 **BudgetAuditor** 相同結構之**工項清單**，畫面對客稱 **施工項目**（唯讀、無報價細節）。版面與摺疊行為見 **§2.3**。本地測試：`__DEV_CLIENT_DEFAULTS` 或 `?local=1&userId=`／`uid=`；**不顯示**本地 LIFF 略過之黃底橫幅。LIFF 見 **§2.4**。 |
| **主控台增量** | 在 `managementconsole` **僅增加**（或沿用既有）「客戶進度：綁定／撤銷」區塊；**誰可操作**依 **既有權限流程**（見 **§0.1**）。不實作留言串。 |
| **部署** | 客戶進度 HTML／JS **與其他頁面相同**：進 **GitHub** 發佈管線，對外 **`https://info.tanxin.space`**；LIFF Endpoint 填正式完整 URL。 |

> **過渡說明（與 §3.1 對齊）**：雛形為「不動後端」與**過渡期手動驗證**，**暫**以 GET `page=project` 讀取 `dailyLogs`；正式對客上線時應改為 **`getClientConstructionProgress` + `ClientPortalAccess` 綁定**，並移除此依賴，以符合 §3.1 資安條文。  
> **前端開發用**：`client-progress-main.js` 內 **`__DEV_CLIENT_DEFAULTS`**（預設 userId／案號）僅供本地；**上線前務必 `ENABLED: false`**。

### 3.3 本期檢核清單（工程／產品）

- [ ] 未綁定 LINE userId：進度 API 失敗，畫面不顯示任何日誌內容。  
- [ ] 綁定後：只看得到 **該案已發布** 日誌；看不到草稿、看不到其他案。  
- [ ] 撤銷後：與未綁定相同行為。  
- [ ] Network 面板中回應 JSON **無**內部用敏感欄位。  
- [ ] **Rich Menu** 點「施工進度」可開客戶 LIFF 並完成上述流程（見 **§2.4.3**）。  
- [ ] 客戶進度頁 **無案場聯絡／識別一覽**，但 **施工項目（工項完成狀況）與戰情摘要** 正確（見 **§2.3**）。  
- [ ] **施工項目**區 **無任何寫入／勾選完成** 之 UI 或 API 呼叫（見 **§2.3** 客戶端禁止行為）。  
- [ ] 對客文案 **不出現**「驗收進度／驗收工項」等用語；施工項目為 **預設摺疊**，且區塊位於日誌區**之上**以便進頁可見（見 **§2.3**）。  

---

## 4. 與既有文件關係

| 文件 | 關係 |
|------|------|
| [05_PROJECT_WORKSPACE_SPEC.md](./05_PROJECT_WORKSPACE_SPEC.md) | 內部主控台架構不變。 |
| [08_PROJECT_CONSOLE_CRUD_SPEC.md](./08_PROJECT_CONSOLE_CRUD_SPEC.md) | 既有 `project` / 日誌 CRUD **不**給客戶用；本期新增 actions 應補登於 08 之矩陣（實作 PR 時補）。 |
| [12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md) | 報價工項 JSON／Firebase／`updateAuditSummary`；與客戶進度頁「工項比對」之資料源見 **§5**。 |

---

## 5. 與報價單審核器（`BudgetAuditor_Standalone_V2.html`）工項 — 能否讀入與比對？

> **實作現況（雛形）**：`client-construction-progress` 在 **現場施工紀錄** 之上顯示 **施工項目**（外層預設摺疊；展開後為戰情摘要 + 依區域之工項完成狀態，分區預設摺疊），資料來源為 **Firebase `quotations/{案號}`**（與審核器同步之 `context`）及 **`page=project` 之 `overview.audit_*`**。詳見 **§2.3**。

### 5.1 釐清：`Standalone` 頁面本身不是「工項 API」

- **`BudgetAuditor_Standalone_V2.html`** 是一個**獨立網頁工具**（內部主線）：拖入 JSON、輸入案號連 Firebase、或走 GAS Hub 取案名等。  
- **真正的工項清單**是其記憶體裡的 **`appData.items`**（以及 `total_summary`、`案號` 等），結構定義見 [12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md)（例如 Firebase 路徑 **`quotations/{案號}`**、欄位 `name`、`zone`、`completion_percent`、`audit_remark` 等）。  
- 因此其他頁面（含 **客戶施工進度頁**）若要「像審核器一樣的工項」，應讀取 **同一套資料結構**（JSON／Firebase／或未來由 GAS 轉發的 DTO），而不是去「執行」或內嵌整份 V2 驗收頁（該頁含編輯、同步、金額顯示脈絡，**不適合**直接當客戶唯讀元件）。

### 5.2 與「施工日誌」做比對時缺什麼？

- **客戶進度頁現況**（`client-construction-progress`）只取 **`page=project` → `dailyLogs`**：欄位以 **`Title`／`Content`／照片** 為主。  
- **Auditor 工項**以 **`id`、`name`、`zone`、完成度** 為主。兩邊 **沒有內建共同主鍵**，無法自動一一對起來，除非：  
  - **產品規則**：例如約定日誌 **`Title` 必須等於工項 `name`**（脆弱）；或  
  - **資料面**：日誌寫入時帶 **`linkedAuditItemId`**（或同等欄位）指向 `items[].id`；或  
  - **後端**：由 GAS 依案號合併兩來源並回傳「已對齊」的列（建議正式對客時走此路，避免前端暴露 Firebase）。

### 5.3 建議接法（擇一或併用）

| 做法 | 說明 |
|------|------|
| **A. 後端合併（推薦給客戶端）** | 新 action（或擴充唯讀 API）依 `ProjectKey` 讀 Auditor 摘要（或 Sheets 戰情欄位），與已發布日誌一併回傳 **對客脫敏** 的「工項進度條 + 對應日誌連結」。 |
| **B. 僅內部比對** | 內部開發者／查帳員在 **BudgetAuditor** 內比對；客戶頁不顯示工項細目。 |
| **C. 前端另拉 Firebase** | 與 Standalone 相同 SDK 讀 `quotations/{案號}` — **客戶頁一般不建議**（金鑰、規則、暴露面）。若要做，須 **匿名／自訂 Token 規則** 與極度縮欄。 |

**結論**：**可以**把「審核器那份工項邏輯」接到同一案場做比對，但應讀 **資料（items 結構）** 並由 **§5.2** 定對照規則；**不要**把 `BudgetAuditor_Standalone_V2.html` 當成資料來源本體硬嵌進客戶頁。

---

## 6. 後續擴充（**非本期**，勿併入同一 PR）

- 客戶端串流文字、留言 Visibility、`SocialComments` 擴充。  
- **一客戶多案**、自選案號（首期已拍板 **僅一案**，見 **§0.1**）。  
- 排程里程碑唯讀、LINE 推播連結。  
- **工項與日誌對齊**：依 **§5** 定主鍵或後端合併 API 後再實作 UI。  

---

*文件版本：**v2.6** | **2026-04-25**：§2.3、§5 內部驗收表主檔**改列** `BudgetAuditor_Standalone_V2.html`、Firebase 工項可存 **`price` 欄**但**客戶端嚴禁顯示**之敘述對齊。v2.5（2026-04-23）：對客用語與施工項目版面。維護：與 [12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC](./12_BUDGET_AUDITOR_AND_CONSOLE_INTEGRATION_SPEC.md)、`tools/BudgetAuditor_Standalone_V2.html`、Firebase `quotations` 同步。*
