# Handoff — 員工待辦（employee-todo）

給另一個 Cursor／開發者接手用。

## Repo & live URLs

- **GitHub：** https://github.com/tanxin02/employee-todo  
- **Org：** `tanxin02`  
- **GitHub Pages（正式）：**
  - 總覽：https://tanxin02.github.io/employee-todo/
  - 派工：https://tanxin02.github.io/employee-todo/?role=paigong
  - 恩德：https://tanxin02.github.io/employee-todo/?role=ende
  - 阿勇：https://tanxin02.github.io/employee-todo/?role=ayong

舊 Surge（備份，非公司帳）仍可能存在；應用內連結已指向 Pages。

## Open in a new Cursor

```bash
git clone https://github.com/tanxin02/employee-todo.git
cd employee-todo
npm install
npm run dev
```

在 Cursor：File → Open Folder → 選 `employee-todo`。

## Stack

- React 19 + TypeScript + Vite + PWA  
- Capacitor（Android / iOS 專案）  
- @dnd-kit 拖曳排序  
- MantleDB／雲端 sync（namespace 見 `src/sync/config.ts`）  
- 角色：hostname（舊 Surge）或 `?role=paigong|ende|ayong`（Pages）

## Key features

- 三角色：派工／恩德／阿勇（繁中 UI）  
- 優先／待處理／限期完成；優先依緊急自動排序  
- 緊急等級：chip 點開選（非三大按鈕）  
- 詳細說明、誰派的（`assigner`）、限期 `dueDate`  
- **AI 整理再貼上**：整理在 Cursor 完成 → 羊貼進派工「詳細說明」（無網頁批次匯入、無瀏覽器 AI）  
- 恩德／阿勇：只勾完成；顯示派自／限期；**無「回總覽」**（總覽僅 unmarked／選角色）  

流程見 store `docs/paste-format.md`。

## Deploy (GitHub Pages)

```bash
npm run build
rm -f dist/CNAME
# orphan push dist → gh-pages
# then ensure Pages source = gh-pages / (root)
```

或沿用既有流程：把 `dist/` 推到 `gh-pages` 分支並啟用 Pages。

## What NOT to do

- **不要**把 GitHub PAT／密碼寫進 repo、docs、media、HANDOFF  
- **不要** commit `.env` 真密鑰  
- **不要**在恩德／阿勇頁加「回總覽」或批次貼上匯入  
- **不要**在網頁做 AI 整理；整理只在 Cursor 聊天  

- Linux **無法**簽 iOS IPA（需 Mac + Xcode）

## Artifacts (Agent Store)

若從此雲端環境帶走：

- APK：`…/media/employee-todo-debug.apk`  
- iOS zip：`…/artifacts/employee-todo-ios-project.zip`  
- 交接說明：`…/docs/cursor-handoff.md`  
- 原始碼 zip：`…/artifacts/employee-todo-handoff.zip`
