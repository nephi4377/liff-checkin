# 報價 context 重複 id 工具（不連 Firebase）

## 合併後、同步至雲端前（須豪哥核准）

1. `node tools/scripts/check-quotation-duplicate-ids.mjs <context.json>`
2. 若有重複：`node tools/scripts/migrate-quotation-item-ids.mjs <context.json>`（dry-run）
3. **豪哥核准** dry-run 的 `changeCount`／`changes` 後：  
   `node tools/scripts/migrate-quotation-item-ids.mjs <context.json> --write-out <out.json>`
4. 從 BudgetWeb／Firebase 匯出之 **雲端 budget context JSON**（含 `context.items` 或頂層 `items`）以 `<out.json>` 的 `items` **取代**對應陣列；上傳時**只**用 Firebase `update()` 寫回 `context/items`（或等價路徑），**勿** `set()` 整份覆蓋（保留 `is_closed` 等欄位）。寫回會**整段覆蓋** `items` 陣列，寫入期間若他人更新進度會被蓋掉——請在**無人操作報價／驗收**時執行；**寫回前先重讀**雲端 context 並比對（例如 `updated_at`、筆數、抽查 id），有變動則**中止**並重新匯出／migrate。**正式寫入雲端前再次須豪哥核准。**

**不先 migrate** 時，778 等同表多列共用 `ITEM_表名_項次` 會讓同步永遠被 id 驗證擋下。

## 只讀檢查

```bash
node tools/scripts/check-quotation-duplicate-ids.mjs path/to/budget_context.json
```

## 一次性補 id（僅真重複 id；第 1 筆不變，第 2 筆起 `_2`、`_3`）

```bash
node tools/scripts/migrate-quotation-item-ids.mjs path/to/in.json
node tools/scripts/migrate-quotation-item-ids.mjs path/to/in.json --write-out path/to/out.json
```

### 驗收進度

- **同一 id 多筆**時，雲端通常只存一筆進度；migrate 後第 1 筆 **保留原 id**，進度仍對應該列；第 2、3 筆取得 `_2`、`_3` 後各自獨立，**不會**從第 1 筆「偷」進度。
- **不會**改動「僅 id 字尾含數字、且該 id 在表內只出現一次、且未被逐列佔用邏輯撞到」的列（例如 `ITEM_1228_2` 與 `ITEM_1228_3` 各只出現一次、且前面沒有重複群組搶用 `_2` 時完全不變）。
- 若出現 `[X, X, X_2]` 等順序，逐列佔用與 **778 解析器**一致：已存在的 `X_2` 可能被改為 `X_2_2`（行為正確，非「非重複列不變」）。
- **舊版** migrate 腳本曾**全表共用一組** `usedIds`（預先掃描所有 id）；**778 解析器**是**每張工作表各一組** `sheetUsedIds`。現行 `quotation-item-id-migrate.mjs` 改為**逐列佔用**，與解析器同序。
