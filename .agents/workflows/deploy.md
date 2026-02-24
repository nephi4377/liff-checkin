---
description: 自動化部署日報表系統並更新記錄
---

// turbo-all
# 全自動部署工作流

1. **同步代碼到 GitHub**
   執行指令：`git add . ; git commit -m "auto: dashboard update" ; git push origin main`
   (在 c:\Users\a9999\Dropbox\CodeBackups\CODING 執行)

2. **更新本地部署記錄**
   自動讀取當前時間並在 `部署記錄.md` 結尾新增一筆「自動化部署完成」的紀錄。

3. **啟動 Subagent 進行線上驗證**
   派出一名 Subagent 訪問正式網址，確認 KPI 看板與人員名單顯示正常，並回傳截圖。

4. **完成回報**
   整理驗證結果並通知 USER。
