# 員工待辦事項

公司 GitHub：**[tanxin02/employee-todo](https://github.com/tanxin02/employee-todo)**

派工給恩德／阿勇：優先／待處理／限期完成、詳細說明、誰派的、勾選完成、雲端同步。繁中 UI。

## 正式網址（GitHub Pages）

| 角色 | URL |
|------|-----|
| 總覽 | https://tanxin02.github.io/employee-todo/ |
| 派工 | https://tanxin02.github.io/employee-todo/?role=paigong |
| 恩德 | https://tanxin02.github.io/employee-todo/?role=ende |
| 阿勇 | https://tanxin02.github.io/employee-todo/?role=ayong |

接手說明見 **[HANDOFF.md](./HANDOFF.md)**。

## 開發

```bash
npm install
npm run dev
npm run build
```

## 安裝方式

| 平台 | 方式 |
|------|------|
| 網頁／PWA | 上表 Pages；iPhone Safari「加入主畫面」 |
| Android | `npm run android:apk`（Capacitor） |
| iOS 原生 | 需 **Mac + Xcode**；`npm run ios:sync` 後 `npx cap open ios` |

## 派工小抄

- **AI 整理**（僅派工頁）：貼上／說話 →「整理」→「複製」→ 貼進「詳細說明」
  - 有 `VITE_OPENAI_API_KEY`（build 時注入）→ 雲端 LLM；否則本機規則整理
- 恩德／阿勇：專屬介面，無「回總覽」、無 AI 面板
- 緊急等級：點 chip 展開選擇（緊急／普通／不急）

## Deploy Pages

```bash
npm run build
# 將 dist/ 推到 gh-pages 分支（Pages source = gh-pages /）
```

**勿**把 PAT／密碼 commit 進 repo。
