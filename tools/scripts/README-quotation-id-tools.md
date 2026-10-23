# 報價 context 重複 id 工具（不連 Firebase）

## 合併後、同步至雲端前（須豪哥核准）

1. `node tools/scripts/check-quotation-duplicate-ids.mjs <context.json>`
2. 若有重複：`node tools/scripts/migrate-quotation-item-ids.mjs <context.json>`（dry-run）
3. 確認無誤後：`--write-out` 產出新檔，再匯入 BudgetWeb／上傳

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
- **不會**改動僅 id 字尾含數字、但並非重複群組的列（例如 `ITEM_1228_2` 與 `ITEM_1228_3` 若各只出現一次則完全不變）。
