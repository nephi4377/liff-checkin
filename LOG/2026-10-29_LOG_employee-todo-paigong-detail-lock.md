# 2026-10-29 派工說明亦需點「編輯」才可改（TX-15 補齊）

## Diff／目的

派工任務卡鎖定與工務自建同一模式：未點「編輯」時，派工說明也不可點開編輯（先前僅鎖誰派的／限期／緊急度）。

## 技術

- `modules/projects/employee-todo/assets/index-B0wpJKiW.js`：`Ae` 的說明按鈕改 `c&&C`；鎖定時只顯示唯讀；編輯中仍顯示 `Ae`
- `et-build=20261029e`（`index.html`／`registerSW.js`／`sw.js` revision／README）

## 驗證

- [x] 本機 preview：鎖定 `button.task-detail-btn=0`；點「編輯」後出現說明按鈕／標題／限期／緊急度
- [ ] live HTML 含 `20261029e`（部署後勾）
- 截圖：`/opt/cursor/artifacts/tx15-paigong-locked-e.png`、`tx15-paigong-editing-e.png`
