# CODING — AI Agent 操作指南

> 本指令集位於 `.agents/`，供 Cursor／Cloud Agent 在本倉庫工作時參考。

## 1. 工作流 (Workflows)

透過 `/` 或對應檔案觸發：

- `**/deploy**`（`workflows/deploy.md`）：推送 Git、部署記錄、可選 UI 驗證。
- `**/test-daily-report**`（`workflows/test_daily_report.md`）：日報相關瀏覽器測試。

## 2. 專業技能 (Skills)


| Skill                          | 何時用                                 |
| ------------------------------ | ----------------------------------- |
| `**Cloud-Agent-Runbook**`      | 在本倉庫跑起來、測試、除錯環境時**優先讀**             |
| `**GAS-Backend-Expert`**       | 改 `**../backend/**` 內 Google 試算表後端時 |
| `**human-comfortable**`        | 新增／改版給人用的介面（UX + Tailwind UI）       |
| `**tianxin-design-assistant**` | 裝修實務、估價、工法相關助理                      |
| `**code-advisor**`             | 審程式、要改法建議（短句觸發，如「幫我看」「審一下」）         |
| `**lyra-4d-prompt**`           | 模糊需求變可執行任務；白話確認後在 Cursor 內直接做（Lyra／4D） |
| `**debug-loop**`               | 使用者要求系統性除錯循環時                       |


## 3. 專案知識 (Knowledge)


| 檔案                         | 內容                |
| -------------------------- | ----------------- |
| `**Attendance-System.md**` | 假勤 API、特休／事假／病假判定 |


**架構與跨倉庫關係**（無獨立 knowledge 檔時請讀）：

- `SPEC/01_系統架構深編規格書.md`
- `SPEC/07_全量系統全景圖.md`
- `../backend/全專案系統技術規格書_自動生成.md`

## 4. Cursor 規則 (`.cursor/rules/`)


| 規則                                  | 說明                                 |
| ----------------------------------- | ---------------------------------- |
| `**00-general-plain-language.mdc`** | 白話、簡答（一律套用）                        |
| `**CODING-upload-deploy.mdc**`      | 上傳 GitHub 用 `upload.bat`（一律套用）     |
| `**gas-and-spec-pointer.mdc**`      | 改 API／config 時：後端在 backend、欄位看資料字典 |


## 如何擴充？

1. 新工作流：`.agents/workflows/*.md`
2. UI／人機介面：`.agents/skills/human-comfortable/SKILL.md`
3. 跑專案／測試：`.agents/skills/Cloud-Agent-Runbook/SKILL.md`（細節 `RUNBOOK_DETAIL.md`）
4. GAS 細節：`.agents/skills/GAS-Backend-Expert/SKILL.md`
5. 程式審閱：`.agents/skills/code-advisor/SKILL.md`
6. Lyra 4D 任務優化：`.agents/skills/lyra-4d-prompt/SKILL.md`

---

*最後整理：2026-06-16*