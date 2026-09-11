# TOS｜添心營運管理系統盤點紀錄

> 建立日期：2026-08-24  
> 目的：持續盤點「添心設計」現有程式、資料流、模組、技術債與營運缺口，作為 TOS（Tianxin Operating System／添心營運管理系統）後續整併與重構依據。

---

## 1. 盤點原則

本文件與既有 `PROJECT_MAP.md` 分工如下：

- 倉庫根目錄 `PROJECT_MAP.md`：描述既有系統藍圖、模組關係與主要資料流。
- `TOS/TOS_AUDIT.md`：記錄實際盤點結果、現況判斷、問題、風險、缺口、優先級與後續建議。
- 所有 TOS 盤點檔（主紀錄、Master Summary、各 Round）一律放在 `TOS/`，不要寫回倉庫根目錄。

盤點過程持續更新，不以一次性報告為目標。

---

## 2. 已確認的主要 Repository

### 2.1 nephi4377/liff-checkin

角色：目前可視為「前端／LIFF／企業工具整合與文件中心」之一。

已確認存在：

- `.agents/`
- `.cursor/`
- `LOG/`
- `SPEC/`
- `assets/`
- `AGENTS.md`
- `PROJECT_MAP.md`
- `README.md`
- `README_CODING.md`

目前判斷：此 Repo 已不只是單純的 LIFF 打卡頁，而是逐步承載企業前端工具、AI Agent 規範、系統文件與部分 Web 戰情介面。

### 2.2 nephi4377/Backend_GAS

角色：Google Apps Script 雲端後端核心。

已確認主要模組：

- `CheckinSystem/`
- `ProjectSchedule/`
- `accounting-gas/`
- `core_library/`
- `project-console/`
- `LOG/`
- `SPEC/`
- `patches/`
- `tools/`

目前判斷：Backend_GAS 已具備模組化後端雛形，而不是單一 GAS Script。

---

## 3. 既有系統架構初步確認

根據 `PROJECT_MAP.md`，現有架構已涵蓋：

1. Electron 員工生產力／出勤客戶端
2. GAS 雲端後端
3. Google Sheets 資料儲存
4. Web 戰情前端
5. LINE／LIFF 身分綁定與現場回報
6. Dropbox／Drive／Firebase 圖片與檔案處理
7. Gemini AI 內容處理
8. 備份守護工具
9. 本地 SQLite 財務／記帳工具
10. 投資分析工作區

### 初步判斷

目前真正需要做的，不是重寫整套系統，而是：

- 統一案件主鍵與資料模型
- 找出重複資料來源
- 明確切分各模組責任
- 整理 API 契約
- 建立跨模組狀態流
- 補足 CRM → 報價 → 合約 → 施工 → 成本 → 驗收 → 結案 → 獎金 → KPI 的完整營運閉環

---

### R-039｜助理工作流系統首版（2026-09-10）

- 新增前端模組：`modules/info/assistant-workflow.html`，由主控台 `#/assistant-workflow` 開啟。
- 以窗簾安裝與家具配送案例抽象出相依步驟，實際案件資料不寫入公開前端原始碼。
- v1.4 仍僅使用瀏覽器 `localStorage`，但已可從窗簾、家具或組合範本建立多個獨立工作流；每個實例以 `workflow_id` 隔離任務、欄位與 append-only 事件，並可依執行者 `employee_id` 在「我的工作」跨工作流彙整待辦、顯示阻擋原因及切回對應 `project_id`。時間軸保留操作者、ISO 時間、狀態轉移、回報快照、退回原因與證據連結。尚未新增 GAS／Sheet 資料流，不可視為跨裝置共用的正式任務紀錄。
- 正式規格見 `SPEC/助理工作流系統_SPEC.md`，生命週期採 `assigned → in_progress → reported → approved / rework`，事件須可追溯。

### R-040｜助理工作流改為流程說明優先（2026-09-10）

