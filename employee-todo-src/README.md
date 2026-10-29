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

SEC-1 stub／單元測試與 LIFF redirect 測試。**`npm run build` 只輸出到 `dist-stub/`**，不會覆寫正式 Mantle 產物。

```bash
npm ci
npm test
npm run test:e2e   # 測 modules/projects/employee-todo/（Mantle＋bridge）
```

預覽：`?preview=1`（bridge 示範資料，不打 GAS）。
