# 2026-09-16｜會計 P0：附件／lightbox 失敗 ≠ 空

## Diff／目的

附件查詢與看單據 lightbox：API 失敗要明講「讀不到」且可再試；真的沒資料才當空。避免失敗被當成「沒附件／請先輸入」。

## 技術

- `modules/accounting/attachments.html`：失敗 UI＋再查一次
- `shared/js/accounting_lightbox.js`：失敗 throw／錯誤按鈕可再試；真空才隱藏；`?v=18`
- `ledger_review.html` 等呼叫端同步區分失敗與空
- SPEC：`SPEC/15_會計系統模組規格書.md` §2.4

## 部署

- 合入：[PR #71](https://github.com/nephi4377/liff-checkin/pull/71) → `main`
- merge commit：`54e7091`
- 雲端等價 upload：GitHub Pages build **綠燈**  
  https://github.com/nephi4377/liff-checkin/actions/runs/35044040815  
  （本機 Windows `upload.bat`／BAK 略；雲端以 Pages 為正式站）

## 驗證

- PR 內靜態／mock／GUI harness 已測失敗≠空
- 正式 LIFF／試算表端到端：請使用者抽測 `attachments.html`、審核頁「看單據」