- 依產品決策移除整合主控台首頁的助理工作流卡片及 `#/assistant-workflow` 操作路由；`modules/info/assistant-workflow.html` 原型保留但不提供入口，避免被誤認為正式跨裝置任務系統。
- 新增 `modules/help/assistant-workflow.html`，由使用教學 `#/help/assistant-workflow` 開啟；定位為助理常見事務的流程說明與訓練頁，不產生案件任務資料。
- 優先規格改為 `SPEC/助理工作流程說明頁_SPEC.md`；先深化進場／安裝、家具配送、報價前置、案場異常追蹤，再依序補選材、版本、款項、日誌、驗收與保固。

### R-041｜進場／安裝協調異常分支（2026-09-10）

- `modules/help/assistant-workflow.html` v1.1 補齊廠商未回覆、任何一方改期、施工／安裝取消及客戶不同意時段四種分支。
- 異常發生後原時段視為待重新確認；各方未再次同意前，不得標示為已確認或向客戶承諾。
- 每次異常要求保存 canonical `project_id`、承辦／操作者 `employee_id`、發生與聯絡時間、狀態、證據、待決策人及下一次追蹤時間；說明頁仍不建立或寫入正式任務資料。

### R-042｜家具配送異常分支（2026-09-10）

- `modules/help/assistant-workflow.html` v1.2 補齊缺件、破損／規格不符、超材、無電梯、無法進場及二次配送六種分支。
- 每種分支明定停止點、現場證據、內外部回報順序與可用狀態；責任、費用或新時段未確認前，不由助理代替供應商、司機、客戶或內部承辦人做決定。
- 異常要求保存 canonical `project_id`、承辦／操作者 `employee_id`、到場與發現時間、品項數量、狀態、貨物保管位置及證據；完成後仍須依「指派 → 執行 → 回報 → 審核／退回」由指定審核者確認。說明頁不新增正式案件資料流。

### R-043｜報價前置異常分支（2026-09-10）

- `modules/help/assistant-workflow.html` v1.3 補齊缺尺寸、圖面版本不一致、廠商未報價及報價逾有效期限四種分支。
- 缺尺寸時停止受影響項目，不以猜測值補空白；版本衝突由設計師指定唯一有效版本；廠商未回覆不可填為零元；失效報價須取得新版或可留存的書面展延確認。
- 異常要求保存 canonical `project_id`、承辦／操作者 `employee_id`、交辦與處理時間、狀態、缺項或差異、圖面／報價版本及詢價證據；補齊後仍須依「指派 → 執行 → 回報 → 審核／退回」由指定審核者確認。說明頁不新增正式案件資料流。

### R-044｜案場進度異常分支（2026-09-10）

- `modules/help/assistant-workflow.html` v1.4 補齊擋工、延誤、責任未明及需由客戶決定四種分支。
- 助理只整理事實、影響、證據與下一個決策點，不自行認定責任、取捨方案或把廠商預估當公司承諾；客戶未明確回覆不視為同意。
- 異常要求保存 canonical `project_id`、承辦／操作者 `employee_id`、發現與回報時間、受影響工項／期限、狀態、決策者與證據；仍依「指派 → 執行 → 回報 → 審核／退回」完成複查。說明頁不新增正式案件資料流。


### R-045｜進場／安裝協調訊息範本（2026-09-10）

- `modules/help/assistant-workflow.html` v1.5 新增進場／安裝的內部回報、廠商詢問與客戶確認三種可直接套用範本。
- 內部範本保留 canonical `project_id`、執行者與審核者 `employee_id`、時間、狀態、證據、卡點與退回補正資訊；對外範本只提供已核對的選項，不把詢問中時段當成承諾。
- 訊息送出後仍須把回覆帶回「指派 → 執行 → 回報 → 審核／退回」紀錄；說明頁不新增正式案件資料流。


### R-046｜家具配送訊息範本（2026-09-10）

- `modules/help/assistant-workflow.html` v1.6 新增家具／材料／設備配送的內部回報、供應商／搬運方確認與客戶收貨確認三種範本。
- 內部範本保留 canonical `project_id`、執行者與審核者 `employee_id`、到場與完成時間、狀態、應到／實到品項、貨物保管位置、證據、責任窗口及退回補正資訊。
- 對外範本先確認供貨、車趟與現場限制，再取得客戶答覆；所有回覆仍帶回「指派 → 執行 → 回報 → 審核／退回」紀錄，說明頁不新增正式案件資料流。


