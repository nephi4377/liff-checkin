# 派工清單前端 — Google Sheets API 切換（DISPATCH-FE-1）

> 後端規格：`Backend_GAS` `docs/employee-todo-rebuild.md`（PR #171 已合併）  
> 前端源碼目錄：`employee-todo-app/`（build 輸出 → `employee-todo/` 靜態站）

## 現況（本 PR 前）

- `info.tanxin.space/employee-todo/` 僅有 **Vite build 產物**（`employee-todo/assets/*.js`），無 TypeScript 源碼。
- 資料同步：**MantleDB** 整份 `room` GET/POST + **12 秒輪詢**（見舊 bundle 內 `mantledb.sh`）。

## 本 PR 做法

| 項目 | 說明 |
|------|------|
| 源碼 | 自 [tanxin02/employee-todo](https://github.com/tanxin02/employee-todo) 同步至 `employee-todo-app/` |
| API | `src/api/todoGasClient.ts` → project-console `doPost`：`todo_list`／`todo_add`／`todo_update`／`todo_delete`／`todo_reorder` |
| board | `?role=paigong` → `paigong`；`ende` → `ende`；`ayong` → `ayong`（與 `resolvePersona()` 一致） |
| 寫入 | 各 mutation 帶 **`liff_id_token`**（`useLiff().getIdToken()`）；無 token 時寫入失敗、狀態列顯示錯誤 |
| 輪詢 | **移除** 12s poll；改為 **啟動拉一次** + **回到前景／online** 再 `todo_list` |
| MantleDB | **移除** `pullCloud`/`pushCloud` room 同步 |

## 本機預覽（不影響 info.tanxin.space）

```bash
cd employee-todo-app
npm install
# 僅 UI／串 API 形狀（後端需已部署 todo_* 且開 dev_bypass 或正式 LIFF）
VITE_TODO_DEV_BYPASS=true VITE_LIFF_ID= npm run dev
```

建置靜態站（輸出到上一層 `employee-todo/`）：

```bash
cd employee-todo-app
npm run build
cd ..
npx --yes serve@14 -l 8080 .
# http://127.0.0.1:8080/employee-todo/?role=paigong
```

可選環境變數（`.env.local`，勿 commit）：

| 變數 | 用途 |
|------|------|
| `VITE_PROJECT_CONSOLE_URL` | 覆寫 GAS `/exec`（預設同 `shared/js/config.js`） |
| `VITE_LIFF_ID` | LINE LIFF（寫入必填，除非 dev bypass） |
| `VITE_TODO_DEV_BYPASS=true` | 本機對齊 project-console dev_bypass |
| `VITE_TODO_DEV_USER_ID` | 搭配 bypass 的員工 userId |

## 正式切換前（勿在本 PR 執行）

1. **後端**：確認 project-console 已部署含 PR #171 的版本；`todo_list` 對三個 board 回傳與前端 `AppState` 相容的 JSON。
2. **資料 migration**：在 GAS 以 **`migrateEmployeeTodoFromMantle_`**（或 rebuild 文件指定腳本）把 Mantle room 匯入試算表；**本 agent 不執行**、不動正式 Sheet。
3. **LIFF**：建立／確認派工清單 LIFF endpoint，`VITE_LIFF_ID` 寫入 build 環境（不放進 repo）。
4. **CODING Pages**：`employee-todo-app` build → 將 `employee-todo/` 目錄隨 CODING repo 發布（與現行 `info.tanxin.space/employee-todo/` 路徑相同）。
5. **驗收**：派工／恩德／阿勇三 URL 各測新增、勾選、排序、刪除；兩台裝置同 board 資料一致（無需 12s 等輪詢）。
6. **Mantle**：正式切換並驗收後，可停用舊 namespace（文件記錄即可，非本 PR 範圍）。

## 測試

```bash
cd employee-todo-app && npm run test:unit
cd modules/InteriorDesigned && npm test   # 確保未影響 LayoutPlanner
```

## 風險

- 本環境無法讀取 private `Backend_GAS`；若實際 JSON 欄位名與 `todoGasClient` 假設不同，需對照 `employee-todo-rebuild.md` 微調。
- 派工頁若未設定 LIFF，**寫入**會失敗（讀取 `todo_list` 仍可能成功，依後端權限）。
