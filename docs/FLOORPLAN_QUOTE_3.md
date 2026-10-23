# FLOORPLAN-QUOTE-3：寫回安全閘

## 行為

1. **寫回前重讀**：`runBudgetWebQuotationCloudSync` 在用戶確認後、Firebase `update` 前再次讀取雲端；比對 `last_updated` 與工項進度指紋（id + completion + verification）。有變動則中止，不寫入。
2. **lpPreview**：`BudgetWeb_Standalone.html?lpPreview=1` 禁用同步按鈕，且 `allowProductionSync: false` 雙重阻擋。
3. **同步前 id 檢查**：強制 `runLocalQuotationIdDuplicateCheck`（等同 CLI check，不執行 migrate）。

## 程式位置

- `LP_budgetweb_cloud_sync.js` — 指紋、id 檢查、baseline 比對
- `LP_budgetweb_firebase_sync.js` — 同步流程
- `tools/BudgetWeb_Standalone.html` — UI 閘控

## 預覽（raw.githack.com，路徑須含 `.html`）

釘選 SHA 見 `LP_preview_hosts.js` 的 `PINNED_GITHACK_COMMIT`（與本分支最新 push 同步）。
