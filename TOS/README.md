# TOS 盤點資料夾

這裡是 **ChatGPT 與 Cursor 共用的交接區**。兩邊不能直接聊天，都讀寫這個資料夾，再靠 GitHub `main` 對齊。

## 檔案

| 檔 | 用途 |
|---|---|
| `TOS_AUDIT.md` | 持續累積的主盤點紀錄 |
| `TOS_AUDIT_MASTER_SUMMARY_2026-08-24.md` | 目前架構基準總表 |
| `TOS_AUDIT_ROUND*.md` | 各輪原始盤點，不刪 |
| `巡檢回報.md` | 營運系統真人巡檢（每輪覆寫「本輪」；累積「待你決定」） |
| `營運系統真人巡檢_自動化指示.md` | 可貼進 Cursor Automations 的指示全文 |
| `營運系統真人巡檢_切換步驟.md` | 停舊看板排程、建新巡檢、測跑步驟 |

## 給兩邊代理人

- 新盤點、新 Round：**只新增或改 `TOS/` 裡的檔**，不要在倉庫根目錄再放 `TOS_AUDIT*.md`。
- 不要刪既有盤點內容；只能追加或標註修正。
- 改跨模組架構前，先對過 `TOS_AUDIT.md` 已記錄的資料流。
- 案件鍵長期用 `project_id`；舊欄位（案號、ProjectName 等）先不要一次改名。
- 藍圖仍看根目錄 `PROJECT_MAP.md`；戰情前端手冊仍看 `README_CODING.md`。
