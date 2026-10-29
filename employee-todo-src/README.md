# 員工待辦／派工（SEC-1）

## 正式站現況（2026-10-29）

- **`/employee-todo/`**：PR #235 Mantle 回滾（`index-B0wpJKiW.js`），**勿** build 覆蓋、**本 PR 不加轉址**。
- **SEC-1**：獨立 LIFF app（與主控台 LIFF `7yKM9EqL` 分開），Endpoint  
  `https://info.tanxin.space/modules/projects/employee-todo/`

### LIFF ID（待 Nephi 建立）

在 `src/config.js` 設定 `EMPLOYEE_TODO_LIFF_ID`（同 channel `2007974938-*`）。  
留空時頁面顯示設定說明，不呼叫 `liff.init`。

建置輸出：`modules/projects/employee-todo/`（Vite `base` 同上 path）。

## 開發

```bash
npm ci
npm test
npm run build          # 不寫入 repo 根 /employee-todo/
npm run test:e2e
npm run migration:plan
```

預覽：`?preview=1`（**不**對 GAS 寫入；僅 UI  smoke）。

## 資料切換

Mantle room `yang-employee-todo-v2-1792379200` 可能比 Sheet 新；切換前見 `scripts/mantle-to-sheet-migration.mjs`。
