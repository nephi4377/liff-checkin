# 員工待辦（Mantle UI → Sheet）

此目錄為正式 Mantle 晨霧白板 UI（與 `/employee-todo/` 同源 bundle `index-B0wpJKiW.js`），資料改走 Google Sheet。

| 項目 | 說明 |
|------|------|
| UI | 完整 Mantle：四色分區、釘選、提醒、案號、派工／工務說明、工務名單與網址、左滑刪除／置頂 |
| 資料 | `sheet-bridge.js` 攔截 `mantledb.sh`，改打 project-console `todo_*`；**不寫回 Mantle** |
| LIFF | `2007974938-U374uwei`（Endpoint：本路徑） |
| 預覽 | `?preview=1` 本機示範資料，不打 GAS |

正式舊站 `/employee-todo/` 仍為 Mantle 只讀回滾；勿對 Mantle POST。
