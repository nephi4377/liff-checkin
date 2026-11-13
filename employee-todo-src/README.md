# 員工待辦／派工

## 正式站（2026-10-29 起）

| 路徑 | 說明 |
|------|------|
| **`/modules/projects/employee-todo/`** | **正式**：Mantle 晨霧 UI（`index-B0wpJKiW.js`）＋`sheet-bridge.js`→Sheet `todo_*` |
| `/employee-todo/` | Mantle 只讀回滾（#235）；**勿寫 Mantle**、勿 build 覆蓋 |

### LIFF

`EMPLOYEE_TODO_LIFF_ID` = `2007974938-U374uwei`  
Endpoint：`https://info.tanxin.space/modules/projects/employee-todo/`

## 本目錄（employee-todo-src）

**不上正式站**：正式 UI 是 `modules/projects/employee-todo/` 的 Mantle bundle（`index-B0wpJKiW.js`）＋ `sheet-bridge.js`。本目錄 React stub 僅供單元／e2e；`npm run build` 只輸出 `dist-stub/`，**不會**覆寫 Mantle 產物。

| 會跟著 PR 動的 | 不會上線 |
| --- | --- |
| `scripts/rebuild-production-pwa.mjs`、`npm run build:pwa` | `src/App.jsx`、`src/liffAuth.js`（維持 main 與正式無關） |
| `src/localDev.js`（localhost 預覽規則測試） | `npm run build` → dist-stub |

目前換包標記：**`et-build=20261113d381`**（與 `modules/projects/employee-todo/index.html` 一致）。

```bash
npm ci
npm test
npm run test:e2e   # 測 modules/projects/employee-todo/（Mantle＋bridge）
npm run build:pwa  # 重算 sw.js precache 與 index ?v=（不改 Mantle bundle）
```

預覽：`?preview=1` 或 `?demo=1`（**僅 localhost**；bridge 示範資料，不打 GAS）。
