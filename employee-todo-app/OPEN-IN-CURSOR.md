# 丟給另一個 Cursor 用（直接貼上）

把下面整段複製給對方 Cursor，或請對方 Clone 後 Open Folder。

---

請接手維護公司員工待辦（派工系統）。

## Repo（首選）
https://github.com/tanxin02/employee-todo

```bash
git clone https://github.com/tanxin02/employee-todo.git
cd employee-todo
npm install
npm run dev
```

也請先讀 repo 根目錄 `HANDOFF.md` 與本檔 `OPEN-IN-CURSOR.md`。

## 線上網址（GitHub Pages）
- 總覽：https://tanxin02.github.io/employee-todo/
- 派工：https://tanxin02.github.io/employee-todo/?role=paigong
- 恩德：https://tanxin02.github.io/employee-todo/?role=ende
- 阿勇：https://tanxin02.github.io/employee-todo/?role=ayong

## 重點
- 派工可指派給恩德／阿勇；優先／限期完成／待處理／已完成
- 優先緊急等級可展開選；依緊急自動排序
- 派工頁有「AI 整理」→ 複製貼到詳細說明（本機規則整理；可選 build 時注入雲端金鑰，勿 commit）
- 恩德／阿勇只能勾完成、無回總覽、無 AI 面板
- 多機雲端同步；暖色調 UI
- 部署：改完 push `main` 並更新 `gh-pages`（見 HANDOFF.md）
- 勿把任何 API／PAT commit 進 repo

## 可選 zip
若對方沒 GitHub 權限，可用交接 zip（無 node_modules）。
解壓後務必用 Cursor **Open Folder 選裡面的 `employee-todo` 資料夾**（要看得到 `package.json` 與 `開始用.txt`），再執行：

```bash
npm install
npm run dev
```

**更穩仍建議直接 Clone GitHub**（上方指令），不要只開外層空資料夾。

---
