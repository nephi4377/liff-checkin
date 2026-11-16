# Multi-Agent Brain（未來構想）

狀態：IDEA / 暫不實作

## 核心想法

建立中央想法庫與多 Agent 協作機制，讓不同 Agent 從策略、技術、財務、反方、使用者、驗證等角度分析同一目標，再由 Master Agent 整合決策。

## 為什麼暫緩

目前更迫切的需求不是多 Agent 討論，而是：
- 多台電腦可無縫接續工作
- 多條任務可同時存在
- 某條任務做到一半可保留 Agent / 上下文
- 換機或換 Agent 後不需人工重新交代

因此先完成 Task Handoff 基礎，再評估是否把本構想接上去。

## 未來可能整合

- 每個 Task 可選擇啟用 Multi-Agent Review
- Strategy / Tech / Critic / Finance / Reviewer / Master
- 最後產生 Decision 與下一步
