# 分階功能輪替清單

每輪只做**一個階段**裡的 **1～2 個功能**。做完把指針寫進 `TOS/規格巡檢回報.md`。

順序：`F1` → `F2` → … → `F8` →（回頭）。  
急訊號（剛合進 main 的大改、你點名的模組）可插隊該功能；下一輪仍回到順序。

## 怎麼選本輪功能

1. 讀回報檔「本輪階段／下一階段／上一輪已查」。
2. 在該階段挑尚未近期查過的功能；若整階都剛查過 → 進下一階。
3. 優先：最近有產品向提交、或 `SPEC` 明顯過舊／缺檔的功能。
4. 前後端成對時，本輪可各摸一邊（仍算 1～2 個功能主題）。

---

## F1｜出勤與假勤

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F1-a | 員工打卡 | `modules/attendance/checkin.html` | `CheckinSystem` | `SPEC/03_*`、`CheckinSystem/SPEC/` |
| F1-b | 假勤申請 | `leave_request.html` | Checkin 假勤邏輯 | `SPEC/02_*`、`22_假勤*` |
| F1-c | 出勤報表／儀表 | `attendance_report.html`、`approval_dashboard.html` | `Logic_Attendance*` | Checkin 報表 SPEC |
| F1-d | 個人薪資出勤頁 | `my_personal.html` | 薪資讀取 API | `SPEC/17_*`、`PAYROLL_*` |
| F1-e | 排班 | `shift_schedule.html` | 排班邏輯 | `SPEC/09_*`、排班 SPEC |

## F2｜專案主控台與日報

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F2-a | 專案主控台 | `managementconsole.html`、`spa/` | `project-console` | `SPEC/08_*`、CONSOLE_* |
| F2-b | 施工日報／回報 | `daily_report.html`、`reportV3.html` | REPORT_* | `SPEC/11_*`、`施工回報_*` |
| F2-c | 新建案場 | `NewSiteForm.html` | Dropbox／案場 | Checkin 新建案場 SPEC |
| F2-d | 客戶唯讀進度 | `client-construction-progress.html` | project-console | `SPEC/13_*` |
| F2-e | 報價審核／編輯 | `quote-*.html` | QUOTE_* | `SPEC/12_*`、`QUOTE_EDITOR_*` |

## F3｜會計與請款

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F3-a | 收支登錄／審核 | `modules/accounting/*` | `accounting-gas` | `SPEC/15_*`、accounting-gas/SPEC |
| F3-b | 請款／匯款／廠商 | `payment_request*`、`payees`、`vendor*` | VENDOR_*、PAYMENT_* | 各 VENDOR／PAYMENT SPEC |
| F3-c | 廠商名冊與狀態 | 會計相關頁 | VENDOR_REGISTER 等 | 巡檢常盯；對照前端頁 |
| F3-d | 待付款／稅金模式 | 會計頁 | accounting | `SPEC/23_*`、`24_*` |
| F3-e | 案件毛利 | `project_margin.html` | 毛利相關 | `SPEC/21.案件毛利*` |

## F4｜Hub 身分與快取

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F4-a | Hub 身分傳承 | `spa/`、`shared/js` | HUB／LIFF session | `SPEC/19_*`、CONSOLE_LIFF_* |
| F4-b | 會計主檔快取 | shared／accounting | 主檔 API | `SPEC/18_*` |
| F4-c | 打卡全域快取 | attendance | Checkin 快取 | 打卡全域快取 SPEC |

## F5｜設計工具與選材

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F5-a | 室內設計規劃工具 | `modules/InteriorDesigned` | 少依賴後端 | `SPEC/04_*` |
| F5-b | 選材／Firebase | designer-material-selection | Firebase 橋 | `SPEC/選材*` |
| F5-c | 快速報價 | 報價相關 | — | `SPEC/14_*` |
| F5-d | 窗簾估價 | 相關模組 | — | `SPEC/16_*` |
| F5-e | SketchUp／渲染工作室 | 相關頁 | accounting | `SPEC/23_SKETCHUP*` |

## F6｜商店與對外

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F6-a | 官網商店訂單 | `modules/shop` | `shop-orders` | `SPEC/24_官網商店*`、shop-orders/SPEC |
| F6-b | 電子簽署 | `esign-*.html` | ESIGN_* | `ESIGN_*` |
| F6-c | 客戶財務入口 | `customer-finance*` | CUSTOMER_PORTAL | accounting-gas 對應 SPEC |

## F7｜訊息與社群工作室

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F7-a | LINE／訊息整合 | — | LINE_SPEC、AgentInbox | project-console LINE_* |
| F7-b | FB Messenger | — | FB_MESSENGER_* | `SPEC/10_*` |
| F7-c | FB 貼文／Reels 工作室 | 相關頁 | FbPostStudio 等 | `SPEC/21_FB_*`、`22_FB_*` |

## F8｜全景、字典與憲法

| 功能 ID | 白話名稱 | 前端大致位置 | 後端大致位置 | 既有 SPEC 線索 |
|---------|----------|--------------|--------------|----------------|
| F8-a | 全專案大綱／全景 | — | — | `全專案系統大綱`、`07_全量*` |
| F8-b | 全域資料字典 | — | Sheets 欄位 | `專案全域資料字典`、SHEET_COLUMN_MAP |
| F8-c | 開發憲法／名詞對照 | — | — | `00_開發憲法`、`專有名詞白話對照` |
| F8-d | 助理工作流 | 相關頁 | — | `助理工作流*` |

---

## 階段完成定義

某功能算「本輪完成」當且僅當：

- 已讀關鍵程式（不是只讀舊 SPEC），且
- SPEC 已新建或升級，或確認已對齊並寫進回報，且
- **交叉出錯**≥2 情境、**延時等級**、**可改進**≥1 已寫進回報（見 `檢查維度.md`），且
- 若有 B0／B1，已寫進回報並已發 Slack `#程式撰寫`（或註明未送出原因）。
