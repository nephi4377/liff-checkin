# Backend patch：單向彈性下班（cursor/flex-off-time-one-way-9804）

> Cloud Agent 無法 clone `nephi4377/Backend_GAS`（404／無權限）。本目錄提供**可手動套用**的變更與驗證腳本。  
> 政策與範例見 `SPEC/打卡彈性下班政策.md`；前端對照 `shared/js/utils.js`。

## 套用步驟

1. 在本機 `backend/` 倉庫 checkout `main`（或從本 branch 開 `cursor/flex-off-time-one-way-9804`）。
2. 依 `APPLY.md` 修改 `CheckinSystem/Logic_AttendanceReport.js`、`CheckinSystem/Logic_Checkin.js`。
3. 執行驗證：
   ```bash
   node patches/backend-flex-off-time-one-way-9804/verify-algorithm.mjs
   ```
4. 更新 `CheckinSystem/SPEC/出勤儀表板與報表規格分析V2.md` §2.5.6（見 `SPEC-snippet.md`）。
5. `backend/upload.bat`（或 `NONINTERACTIVE=1 backend/upload.bat`）→ 確認 [Backend_GAS Actions](https://github.com/nephi4377/Backend_GAS/actions) 綠燈。

## 演算法（單向）

```
lateWithinFlex = max(0, min(flex, checkIn - shiftStart))
expectedOff    = shiftEnd + lateWithinFlex
earlyMinutes   = max(0, expectedOff - checkOut)
lateMinutes    = max(0, checkIn - shiftStart - flex)   // 不變
```

## 驗收案例（08:30～17:30、彈性 30 分）

| 上班 | 預計下班 | 17:10 下班 | 早退 |
|------|----------|------------|------|
| 07:53 | 17:30 | — | 20 |
| 09:00 | 18:00 | — | 0 |
