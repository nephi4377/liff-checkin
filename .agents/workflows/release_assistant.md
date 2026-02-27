---
description: 添心生產力助手 - 全自動化版本發布工作流 (v1.8+)
---

// turbo-all
# 🚀 添心生產力助手：一鍵發布工作流

此工作流用於自動化「添心生產力助手」的代碼提交、版本標記與 GitHub 發布。

## 執行步驟

1. **同步代碼到 GitHub (Main Branch)**
   指令：`git add . ; git commit -m "feat: automated release update" ; git push origin master`
   *(路徑：c:\Users\a9999\Dropbox\CodeBackups\添心生產力助手)*

2. **同步業務核心 (Client Main Branch)**
   指令：`git add . ; git commit -m "feat: automated client hotfix" ; git push origin main`
   *(路徑：c:\Users\a9999\Dropbox\CodeBackups\添心生產力助手\client)*

3. **發布版本標籤 (Git Tag)**
   *(自動根據 package.json 內的版本號進行標記)*
   指令：`for /f "tokens=2 delims=:," %a in ('findstr "version" client\package.json') do (set ver=%~a & set ver=%ver: =% & git tag v%ver% & git push origin v%ver%)`
   *(路徑：c:\Users\a9999\Dropbox\CodeBackups\添心生產力助手\client)*

4. **更新日誌與技術規格書**
   自動根據 commit 內容更新 `部署記錄.md` 與 `SPEC/PROJECT_CONTEXT.md`。

5. **完成回報**
   確認 GitHub Actions 已觸發，並通知使用者版本已進入發布隊列。
