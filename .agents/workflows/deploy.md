---
description: 部署前閘門與上線（已併入 deploy-runbook skill）
---

# 部署工作流

> **請改用 skill：`deploy-runbook`**（`.agents/skills/deploy-runbook/SKILL.md`）  
> 觸發：`@deploy-runbook` 或使用者明確說「部署／上線／發布」。

## 四步閘門（不可跳步）

1. **SPEC 更新**
2. **LOG 撰寫**
3. **必要部份的備份**
4. **部署**（`upload.bat` 或模組 `deploy.bat`）

有任何問題 → **回報並暫停部署、請示使用者**。

## 倉庫對照

見 `deploy-runbook/targets.md`。
