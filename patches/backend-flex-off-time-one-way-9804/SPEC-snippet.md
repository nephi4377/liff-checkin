## 2.5.6 單向彈性下班（2026-07-31）

> 與 CODING `SPEC/打卡彈性下班政策.md`、`shared/js/utils.js` 對齊。

| 項目 | 規則 |
|------|------|
| 最早下班 | 不得早於該員 `shiftEnd`（預設 17:30） |
| 彈性往後 | 上班遲到且在 `flexibleMinutes` 內 → 下班時間等量往後延 |
| 早到 | 不可提早下班（舊雙向彈性已廢止） |

```
lateWithinFlex = max(0, min(flex, checkIn - shiftStart))
expectedOff    = shiftEnd + lateWithinFlex
earlyMinutes   = max(0, expectedOff - checkOut)
lateMinutes    = max(0, checkIn - shiftStart - flex)
```

| 白話 | 程式對照 |
|------|----------|
| 報表遲早退 | `Logic_AttendanceReport.js` → `_computeReportLateEarly_` |
| 打卡預計下班 | `Logic_Checkin.js` → 訊息 `預計下班：HH:mm` |
| 共用公式（可選） | `TimeFlexUtils.js` |

**範例**（08:30～17:30、彈性 30）：07:53 到 → 17:30；09:00 到 → 18:00；07:53 到、17:10 走 → 早退 20 分。
