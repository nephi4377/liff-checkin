# Handoff — 員工待辦（employee-todo）

給另一個 Cursor／開發者接手用。

**直接可貼給對方 Cursor 的開場稿：** 見根目錄 [`OPEN-IN-CURSOR.md`](./OPEN-IN-CURSOR.md)（與 store `docs/drop-into-cursor.md` 同步）。

## Repo & live URLs

- **原始碼：** `nephi4377/liff-checkin` 分支 `employee-todo-mist`
- **正式站（請用這個）：**
  - 總覽：https://info.tanxin.space/employee-todo/
  - 派工：https://info.tanxin.space/employee-todo/?role=paigong
  - 恩德：https://info.tanxin.space/employee-todo/?role=ende
  - 阿勇：https://info.tanxin.space/employee-todo/?role=ayong

**勿再用** `https://tanxin02.github.io/employee-todo/`（舊版；本代理無法寫入該 repo）。

## Open in a new Cursor

```bash
git clone -b employee-todo-mist --single-branch https://github.com/nephi4377/liff-checkin.git employee-todo
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
- **AI 整理**（僅派工頁）：網頁面板整理 → 複製 → 貼「詳細說明」  
  - LLM：`VITE_OPENAI_API_KEY`（可選 `VITE_OPENAI_BASE_URL` / `VITE_OPENAI_MODEL`）  
  - 無金鑰：本機規則（對象／分類／緊急／期限＋條列）  
- 恩德／阿勇：只勾完成；**無「回總覽」、無 AI 面板**  

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
- **不要**在恩德／阿勇頁加「回總覽」或 AI 整理面板  
- **不要**把 API 金鑰 commit 進 repo  

- Linux **無法**簽 iOS IPA（需 Mac + Xcode）

## Artifacts (Agent Store)

若從此雲端環境帶走：

- APK：`…/media/employee-todo-debug.apk`  
- iOS zip：`…/artifacts/employee-todo-ios-project.zip`  
- 交接說明：`…/docs/cursor-handoff.md`  
- 原始碼 zip：`…/artifacts/employee-todo-handoff.zip`
