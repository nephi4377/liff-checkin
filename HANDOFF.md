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
- **整理後貼上**：僅派工頁；Cursor 整理 → 貼上 → 預覽勾選 → 加入（無瀏覽器 AI API）  
- 恩德／阿勇：只勾完成；顯示派自／限期  

貼上格式見 store `docs/paste-format.md` 或 `src/pasteFormat.ts`。

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
- **不要**在恩德／阿勇頁加「整理後貼上」  
- Linux **無法**簽 iOS IPA（需 Mac + Xcode）

## Artifacts (Agent Store)

若從此雲端環境帶走：

- APK：`…/media/employee-todo-debug.apk`  
- iOS zip：`…/artifacts/employee-todo-ios-project.zip`  
- 交接說明：`…/docs/cursor-handoff.md`  
- 原始碼 zip：`…/artifacts/employee-todo-handoff.zip`
