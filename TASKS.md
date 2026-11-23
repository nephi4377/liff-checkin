# TASKS.md

此檔是跨電腦、跨 Agent 的工作總覽。每一條工作線都必須有自己的 `tasks/TASK-xxx-名稱/STATE.md`。

## 工作狀態

- ACTIVE：正在進行
- PAUSED：保留上下文，暫停
- BLOCKED：被外部條件卡住
- REVIEW：等待驗證／合併
- DONE：完成

## 使用原則

1. 不要求一次只做一件事；可同時存在多個 ACTIVE / PAUSED 任務。
2. 每個任務應有獨立 branch；同機同時開多條工作線時，優先使用 git worktree。
3. Agent 開始工作時，先讀本檔，再讀該任務的 STATE.md。
4. Agent 暫停、切換電腦或結束 session 前，必須更新 STATE.md 並 commit + push。
5. 不要只依賴聊天上下文、IDE session 或 git stash 作為交接依據。
6. 若任務已被其他 Agent 標為 ACTIVE 且修改範圍重疊，不得直接接手或覆蓋。

## 進行中任務

| Task | 狀態 | Owner / Agent | Branch | 最後進度 | 下一步 |
|---|---|---|---|---|---|
| — | — | — | — | 尚未建立第一條工作線 | 從 template 建立 TASK-001 |

## 建立新任務

複製 `tasks/_TEMPLATE/STATE.md` 到：

`tasks/TASK-xxx-簡短名稱/STATE.md`

並同步新增到上方總表。
