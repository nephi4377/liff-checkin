# 員工待辦（晨霧版）

派工給恩德／阿勇：優先／限期件／待處理、誰派的下拉、MantleDB 多機同步。

## 正式網址（Pages 子路徑）

| 角色 | URL |
|------|-----|
| 總覽 | https://info.tanxin.space/employee-todo/ |
| 派工 | https://info.tanxin.space/employee-todo/?role=paigong |
| 恩德 | https://info.tanxin.space/employee-todo/?role=ende |
| 阿勇 | https://info.tanxin.space/employee-todo/?role=ayong |

原始碼在本 repo 分支 `employee-todo-mist`（此分支根目錄即完整 Vite 專案）。

## 開發

```bash
git clone -b employee-todo-mist --single-branch https://github.com/nephi4377/liff-checkin.git employee-todo
cd employee-todo
npm install
npm run dev
```

同步：MantleDB 房間內建於 `src/sync/config.ts`（與既有正式資料共用）。

勿把 API／PAT commit 進 repo。