### R-047｜報價前置訊息範本（2026-09-10）

- `modules/help/assistant-workflow.html` v1.7 新增報價／估價前置的內部彙整、廠商詢價與客戶缺項確認三種範本。
- 範本明列圖面／丈量版本、缺尺寸與規格、詢價送出與回覆期限、報價有效期限及待設計師決策項目；禁止以猜測值、零元或過期報價補空白。
- 內部紀錄保留 canonical `project_id`、執行者與審核者 `employee_id`、時間、狀態、證據及退回補正資訊，仍依「指派 → 執行 → 回報 → 審核／退回」完成；說明頁不新增正式案件資料流。


### R-048｜案場進度異常訊息範本（2026-09-10）

- `modules/help/assistant-workflow.html` v1.8 新增案場進度與異常追蹤的內部送審、現場窗口／廠商查證與客戶決策三種範本；至此四類 P0 均已有內部、外部與客戶訊息範本。
- 範本區分已確認事實、影響、保護措施與待決策事項；責任未明時不先判責，現場預估不改寫成公司承諾，客戶未明確回覆不視為同意。
- 內部紀錄保留 canonical `project_id`、執行者與審核者 `employee_id`、時間、狀態、證據、決策期限與退回補查資訊，仍依「指派 → 執行 → 回報 → 審核／退回」完成；說明頁不新增正式案件資料流。


### R-049｜進場／安裝去識別化實例（2026-09-10）

- `modules/help/assistant-workflow.html` v1.9 新增「客戶不接受第一個安裝時段」教學實例，所有案件、人員與附件均使用明確標示的虛構代碼。
- 實例示範首個時段失效後回到重新協調，不將單方答覆當成完成；三方同意後才提交回報並由指定審核者通過。
- 事件使用 canonical `project_id`、操作者與審核者 `employee_id`，逐步保留時間、狀態與證據，完整呈現「指派 → 執行 → 回報 → 審核／退回」而不新增正式案件資料流。


### R-050｜家具配送去識別化實例（2026-09-10）

- `modules/help/assistant-workflow.html` v1.10 新增「缺件後完成二次配送」教學實例，所有案件、人員、地址與附件均使用明確標示的虛構資料。
- 實例示範部分到貨後保留送貨單、照片與貨物位置，首次回報因缺少責任窗口、補件日期及保管確認被退回，補正並完成二次配送後才審核通過。
- 事件使用 canonical `project_id`、操作者與審核者 `employee_id`，逐步保留時間、狀態與證據，完整呈現「指派 → 執行 → 回報 → 審核／退回」而不新增正式案件資料流。


### R-051｜報價前置去識別化實例（2026-09-10）

- `modules/help/assistant-workflow.html` v1.11 新增「圖面版本衝突後重新詢價」教學實例，所有案件、人員、金額與附件均使用明確標示的虛構資料。
- 實例示範 V2／V3 混用時停止受影響項目，由設計師指定唯一有效版本並依 V3 重新詢價；首次回報因報價缺有效期限被退回，取得書面期限後才審核通過。
- 事件使用 canonical `project_id`、操作者與審核者 `employee_id`，逐步保留時間、狀態與證據，完整呈現「指派 → 執行 → 回報 → 審核／退回」而不新增正式案件資料流。


### R-052｜案場異常去識別化實例（2026-09-10）

- `modules/help/assistant-workflow.html` v1.12 新增「滲水跡象等待客戶決定」教學實例；至此四類 P0 均已有去識別化實例，所有案件、人員、地址、責任歸屬與附件均使用明確標示的虛構資料。
- 實例示範首次回報因過早判定原因、責任與唯一方案被退回，補正為已確認事實、受影響範圍、保護措施及可選方案後，等待客戶書面決定再送審。
- 事件使用 canonical `project_id`、操作者與審核者 `employee_id`，逐步保留時間、狀態與證據，完整呈現「指派 → 執行 → 回報 → 審核／退回」而不新增正式案件資料流。

### R-053｜選材與樣品交接基本流程（2026-09-10）

