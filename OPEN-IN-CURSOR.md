# 丟給另一個 Cursor 用（直接貼上）

把下面整段複製給對方 Cursor，或請對方 Clone 後 Open Folder。

---

請接手維護公司員工待辦（派工系統）。

## Repo（首選）
https://github.com/nephi4377/liff-checkin （分支 `employee-todo-mist`）

```bash
git clone -b employee-todo-mist --single-branch https://github.com/nephi4377/liff-checkin.git employee-todo
cd employee-todo
npm install
npm run dev
```

也請先讀 repo 根目錄 `HANDOFF.md` 與本檔 `OPEN-IN-CURSOR.md`。

## 線上網址（正式＝info.tanxin.space）
- 總覽：https://info.tanxin.space/employee-todo/
- 派工：https://info.tanxin.space/employee-todo/?role=paigong
- 恩德：https://info.tanxin.space/employee-todo/?role=ende
- 阿勇：https://info.tanxin.space/employee-todo/?role=ayong

**勿用** `https://tanxin02.github.io/employee-todo/`（舊版，入口會被導去那裡是 bug，已修）。

## 重點
- 派工可指派給恩德／阿勇；優先／限期完成／待處理／已完成
- 優先緊急等級可展開選；依緊急自動排序
- 恩德／阿勇只能勾完成、無回總覽、無 AI 面板
- MantleDB 多機同步；晨霧 UI
- 部署：build 後把 `dist/` 推到 `liff-checkin` `main` 的 `employee-todo/`
- 勿把任何 API／PAT commit 進 repo

## 可選 zip
若對方沒 GitHub 權限，可用交接 zip（無 node_modules）：解壓後 `npm install && npm run dev`。

---
