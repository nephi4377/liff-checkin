# CODING — AI Agent 操作指南

> 本指令集位於 `.agents/`，供 Cursor／Cloud Agent 在本倉庫工作時參考。

## 1. 工作流 (Workflows)

透過 `/` 或對應檔案觸發：

- `**/deploy**`（`workflows/deploy.md`）：推送 Git、部署記錄、可選 UI 驗證。
- `**/test-daily-report**`（`workflows/test_daily_report.md`）：日報相關瀏覽器測試。

## 2. 專業技能 (Skills)

### 任務怎麼做（流程）

| Skill | 何時用 |
|-------|--------|
| `**lyra-4d-prompt**` | 需求還模糊 → 白話確認後在 Cursor **直接做** |
| `**code-advisor**` | 程式寫好了 → **審**、列建議；預設等你勾才改 |
| `**debug-loop**` | **已經壞了** → 重現、找根因、修、再測 |
| `**plain-language-explain**` | 解釋給人聽；預設不寫函式名 |
| `**conversation-handoff**` | 換新對話 → 產出可複製的交接區塊（目標、待辦、部署狀態） |

### 後端 GAS（`../backend/`）

| Skill | 何時用 |
|-------|--------|
| `**GAS-Backend-Expert**` | 改 API、試算表、觸發器、部署 clasp（細節 `reference.md`） |
| `**gas-sheets-batch-io**` | GAS **試算表太慢／逾時**；查迴圈逐格讀寫 |
| `**gemini-usage-policy**` | Gemini、OCR、token 額度、模型版本（2.5+） |

### 介面與領域

| Skill | 何時用 |
|-------|--------|
| `**human-comfortable**` | 給真人點的網頁（UX + Tailwind） |
| `**tianxin-design-assistant**` | 裝修實務、估價、工法 |

### 本地跑前端（不常需要）

| Skill | 何時用 |
|-------|--------|
| `**Cloud-Agent-Runbook**` | 要在本機 **開 CODING 網站** 或跑 LayoutPlanner 測試時 @；改 GAS 用 `upload.bat` 即可 |

> 觸發範例：`@Cloud-Agent-Runbook 幫我開本地站看 Dashboard`

## 3. 專案知識 (Knowledge)

| 檔案 | 內容 |
|------|------|
| `**Attendance-System.md**` | 假勤 API、特休／事假／病假判定 |

**架構與跨倉庫**（無獨立 knowledge 檔時請讀）：

- `SPEC/01_系統架構深編規格書.md`
- `SPEC/07_全量系統全景圖.md`
- `../backend/全專案系統技術規格書_自動生成.md`
- `../backend/SPEC/GOOGLE_ACCOUNTS.md`（GAS 帳號／clasp）

## 4. Cursor 規則 (`.cursor/rules/`)

| 規則 | 說明 |
|------|------|
| `**00-general-plain-language.mdc**` | 白話、簡答 |
| `**CODING-upload-deploy.mdc**` | 前端上傳 GitHub 用 `upload.bat` |
| `**gas-and-spec-pointer.mdc**` | 改 API／config：後端在 backend、欄位看資料字典 |

## 5. 快速選 skill

```
想法還亂           → lyra-4d-prompt
改 GAS 後端        → GAS-Backend-Expert（慢／逾時加 gas-sheets-batch-io；OCR 加 gemini-usage-policy）
改完想審           → code-advisor
已經出錯           → debug-loop
解釋聽不懂         → plain-language-explain
改給人看的介面     → human-comfortable
本機開網站測前端   → Cloud-Agent-Runbook
換新對話接續       → conversation-handoff
```

## 如何擴充？

1. 新工作流：`.agents/workflows/*.md`
2. 新 skill：`.agents/skills/<名稱>/SKILL.md`，並更新本檔 §2
3. 詳節放 `reference.md`，主檔保持精簡
4. 業務規則仍寫 **SPEC**，skill 只留 Agent 操作捷徑

---

*最後整理：2026-06-21*
