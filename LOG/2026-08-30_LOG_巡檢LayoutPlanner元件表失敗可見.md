# 2026-08-30 LayoutPlanner：元件表讀失敗不裝成還沒載入

## Diff／目的

設計師開平面規劃工具時，元件表若讀不到，舊畫面分類區仍寫「載入元件後顯示分類」、元件頁空白，失敗提示約 8 秒就消失。改成設定頁與元件頁都留人話＋再試；成功前不先清空已有元件。

## 技術

- `modules/InteriorDesigned/LP_LayoutPlanner.js`：`showComponentSheetLoadError_`；`loadFromSheets` 先寫入暫存再一次替換；`fetch` 檢查 HTTP 狀態、約 10 秒中止
- SPEC：`04_互動式室內設計規劃工具規格書.md` §2.3、§3.3

未改計價規則。不上正式（巡檢 P1）。

## 驗證

- 開 LayoutPlanner：元件表成功時分類與元件列表仍有內容
- 模擬讀失敗：分類區與元件頁看到「元件表讀不到」與「再試一次」，不可只剩「載入元件後顯示分類」
