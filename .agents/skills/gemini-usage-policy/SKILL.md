---
name: gemini-usage-policy
description: >-
  添心專案 Gemini API 使用規範：模型版本（2.5+）、FREE/PAID 金鑰、token 額度、
  Context Cache 省費策略、accounting-gas OCR 實作位置。
  Use when the user mentions Gemini, OCR, API key, token limit, context cache,
  gemini-2.5, 模型選型, or asks to add AI vision features in backend/GAS.
disable-model-invocation: true
---

# Gemini 使用規範（添心）

> 需要改 Gemini 相關程式或查額度時，**手動 @ 本 skill**。

## 必記（模型）

- **預設 OCR 模型：`gemini-2.5-flash`**
- **`gemini-2.5` 以下（含 2.0-flash、1.5-flash）已全面淘汰，禁止新寫或回退**
- 覆寫：Script Property `GEMINI_OCR_MODEL`（僅在 2.5 家族內更換，例如 `gemini-2.5-pro`）

## 金鑰（Script Properties）

| Property | 用途 |
|----------|------|
| `GEMINI_API_KEY_FREE` | 優先；走 Google free tier quota |
| `GEMINI_API_KEY_PAID` | free 失敗或額度用盡時備援 |
| `GEMINI_API_KEY` | 舊版相容（上兩者未設時） |

**勿**把 key 寫進 repo、SPEC、skill 或對話紀錄。

## PAID 額度（送出前擋下，不 call API）

**預設策略**：只控 **token**，不控次數；PAID 月預算上限約 **USD 100**（FREE 先用盡）。

| Property | 程式預設 | `0` = 不檢查 |
|----------|----------|----------------|
| `GEMINI_PAID_DAILY_LIMIT` | **0**（不檢查次數） | ✓ |
| `GEMINI_PAID_MONTHLY_LIMIT` | **0** | ✓ |
| `GEMINI_PAID_DAILY_TOKEN_LIMIT` | **3,000,000** | ✓ |
| `GEMINI_PAID_MONTHLY_TOKEN_LIMIT` | **80,000,000** | ✓ |

未設 Property 即用上述預設。計數在 Script Properties；明細在 **`AUDIT_SPREADSHEET_ID`** → `Gemini使用紀錄`、`Gemini額度彙總`。

## Context Cache（省費）

### 隱式 cache（2.5 預設開啟，免設定）

- **相同 prompt 前綴**的重複請求自動折扣（`usageMetadata.cachedContentTokenCount`）
- OCR 規則：**固定文字 prompt 放前、圖片放後**（`OcrInvoice.buildGeminiVisionBody_`）
- 不要每次改 prompt 措辭，否則 cache 命不中

### 顯式 cache（accounting-gas 已實作，能建就建）

- `GeminiUsageLog.js` 對 OCR prompt 建 `cachedContents`，TTL 預設 1h（`GEMINI_CACHE_TTL_SEC`）
- prompt 太短可能建 cache 失敗 → 自動改走隱式 cache
- cache 引用失敗 → 自動 fallback 完整 body

## 程式位置（accounting-gas）

| 檔 | 職責 |
|----|------|
| `config_.js` | `getGeminiOcrModel_`、`getGeminiApiKeyEntries_` |
| `core/GeminiUsageLog.js` | 額度、log、cache、統一 `geminiGenerateContent_` |
| `OcrInvoice.js` | 發票／存摺 OCR |

其他 backend（如 `core_library`）若仍見 `gemini-1.5-*`，**觸碰時一併升到 2.5+**。

## 代理檢查清單

改 Gemini 相關 code 前：

1. 模型是否 ≥ `gemini-2.5-flash`？
2. FREE → PAID fallback 是否保留？
3. PAID 是否仍受 token/次數上限？
4. 固定 prompt 是否在圖片前（cache 友善）？
5. 是否記 log（不含 base64）？
6. 是否**未** commit API key？

## 詳細對照

見 [reference.md](reference.md)
