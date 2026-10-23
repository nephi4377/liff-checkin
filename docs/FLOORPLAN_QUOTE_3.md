# FLOORPLAN-QUOTE-3：寫回安全閘

## 行為

1. **寫回前重讀**：用戶確認後、Firebase `update` 前再次讀取雲端；比對開始同步時快照的 `itemsContentHash`（全表 items 依 id 排序後之完整欄位 JSON hash：id／名稱／規格／數量／單位／單價／區域／進度／驗收等）與 `last_updated`。任一不同則中止，不寫入。
2. **lpPreview**：`BudgetWeb_Standalone.html?lpPreview=1` 禁用同步按鈕，且 `allowProductionSync: false` 雙重阻擋。
3. **同步前 id 檢查**：強制 `runLocalQuotationIdDuplicateCheck`（等同 CLI check，不執行 migrate）。

## 程式位置

- `LP_budgetweb_cloud_sync.js` — 指紋、id 檢查、baseline 比對
- `LP_budgetweb_firebase_sync.js` — 同步流程
- `tools/BudgetWeb_Standalone.html` — UI 閘控

## 預覽（raw.githack.com，路徑須含 `.html`）

釘選 SHA：`921fa8808297b56befa56251a4b99e39f6f53db8`（與 `LP_preview_hosts.js` 同步）

- LayoutPlanner：  
  https://raw.githack.com/nephi4377/liff-checkin/921fa8808297b56befa56251a4b99e39f6f53db8/modules/InteriorDesigned/LP_LayoutPlanner.html?lpPreview=1
- BudgetWeb：  
  https://raw.githack.com/nephi4377/liff-checkin/921fa8808297b56befa56251a4b99e39f6f53db8/tools/BudgetWeb_Standalone.html?lpPreview=1