- `modules/help/assistant-workflow.html` v1.13 新增 P1「選材／借樣／送樣／歸還」基本流程，涵蓋需求確認、借樣登記、案件標示、送達點交、客戶決定及歸還／留樣。
- 每件樣品須保存來源、樣品編號、數量、外觀、保管位置、接收人、交接時間與照片／簽收證據；無人簽收、尚未歸還或只有客戶口頭偏好時不得標示完成。
- 流程以 canonical `project_id` 連結案件，以指派、執行及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、證據與退回原因；說明頁不新增正式資料流。

### R-054｜圖面、報價與文件版本管理基本流程（2026-09-10）

- `modules/help/assistant-workflow.html` v1.14 新增 P1 文件版本管理基本流程，涵蓋收件綁定、命名編版、差異比對、內部送審、歸檔作廢及發行回執。
- 最新收到的檔案不等於正式版；須由指定設計師或負責人確認唯一有效版本，舊版保留但標示取代關係，受影響收件人須回覆已收到及使用版次。
- 流程以 canonical `project_id` 連結案件，以指派、執行及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、版本差異、檔案、通知回執與退回原因；說明頁不新增正式資料流。

### R-055｜追加減、請款與收款前置基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.15 新增 P1 追加減與款項前置流程，涵蓋變更事實、依據蒐集、設計師核價、內審編版、客戶確認、施工／請款核對及會計收款確認。
- 助理不自行定價、折扣或承諾免費；未取得客戶書面確認不得視為同意，匯款訊息或截圖須交由會計核對入帳金額、日期及差額後才能更新收款狀態。
- 流程以 canonical `project_id` 連結案件，以指派、執行、核價及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、版本、簽認、完工／入帳證據與退回原因；說明頁不新增正式財務資料流。

### R-056｜施工照片與日誌基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.16 新增 P1 施工照片與日誌流程，涵蓋應拍清單、原始資料收集、可用性檢查、精準追問、事實日誌、命名歸檔、隱私分享及送審；至此 P1 四類事務均已有基本流程。
- 照片須綁定案件、時間、區域、工項及拍攝者，群組壓縮圖不取代原檔；無法補拍須保存原因、替代證據與核准者，日誌不得依照片推定責任或完成比例。
- 流程以 canonical `project_id` 連結案件，以指派、回報、追問及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、原始／替代證據、歸檔連結與退回原因；說明頁不改動既有上傳後端。

### R-057｜丈量與會議前後準備基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.17 新增 P2 丈量與會議準備流程，涵蓋目的範圍、預約確認、有效資料、行前檢查、現場事實、決議分類、會後交接及歸檔送審。
- 助理只負責協調與紀錄；未核准版次不得當正式依據，遮蔽或無法量測處不得猜填，提案、待確認與正式決議必須分開，尺寸可用性及對客承諾仍由指定設計師確認。
- 流程以 canonical `project_id` 連結案件，以交辦、量測、紀錄、決策及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、版次、尺寸、照片／草圖、確認回覆、紀要、待辦與退回原因；說明頁不新增丈量或會議後端。

### R-058｜驗收、缺失改善與結案交接基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.18 新增 P2 驗收與結案流程，涵蓋驗收標準、就緒檢查、現場安排、缺失建檔、改善交接、追蹤回報、複驗及文件／物品交接。
- 每筆缺失以 `defect_id` 保存位置、事實、依據與前後證據；助理不自行判責，廠商完成回報只能進入待複驗，未驗項目不得當通過，例外保留須由指定主管核准責任人與期限。
- 流程以 canonical `project_id` 連結案件，以交辦、記錄、追蹤、複驗及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、依據版次、改善證據、例外核准、簽收與退回原因；說明頁不新增驗收或結案後端。

### R-059｜保固與維修追蹤基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.19 新增 P2 保固與維修流程，涵蓋問題收件、證據蒐集、保固文件查核、內部判定、客戶同步、檢查／維修協調、處置追蹤及驗證送審。
- 每次問題以 `service_request_id` 保存客戶原始描述、位置、時間、保固依據及維修前後證據；助理不得自行承諾保固、免費或賠償，安全風險須先停用並升級，外部完成回報只能進入待驗證。
- 流程以 canonical `project_id` 連結案件，以接案、判定、追蹤、驗證及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、文件版次、費用依據、維修報告、客戶回覆及退回原因；說明頁不新增保固或維修後端。

