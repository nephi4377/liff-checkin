# 報價 context 重複 id 工具（不連 Firebase）

## 只讀檢查

```bash
node tools/scripts/check-quotation-duplicate-ids.mjs path/to/budget_context.json
```

## 一次性補 id（須豪哥核准後才用於正式資料）

```bash
# dry-run（預設）
node tools/scripts/migrate-quotation-item-ids.mjs path/to/budget_context.json

# 產出新檔（仍不寫雲端）
node tools/scripts/migrate-quotation-item-ids.mjs path/to/in.json --write-out path/to/out.json
```

### 驗收進度風險

- 若三筆工項曾共用同一個 `id`，驗收進度只會綁在 Firebase 該 id 的**一筆**上。
- 補 `_2`、`_3` 後，**第 1 筆 id 不變**可保留進度；後續筆為新 id，進度不會自動複製。
- 不丟進度做法：先匯出雲端 context，用名稱+規格人工對照，將 `completion_percent` / `verification` 寫入新 id 後再上傳（勿用名稱備援自動合併）。
