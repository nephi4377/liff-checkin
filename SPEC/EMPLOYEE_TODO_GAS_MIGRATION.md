# 派工清單前端 — Google Sheets API 切換（DISPATCH-FE-1 / FE-2 / FE-3）

> 後端規格：`Backend_GAS` `docs/employee-todo-rebuild.md`（PR #171 已合併）  
> 前端源碼目錄：`employee-todo-app/`（build 輸出 → `employee-todo/` 靜態站）

## ⚠️ 合併 = 上線（必讀）

**將本 PR 合進 `main` 後，CODING repo 會隨既有 GitHub Pages 流程發布 `employee-todo/` 到正式站 `https://info.tanxin.space/employee-todo/`。**

### 合併前檢查清單（Nephi／TINA）

- [ ] **Nephi 明確核准**合併本 PR（合併 = 發布 `employee-todo/` 至 `info.tanxin.space`）。
- [ ] **後端 `todo_*` 已部署**且回應形狀與本文件一致（頂層欄位）。
- [ ] **已執行 GAS `migrateEmployeeTodoFromMantle_`**（由 **Nephi 核准後**在後端執行；**本 agent 不執行**、不動正式 Sheet）。
- [ ] **LIFF**：`employee-todo-app/.env.production` 的 `VITE_LIFF_ID` 與 LINE Developers 上 **Endpoint URL** `https://info.tanxin.space/employee-todo/` 的 LIFF 一致（目前與 `shared/js/config.js` `PROJECT_CONSOLE_LIFF_ID` 同步；若需獨立派工 LIFF 請 Nephi 確認後改值並 rebuild）。
- [ ] **看板策略**：paigong／ende／ayong **共用或分開試算表／board** — **待 Nephi 決定**（前端已依 `?role=` 送不同 `board` 參數）。

本 agent **不執行** merge、deploy、任何 migration（含 `migrateEmployeeTodoFromMantle_`、`migrateAccountingRuntimeStateOnce`、`importOwnerTodoBoardFromLegacyTabs_`）。

## 現況（本 PR 前）

- `info.tanxin.space/employee-todo/` 僅有 **Vite build 產物**（`employee-todo/assets/*.js`），無 TypeScript 源碼。
- 舊版資料同步：**MantleDB** 整份 `room` GET/POST + **12 秒輪詢**。

## 本 PR 做法

| 項目 | 說明 |
|------|------|
| 源碼 | 自 [tanxin02/employee-todo](https://github.com/tanxin02/employee-todo) 同步至 `employee-todo-app/` |
| API | `src/api/todoGasClient.ts` → project-console `doPost`：`todo_list`／`todo_add`／`todo_update`／`todo_delete`／`todo_reorder` |
| 回應形狀 | **頂層 JSON 欄位**（`success`／`message` 外，`tasks`、`workers` 等與 `success: true` 同層）；**不**使用 `data` 巢狀包裝 |
| `todo_list` | 與寫入相同，帶 **`liff_id_token`**（或 dev_bypass） |
| `todo_reorder` | 請求體 **`orders: [{ id, order }]`**（非 `orderedIds`） |
| officeTasks | **GAS 不再寫入**；辦公室待辦僅本地 state（或 Mantle 後備整包 room 時一併同步） |
| board | `?role=paigong` → `paigong`；`ende` → `ende`；`ayong` → `ayong` |
| 輪詢 | GAS 模式：**移除** 12s poll；**啟動拉一次** + **回到前景／online** 再 `todo_list` |
| MantleDB | **後備**：`src/sync/config.ts` 常數 `TODO_SYNC_BACKEND`（預設 `'gas'`）；改 `'mantle'` 可恢復 room GET/POST + 12s 輪詢 |
| 金鑰 | 前端 **不放** OpenAI／其他 API 金鑰；「AI 整理」僅本機規則 |
| LIFF build | `employee-todo-app/.env.production` → `VITE_LIFF_ID`；`liff/config.ts` `APP_ORIGIN` = `https://info.tanxin.space/employee-todo/` |
| 顯示名稱 | PWA／標題為 **員工待辦**（非「代辦」） |

### 假設的 GAS 成功回應（供 TINA／後端對照）

```json
{
  "success": true,
  "tasks": [],
  "workers": [],
  "officeTasks": [],
  "deletedIds": [],
  "updatedAt": 1730000000000,
  "assigners": ["豪哥", "雯姐"]
}
```

失敗：

```json
{ "success": false, "message": "缺少權限" }
```

`todo_reorder` 請求範例：

```json
{
  "action": "todo_reorder",
  "board": "paigong",
  "liff_id_token": "...",
  "assigneeId": "ops-ende",
  "category": "priority",
  "orders": [{ "id": "task-1", "order": 0 }, { "id": "task-2", "order": 1 }]
}
```

## 本機預覽（不影響 info.tanxin.space）

```bash
cd employee-todo-app
npm install
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
| `VITE_LIFF_ID` | LINE LIFF（讀寫 todo_* 必填，除非 dev bypass） |
| `VITE_TODO_DEV_BYPASS=true` | 本機對齊 project-console dev_bypass |
| `VITE_TODO_DEV_USER_ID` | 搭配 bypass 的員工 userId |

## 正式切換後驗收（勿在本 PR 執行 deploy）

1. 派工／恩德／阿勇三 URL 各測新增、勾選、排序、刪除；兩台裝置同 board 資料一致。
2. LINE 內開 LIFF 可取得 `liff_id_token` 且 `todo_list`／寫入成功。
3. GAS 驗收後可停用舊 Mantle namespace（文件記錄即可）。

## 測試

```bash
cd employee-todo-app && npm run test:unit
cd modules/InteriorDesigned && npm test
```

## 風險

- 本環境無法讀取 private `Backend_GAS`；若實際 JSON 與上表不同，需對照 `employee-todo-rebuild.md` 微調 `todoGasClient`。
- **合併 main 即對外上線**；務必先 migration + Nephi 核准。
