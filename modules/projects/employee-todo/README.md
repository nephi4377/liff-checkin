# 員工待辦（Mantle UI → Sheet）

此目錄為正式 Mantle 晨霧白板 UI（與 `/employee-todo/` 同源 bundle `index-B0wpJKiW.js`），資料改走 Google Sheet。

| 項目 | 說明 |
|------|------|
| UI | 完整 Mantle：四色分區、釘選、提醒、案號、派工／工務說明、工務名單與網址、左滑刪除／置頂 |
| 資料 | `sheet-bridge.js` 攔截 `mantledb.sh`，改打 project-console `todo_*`；**不寫回 Mantle** |
| LIFF | `2007974938-U374uwei`（Endpoint：本路徑）；未登入 **`liff.login`**，清單須 **`todo_list` 成功** 才顯示 |
| 外開瀏覽器 | 同樣走 LINE Login（不再僅頂部綠鈕） |
| 工務自建 | `?role=ende`／`ayong` 可「＋ 新增工作」；來源＝`工務自建`（派自）；確認後鎖定，點「編輯」才改（僅自建） |
| 派工 | 任務卡只讀顯示「工務說明」；誰派的／限期等亦需點「編輯」才改 |
| 預覽 | `?preview=1`／`?demo=1` **僅 localhost**，示範資料不打 GAS |
| 換包標記 | `et-build=20261103a`；資產 `?v=20261103a` |

正式舊站 `/employee-todo/` 仍為 Mantle 只讀回滾；勿對 Mantle POST。