### R-060｜跨案件一般行政協助基本流程（2026-09-11）

- `modules/help/assistant-workflow.html` v1.20 新增 P2 跨案件行政流程，涵蓋批次範圍、逐案拆分、權限檢查、有效來源、授權執行、交叉核對、分列回報及審核歸檔；至此 P2 四類事務均已有基本流程。
- 批次以 `admin_batch_id` 統整，但每個項目仍須綁定真實 canonical `project_id` 並獨立保存狀態與證據；純公司行政不借用假案號，助理不得跨案搬移敏感資料或代改價格、合約、付款及設計決議。
- 批次與逐案項目均以交辦、執行、提供、核對及審核者 `employee_id` 留痕，並保留「指派 → 執行 → 回報 → 審核／退回」的時間、狀態、來源版次、輸出、證據、交接對象與退回原因；說明頁不新增行政任務後端。

## 4. TOS 最終營運主流程

預計整併為：

接案
↓
設計
↓
報價
↓
簽約
↓
施工
↓
進度
↓
成本
↓
驗收
↓
結案
↓
獎金
↓
績效

所有階段應以單一 `project_id` 為主索引，避免跨 Sheet、GAS、前端與 LINE 系統各自建立不同案件識別。

---

## 5. 第一批盤點重點

### P0｜核心資料結構

- [x] 確認 `project-console` 目前核心案件索引：以「案號」作為跨模組 project key
- [ ] 確認案號的正式來源、生成規則與唯一性約束
- [ ] 確認 Project 主資料存在哪一張 Sheet／哪個模組
- [ ] 確認員工 ID、LINE userId、電腦綁定 ID 是否一致或可映射
- [x] 確認施工日報與 Project 的關聯欄位：`ProjectLog.ProjectName` 實際儲存 `projectId`
- [x] 確認 `ProjectSchedule` 與 `project-console` 並非單純同一資料模型：目前存在兩種排程模型

### P1｜後端模組

- [ ] CheckinSystem
- [~] ProjectSchedule（完成首輪）
- [~] project-console（完成首輪）
- [ ] core_library
- [ ] accounting-gas

### P2｜前端與入口

- [ ] LIFF 打卡
- [~] LIFF／Web 施工日報後端流程（已確認 Fast Report / UploadQueue 部分）
- [~] Web 戰情室後端聚合（已確認 HubLogic）
- [ ] Electron 客戶端

### P3｜外部服務

- [~] LINE Messaging API（已確認通知依 project → 負責人 UID 路徑）
- [ ] Dropbox
- [ ] Gemini API
- [~] Firebase（已確認通知與報告圖片搬運兩種用途）
- [~] Google Sheets（已確認 ProjectLog、UploadQueue、排程待辦池等資料表）

---

## 6. 已確認風險／技術債

### R-001｜同一 Project Key 有多種欄位名稱

目前確認至少出現：

- 案場資料：`案號`
- 排程資料：`案號`
- 日誌資料：`ProjectName`，但實際內容寫入的是 `projectId`
- 通訊／客戶資料：`專案號碼`
- 通知資料：`RelatedProjectID`

判斷：語意相同但 schema 命名不一致，後續很容易造成 mapping 錯誤。

建議：TOS canonical schema 統一採 `project_id`，舊欄位由 Adapter 層轉換，不急著一次改掉全部 Sheet 表頭。

### R-002｜存在兩套不同的排程資料模型

#### A. `project-console`

排程屬於結構化 rows：

- 以 `案號` 過濾專案
- 任務包含 `預計開始日`
- 任務包含 `預計完成日`
- 任務包含 `狀態`
- Hub 可依案號聚合排程

#### B. `ProjectSchedule`

目前是「木作排程」專用試算表模型：

- `待辦任務池` 儲存案號、工項、預期天、實際天、工班、優先、狀態、業主、地點、備註
- 主表 `2026木作排程記錄表` 使用 日期 × 人員／排程欄
- 指派時直接把 `projectId` 寫進日曆儲存格
- 實際天數再反向掃描整張排程表計算

風險：同一件「排程」在兩邊的資料表示方式不同，無法直接互換。

