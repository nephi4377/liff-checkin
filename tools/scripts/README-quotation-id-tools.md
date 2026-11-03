# 報價 context 重複 id（不連 Firebase）

本 repo **main** 提供可 `import` 的模組 `tools/quotation-item-id-migrate.mjs`（`migrateDuplicateItemIdsOnly`、`findDuplicateItemIds`），邏輯與 `tools/budget-quote-parser-lib.js` 的 `assignUniqueItemIdForSheet` 一致。**尚無** `tools/scripts/check-quotation-duplicate-ids.mjs`／`migrate-quotation-item-ids.mjs` CLI；日後若 #212 合併會另補。

## 程式用法（dry-run）

```javascript
import {
    migrateDuplicateItemIdsOnly,
    findDuplicateItemIds,
} from '../quotation-item-id-migrate.mjs';

const { items, changes } = migrateDuplicateItemIdsOnly(contextItems);
console.log(findDuplicateItemIds(items), changes);
```

正式寫入雲端前須豪哥核准；寫回 `items` 時用 Firebase `update()` 局部更新，勿 `set()` 整份覆蓋（保留 `is_closed` 等欄位）。寫入期間若他人更新進度會被蓋掉——請在**無人操作報價／驗收**時執行；**寫回前先重讀**雲端 context 並比對（例如 `updated_at`、筆數、抽查 id），有變動則**中止**並重新匯出／migrate。

**不先處理重複 id** 時，778 等同表多列共用 `ITEM_表名_項次` 會讓同步永遠被 id 驗證擋下。

### 驗收進度

- **同一 id 多筆**時，雲端通常只存一筆進度；migrate 後第 1 筆 **保留原 id**，進度仍對應該列；第 2、3 筆取得 `_2`、`_3` 後各自獨立，**不會**從第 1 筆「偷」進度。
- **不會**改動「僅 id 字尾含數字、且該 id 在表內只出現一次」的列（例如 `ITEM_1228_2` 與 `ITEM_1228_3` 各只出現一次時完全不變）。
- 若出現 `[X, X, X_2]` 等順序，**778 解析器**與 migrate 會先記住本表各列原始 id；補重複後綴時**跳過**已規劃的 id，故第 3 列 **`ITEM_X_2` 維持不變**，第 2 列重複改為 `ITEM_X_3`（不會再誤改成 `ITEM_X_2_2`）。
- **778 解析器**與 migrate 皆為**每張工作表／整份 items 各一組** `usedIds`，**逐列佔用**；舊版 migrate 曾全表預掃一組 `usedIds`，已淘汰。
