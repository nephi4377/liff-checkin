# 員工待辦（Mantle UI → Sheet）

此目錄為正式 Mantle 晨霧白板 UI（與 `/employee-todo/` 同源 bundle `index-B0wpJKiW.js`），資料改走 Google Sheet。

| 項目 | 說明 |
|------|------|
| UI | 完整 Mantle：四色分區、釘選、提醒、案號、派工／工務說明、工務名單與網址、左滑刪除／置頂 |
| 資料 | `sheet-bridge.js` 攔截 `mantledb.sh`，改打 project-console `todo_*`；**不寫回 Mantle** |
| LIFF | `2007974938-U374uwei`（Endpoint：本路徑） |
| 外開瀏覽器 | **不**自動 `liff.login`（避免整頁被 LINE Login 蓋掉）；改顯示「用 LINE 登入同步試算表」按鈕。LINE App 內仍可自動登入 |
| 預覽 | `?preview=1` 本機示範資料，不打 GAS |
| 換包標記 | `index.html` meta `et-build=20261029c`；資產帶 `?v=20261029c` |

正式舊站 `/employee-todo/` 仍為 Mantle 只讀回滾；勿對 Mantle POST。
