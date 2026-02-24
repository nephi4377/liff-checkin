---
description: 針對每日報表系統進行三階段自動化壓力測試
---

// turbo-all
# 日報系統自動測試工作流

1. **基礎載入測試**
   命令 Browser Subagent 訪問 `https://info.tanxin.space/modules/projects/daily_report.html`。
   確認關鍵 ID：`#kpi-dashboard`, `#person-search-input`, `#reports-container` 是否正確載入。

2. **多維度搜尋測試**
   模擬輸入隨機組員姓名，驗證篩選列表是否即時更新。
   檢查並記錄控制台錯誤 (Console Logs)。

3. **雙視角切換測試**
   自動點擊「專案模式」按鈕，確認卡片分組是否從「姓名」轉為「案場編號」。
   驗證「專案模式」下的圖片預覽功能是否正常。

4. **時間軸完整性測試**
   模擬選取一週日期，確認無報告日是否已出現「缺交」或「休假」標記，且樣式符合「超緊湊」規範。

5. **生成報告**
   截取三個關鍵步驟的圖檔，並將測試日誌寫入 `部署記錄.md` 供 USER 參考。
