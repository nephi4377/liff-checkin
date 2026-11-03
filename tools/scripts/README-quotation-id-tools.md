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
- **不會**改動「僅 id 字尾含數字、且該 id 在表內只出現一次」的列（例如 `ITEM_1228_2` 與 `ITEM_1228_3` 各只出現一次時完全不變）。
- 若出現 `[X, X, X_2]` 等順序，**778 解析器**與 migrate 會先記住本表各列原始 id；補重複後綴時**跳過**已規劃的 id，故第 3 列 **`ITEM_X_2` 維持不變**，第 2 列重複改為 `ITEM_X_3`（不會再誤改成 `ITEM_X_2_2`）。
- **778 解析器**與 migrate 皆為**每張工作表／整份 items 各一組** `usedIds`，**逐列佔用**；舊版 migrate 曾全表預掃一組 `usedIds`，已淘汰。
