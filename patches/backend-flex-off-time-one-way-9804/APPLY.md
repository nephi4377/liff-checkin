# 手動套用指引

## 1. `CheckinSystem/Logic_AttendanceReport.js` → `_computeReportLateEarly_`

### 尋找舊邏輯（雙向彈性，須移除）

在 `_computeReportLateEarly_` 內搜尋下列任一寫法：

```javascript
// 舊：早到可提早下班
const offset = checkInMins - shiftStartMins;
const expectedOffMins = shiftEndMins + offset;
```

或等價的 `expectedOff = shiftEnd + (checkIn - shiftStart)`（未 clamp 到 `[0, flex]`）。

### 改為（單向彈性）

將「預計下班」與「早退」計算改為與 `snippets/Logic_AttendanceReport.js` 一致：

- `lateWithinFlex = Math.max(0, Math.min(flex, checkInMins - shiftStartMins))`
- `expectedOffMins = shiftEndMins + lateWithinFlex`
- `earlyMinutes = Math.max(0, expectedOffMins - checkOutMins)`（有下班卡時）
- `lateMinutes = Math.max(0, checkInMins - shiftStartMins - flex)`（**維持不變**）

若函式簽名為 `(checkInStr, checkOutStr, shiftStart, shiftEnd, flexibleMinutes)`，請先轉分鐘再算（沿用既有 `_parseTimeToMinutes_` 或等價 helper）。

### 回傳格式

維持既有 `{ lateMinutes, earlyMinutes }`（或專案慣用欄位名），勿改 `get_report` 契約。

---

## 2. `CheckinSystem/Logic_Checkin.js` → 打卡訊息「預計下班：HH:mm」

### 尋找

搜尋 `預計下班` 或組裝上班打卡成功 `message` 的區塊（常見在第一次「上班」打卡成功後）。

### 改為

使用與報表相同的公式（見 `snippets/Logic_Checkin.js`）：

```javascript
const expectedOffStr = _formatExpectedOffTimeForCheckin_(checkInTimeStr, shiftStart, shiftEnd, flexibleMinutes);
// message 內維持：預計下班：HH:mm
```

建議將 `_formatExpectedOffTimeForCheckin_` 放在 `Logic_Checkin.js` 或抽出至 `TimeUtils.js`，但**公式須與** `_computeReportLateEarly_` **完全一致**。

---

## 3. 可選：抽出共用 helper

若兩檔重複邏輯，可新增 `CheckinSystem/TimeFlexUtils.js`（內容見 `snippets/TimeFlexUtils.js`），並在 `appsscript.json` 加入該檔（若專案慣例需要）。

---

## 4. SPEC

複製 `SPEC-snippet.md` 內容至 `CheckinSystem/SPEC/出勤儀表板與報表規格分析V2.md` §2.5.6（或新增小節「單向彈性下班 2026-07-31」）。
