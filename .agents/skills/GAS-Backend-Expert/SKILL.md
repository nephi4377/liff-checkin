---
name: gas-backend-expert
description: >-
  修改 Google 試算表後端（GAS）時使用。後端在 ../backend/ 倉庫；欄位以 PROJECT_DATA_DICTIONARY 為準；
  含 WebApp 路由、錯誤回傳、Constants、試算表與部署注意事項。
---

# GAS 後端開發（骨架）

> **CODING 倉庫只有前端**；本 skill 供助理改 **`backend/`** 倉庫內的 Apps Script 時遵循。內容可逐步補細。

## 何時載入

- 使用者要改 API、`action`、試算表寫入、觸發器、LINE／Dropbox／Gemini 整合
- 前端報錯懷疑後端邏輯時（先對照 SPEC 與資料字典，再到 backend 查）

## 程式庫位置（相對 CODING）

| 模組 | 路徑（在 `backend/` 下） | 用途 |
|------|---------------------------|------|
| 考勤核心 | `CheckinSystem/` | 打卡、員工、排班、定時通知 |
| 專案主控台 | `project-console/` | 案場、施工日誌、日報路由 |
| 共用庫 | `core_library/` | Gemini、Dropbox、LINE 等共用 |

架構摘要可參：`backend/全專案系統技術規格書_自動生成.md`

## 必讀文件（CODING 側）

- `SPEC/PROJECT_DATA_DICTIONARY.md` — 欄位名**唯一**準則
- `SPEC/07_SYSTEM_FLOW_MAP.md` — 前後端怎麼串
- 模組 SPEC（如 `SPEC/施工回報_系統完整_SPEC.md`、`SPEC/03_CHECKIN_SYSTEM_SPEC.md`）

## 開發原則（摘要）

1. **常數集中**：工作表名稱、快取 TTL 等放在 `Constants.gs`，**不要**在邏輯裡硬編碼表名。
2. **WebApp 路由**：`doGet` / `doPost` 依 `action`（或專案既有參數）分派；新 action 要對齊前端與 SPEC 表格。
3. **回傳格式**：與現有 API 一致（通常 JSON：`success`、訊息、資料）；業務失敗與 HTTP 錯誤分開處理。
4. **錯誤處理**：`try/catch` + 可讀訊息；敏感細節只寫 log，不直接回傳給前端。
5. **試算表**：讀寫前確認欄位順序與字典一致；大量寫入注意配額與批次。
6. **觸發器**：定時任務放 `ScheduledTasks.gs` 等專檔；避免重複建立相同觸發器。
7. **Library**：共用邏輯放 `core_library`，專案內用 Library 引用，避免複製貼上。

## 安全

- 金鑰、Token 用 **Script Properties** 或既有密鑰管理，**不要** commit 進 repo。
- 權限採最小必要；對外 WebApp 要驗證呼叫來源／參數（依各模組現有做法延伸）。

## 與前端協作

- 改欄位或 action 時：**同步**更新 `PROJECT_DATA_DICTIONARY.md` 與相關 SPEC。
- CODING 內只改呼叫端時，用 skill **`10-gas-and-spec-pointer`**（`.cursor/rules/`）對照即可。

## 部署（勿自動執行）

- **`clasp push` / 部署**：僅在使用者明確說「部署、發布、Deploy」時執行。
- 部署後若影響上線，提醒使用者驗證 WebApp URL 版本與關鍵 `action`。

## 待補（之後可寫進本檔）

- [ ] 各專案 `clasp` 設定與部署步驟
- [ ] 常見 `action` 對照表
- [ ] 配額／執行時間上限踩坑紀錄
