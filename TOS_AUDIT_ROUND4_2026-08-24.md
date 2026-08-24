# TOS 系統盤點｜第四輪

日期：2026-08-24

## 本輪範圍

1. CheckinSystem 案場主資料來源
2. Employee / LINE UID / PC Name identity mapping
3. Project 與 accounting-gas / project-console 的同步邊界

---

## 1. Project 主資料來源已確認

`CheckinSystem/SiteLogic.js` 的 `_accessSiteSheet_()` 明確從 `CoreLib.getCheckinSpreadsheet()` 取得：

- `CONST.SHEET.SITE`
- fallback：`案場資料`

因此目前可判定：

**CheckinSystem 的「案場資料」Sheet 是現有 Project Master 的主要 source of truth。**

`_manageSite_()` 新增或更新案場時：

- 優先以 `案號` 尋找現有資料
- 找不到案號時才 fallback `siteName`
- 地址不可重複
- 地址變更會重新 Geocoding
- 寫入完成後清除 CheckinSystem 案場 cache
- 通知 `project-console` 清除案場 cache
- 通知 `accounting-gas` 清除 margin site map cache

### TOS 判斷

現階段不另建 Project Master Sheet。

TOS canonical Project 應先以 `CheckinSystem/案場資料` 為來源，透過 adapter 正規化為：

- `project_id`
- `project_name`
- `address`
- `latitude`
- `longitude`
- `owner_name`
- `owner_phone`
- `region`
- `responsible_employee_ids`
- `status`
- `start_date`
- `expected_finish_date`
- `closed_at`

---

## 2. Project Master 已具備跨服務 cache invalidation

案場資料寫入後，CheckinSystem 會主動通知：

```text
CheckinSystem / 案場資料
  ↓ save
_clearSiteCaches_()
  ↓
project-console?page=invalidate_site_caches
  ↓
accounting-gas action=invalidate_margin_site_map
```

這代表目前三套 GAS 並非完全孤立，而是已存在跨服務同步契約。

### 風險 R-008

目前同步方式是「HTTP 通知對方清 cache」，而不是 event log / message bus。

若通知失敗：

- 主資料已寫成功
- 下游 cache 可能仍是舊資料

目前程式採 warning、不 rollback，屬 eventual consistency。

### 建議

短期保留；未來增加：

- cache version / updated_at
- reconciliation job
- sync audit log

不必現在導入真正 message queue。

---

## 3. 電腦端 Identity Mapping 首輪確認

`CheckinSystem/Logic_Productivity.js` 中，電腦端生產力報告主要欄位包含：

- `userId`
- `userName`
- `pcName`

若上傳資料沒有 `userId` 但有 `pcName`，系統會呼叫：

`_getEmployeeByPcName_(pcName)`

再補回：

- employee `userId`
- employee `userName`

因此目前可以判定：

**pcName 是 Employee identity alias，而不是主身份鍵。**

現有主鍵仍主要是 `userId`；從其他模組使用方式看，這個 `userId` 實際上通常就是 LINE UID。

### TOS Identity 建議

```text
Employee
  employee_id         ← 未來 canonical internal id
  line_user_id        ← 現有 userId
  user_name
  pc_names[]          ← identity aliases
  group
  permission
  status
```

短期不急著新增 employee_id 實體欄位，可先建立 adapter：

`employee_id = legacy userId`

等資料模型穩定後再切換真正 immutable internal id。

---

## 4. 生產力報告資料模型

`生產力報告` Sheet 目前包含：

- 上傳時間
- userId
- 員工姓名
- 報告日期
- 工作(分鐘)
- 休閒(分鐘)
- 其他(分鐘)
- 閒置(分鐘)
- 音樂(分鐘)
- 午休(分鐘)
- 生產力指數
- 電腦名稱
- 詳細記錄
- 未分類關鍵字

更新／去重鍵目前接近：

`userId + 報告日期 + pcName`

### TOS 判斷

未來 KPI 不應直接以「生產力指數」作為績效唯一依據。

它較適合成為：

`EmployeeActivity / ProductivitySignal`

再與：

- Task 完成率
- 專案準時率
- 毛利
- 客訴
- 工程缺失
- 出勤

共同形成 KPI。

---

## 5. 本輪新增決策

### D-008｜Project Master 沿用 CheckinSystem「案場資料」

現階段不另外建立 Project 主表。

由 TOS Adapter 將「案場資料」正規化成 canonical Project。

### D-009｜Identity 暫時以 legacy userId 為 canonical employee key

短期：

`employee_id = userId`

並將：

- pcName
- userName
- future device id

視為 alias。

長期再導入真正 immutable `employee_id`。

### D-010｜跨 GAS 同步採漸進式強化，不立即導入 message queue

保留目前 HTTP cache invalidation。

優先增加 reconciliation / sync audit，再視規模決定是否需要 event bus。

---

## 6. 下一輪

1. 找出 `_getEmployeeByPcName_()` 實際儲存位置與 PC mapping schema。
2. 盤 `CheckinSystem/HubPresenceLogic.js`，確認 presence / online 狀態模型。
3. 盤 `CheckinSystem/WebApp.js` routes，建立 Checkin API inventory。
4. 盤 `accounting-gas`，確認 Project → Quote → Cost → Margin 的 join key。
5. 開始建立 `TOS_CANONICAL_SCHEMA.md`。