建議：短期不拆掉木作排程表；建立 `Schedule Adapter`，先把木作排程轉成 TOS 標準 Task/Schedule 資料，逐步讓主系統取得一致視圖。

### R-003｜`ProjectLog.ProjectName` 欄名語意錯置

`ProjectLogic._manageLogEntry_()` 建立日誌時：

`ProjectName: projectId`

也就是 `ProjectName` 欄位實際放的是「案號」，不是案場名稱。

風險：未來新程式看到欄名很容易誤用。

建議：canonical model 改為：

- `project_id`
- `project_name`

舊 Sheet `ProjectName` 先視為 legacy `project_id`。

### R-004｜開工日存在「人工值＋推導值」雙來源

`resolveProjectStartDateForSiteInfo_()`：

1. 優先使用案場表 `專案起始日`
2. 若沒有，從 ProjectLog 中木作／保護／油漆／系統工程第一則已發布日誌推導開工日

判斷：這個設計合理，但需要把來源一併保存，否則 UI 看得到日期卻不知道是人工設定還是系統推算。

TOS 建議：

- `start_date`
- `start_date_source = manual | first_site_log`

### R-005｜員工身分目前主要以 LINE UID 為主

Hub 權限與 Firebase 通知目前均會使用員工資料的：

- `userId`
- `userName`
- `權限`
- `組別`

專案負責人欄位甚至同時允許「UID 或姓名」，並支援逗號分隔多人。

風險：姓名可變更／重名，不適合作為關聯鍵。

建議：建立 TOS `employee_id`，將 LINE UID、姓名、設備 ID 都當 identity alias。

### R-006｜Firebase 同時肩負通知與媒體中繼

已確認至少有兩種用途：

1. `notifications/{employeeId}`：LINE/FB 客戶訊息的即時推送
2. 回報照片：Firebase Storage → UploadQueue → Google Drive 的非同步搬運
3. `quotations/{案號}`：結案狀態同步

判斷：Firebase 不是單一用途資料庫，而是即時事件層＋媒體中繼＋部分業務狀態鏡像。

建議：未來文件中明確區分：

- Firebase Notification Bus
- Firebase Upload Staging
- Firebase Business State Mirror

避免誤認 Firebase 是 TOS 唯一資料庫。

### R-007｜圖片上傳流程已有 Queue／Lock／Retry，應保留

`FirebaseHandler` 已具備：

- `batchId` 冪等控制
- UploadQueue
- chunk 分塊
- Script Lock
- time-based trigger
- retry / exponential backoff
- Firebase → Drive 非同步搬運

判斷：這部分已屬成熟的基礎設施，不建議重寫，只需標準化介面與監控。

---

## 7. 已確認的資料流

### F-001｜主控台專案聚合

```text
員工 userId
  ↓
Employees Cache
  ↓ 權限 / 組別 / userName
案場資料 _getAllSites_()
  ↓ project_id = 案號
  ├─ ProjectSchedule Cache[案號]
  ├─ ProjectLog[ProjectName = 案號]
  └─ Notifications[RelatedProjectID = 案號]
  ↓
Hub Project Card
```

### F-002｜客戶訊息 → 負責人即時通知

```text
LINE / Facebook Webhook
  ↓
客戶資料
  ↓ 專案號碼
案場資料[案號]
  ↓ 專案負責人
Employees[userId / userName]
  ↓
LINE UID
  ↓
Firebase notifications/{UID}
  ↓
員工生產力助手
```

無負責人時，目前會從台南／高雄且權限 >= 2 的員工中隨機挑選，最後再 fallback 到 Admin UID。

### F-003｜現場快速回報照片

```text
前端 Fast Report
  ↓ batchId / projectId / userId / photos
Firebase Storage URL
  ↓
UploadQueue
  ↓ 分塊 / Lock / Trigger / Retry
Google Drive
  ↓
既有正式處理流程
  ↓
ProjectLog
```

---

## 8. `ProjectSchedule` 首輪盤點

### 功能定位

目前它較像「木作／工班產能排程器」，而非全公司的通用 Project Schedule Engine。

### 主要 Sheet

- `2026木作排程記錄表`
- `待辦任務池`
- `System_Holidays`

### 待辦任務池欄位

