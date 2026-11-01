# 2026-10-29 派工 Mantle 整包 → modules + Sheet 上線

## Diff／目的

正式站 `modules/projects/employee-todo/?role=paigong` 改為與 `/employee-todo/` 相同 Mantle 晨霧 UI；資料走 Sheet `dispatch_tasks`（`sheet-bridge.js`），不寫 Mantle。

## 技術

- PR：liff-checkin #237（`8a499d7`＋本 LOG／e2e 修正）
- 產物：`modules/projects/employee-todo/`（`index-B0wpJKiW.js`、`sheet-bridge.js`、LIFF `2007974938-U374uwei`）
- 後端加速：Backend_GAS #261（list 快取／讀略過排版）
- 備份：Git 分支／PR；舊 `/employee-todo/` 保留只讀；Sheet 既有 `dispatch_tasks_backup_20261029_1135`

## 驗證

- [x] CI employee-todo e2e 綠
- [x] merge main 後 live 資產含 `sheet-bridge.js`／`index-B0wpJKiW`（Pages 2026-10-29 06:44Z）
- [x] 正式 URL 截圖＝Mantle 版面（非 LINE Login 400）→ media/live-modules-paigong-mantle.png
- 線上：main `34f9dde`；舊 `/employee-todo/` 仍 Mantle 只讀