1. 案號
2. 工項
3. 預期天
4. 實際天
5. 工班
6. 優先
7. 狀態
8. 業主
9. 地點
10. 備註

### 已確認狀態

- 待辦
- 排定中
- 進行中
- 元工
- 完成

注意：`元工` 疑似業務語意或 typo，後續需確認實際定義。

### 特性

- 支援國定假日與 System_Holidays
- 指派會略過假日
- 以案號填入日曆格
- 可計算人員負荷
- 可掃描排程格反推實際工作天

### TOS 判斷

此模組值得保留其 UI/操作邏輯，但底層資料應逐步由「格子是資料」轉成「Task/Schedule row 是資料；格子是視圖」。

---

## 9. `project-console` 首輪盤點

### 已確認檔案

- `ProjectLogic.js`
- `HubLogic.js`
- `FirebaseBridge.js`
- `FirebaseHandler.js`
- `CompletionMediaList.js`
- `MasterCacheWarm.js`
- `MaterialPortalAccess.js`
- `MaterialSelectionModule.js`
- `NotificationCenter.js`

### 初步角色

`project-console` 已經非常接近 TOS 的「Project Domain Backend」，它負責：

- 專案聚合
- 專案權限
- 排程讀取
- 日誌 CRUD
- 開工日推導
- 通知聚合
- Firebase 即時通知
- 現場回報圖片中繼
- 選材
- 完工媒體

因此未來不應把它當成單純的「主控台後端」，而應考慮逐步重構成 TOS Project Service。

---

## 10. 本次盤點進度

### 2026-08-24｜第一輪

已完成：

- 確認 `nephi4377/liff-checkin` 可讀取。
- 確認 `nephi4377/Backend_GAS` 可讀取。
- 建立本 `TOS_AUDIT.md`。

### 2026-08-24｜第二輪：project-console / ProjectSchedule

已完成：

- 讀取 `project-console/ProjectLogic.js`
- 讀取 `project-console/HubLogic.js`
- 讀取 `project-console/FirebaseBridge.js`
- 讀取 `project-console/FirebaseHandler.js`
- 讀取 `ProjectSchedule/CONFIG.js`
- 讀取 `ProjectSchedule/程式碼.js`
- 確認案號已經是多數專案資料的實際 join key
- 確認 ProjectLog 欄位命名錯置
- 確認 project-console 與木作 ProjectSchedule 為兩套排程模型
- 確認 Firebase 的三種角色
- 確認 Fast Report 已有 Queue / Lock / Retry / Idempotency 基礎設施

下一步：

1. 找出 `_getAllSites_()`、`_getProjectSchedulesCache_()`、`_getProjectLogsCache_()` 的實際來源 Sheet 與欄位 schema。
2. 盤點 `NotificationCenter.js`，確認通知表 schema。
3. 盤點 `CheckinSystem`，建立 Employee / LINE UID / Device identity mapping。
4. 找出 `ProjectSchedule` 的資料是否有同步進 `project-console`，或目前完全獨立。
5. 建立第一版 `TOS_CANONICAL_SCHEMA.md`。

---

## 11. 決策紀錄

### D-001｜不從零重寫

現階段策略：保留既有可用模組，優先整理資料模型與介面，再逐步重構。

原因：既有系統已具備大量可用功能，全面重寫風險高、時間成本高，且容易丟失目前已驗證過的營運邏輯。

### D-002｜TOS 採漸進式整併

優先順序：

`Project → Task / Schedule → Progress → Cost → Profit`

後續再接：

`CRM → Quote → Contract → Payment → Inspection → Bonus → KPI → BI / AI`

### D-003｜保留現有案號，建立 Canonical Project ID 層

目前不強迫修改所有既有 Sheet 欄名。

先定義：

`TOS.project_id = legacy 案號`

所有 legacy 欄位（案號、ProjectName、專案號碼、RelatedProjectID）透過 adapter 映射。

### D-004｜木作排程短期保留，長期改為 View

`ProjectSchedule` 的試算表操作方式符合現場使用習慣，短期不取消。

長期目標：

- Task/Schedule row = source of truth
- 木作年度排程表 = calendar view / planning UI

避免試算表格子本身成為唯一資料庫。
