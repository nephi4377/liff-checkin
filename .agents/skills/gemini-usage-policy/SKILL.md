---
name: gemini-usage-policy
description: >-
  添心專案 Gemini API 使用規範：模型版本（2.5+）、Thinking 依需求開關、
  FREE/PAID 金鑰、token 額度、Context Cache 省費、accounting-gas OCR 實作位置。
  Use when the user mentions Gemini, OCR, thinking, thinkingBudget, API key,
  token limit, context cache, gemini-2.5, 模型選型, or asks to add AI vision features in backend/GAS.
disable-model-invocation: true
---

# Gemini 使用規範（添心）

> 需要改 Gemini 相關程式或查額度時，**手動 @ 本 skill**。

## 必記（模型）

- **預設 OCR 模型：`gemini-2.5-flash`**
- **`gemini-2.5` 以下（含 2.0-flash、1.5-flash）已全面淘汰，禁止新寫或回退**
- 覆寫：Script Property `GEMINI_OCR_MODEL`（僅在 2.5 家族內更換，例如 `gemini-2.5-pro`）

## Thinking（`thinkingBudget`）

2.5 模型用 `generationConfig.thinkingConfig.thinkingBudget` 控制是否「先想再答」。

| 值 | 意思 |
|----|------|
| **`0`** | **關** thinking（省 token、較快） |
| **`-1`** | 動態開（模型依難度自行決定） |
| **正整數** | 固定上限（如 `1024`、`4096`） |

**重點**：`gemini-2.5-flash` 預設會 thinking；**沒設 = 費用偏高**。`gemini-2.5-pro` **不能**設 `0`。

| 任務類型 | 建議 |
|----------|------|
| OCR、欄位抽取、簡單分類 | **`0`** |
| 合約稽核、報價拆解、多步推理 | **`-1`** 或 `2048`～`8192` |
| 要速度／控 PAID 成本 | **`0`** + flash |

```js
// generationConfig 內
thinkingConfig: { thinkingBudget: 0 }   // 關（OCR 現況）
thinkingConfig: { thinkingBudget: -1 }  // 動態開
thinkingConfig: { thinkingBudget: 4096 } // 固定上限
```

OCR 已實作：`OcrInvoice.buildGeminiVisionBody_` → `thinkingBudget: 0`。新功能依上表選，**不要一律沿用 OCR 的 0**。

## 金鑰（Script Properties）

| Property | 用途 |
|----------|------|
| `GEMINI_API_KEY_FREE` | 優先；走 Google free tier quota |
| `GEMINI_API_KEY_PAID` | free 失敗或額度用盡時備援 |
| `GEMINI_API_KEY` | 舊版相容（上兩者未設時） |

**勿**把 key 寫進 repo、SPEC、skill 或對話紀錄。

### FREE 額度用盡（當天不再 call FREE）

FREE 收到 **429 / 403 / `RESOURCE_EXHAUSTED`** 時：

1. **記住當天已滿**：寫 Script Property `GEMINI_FREE_EXHAUSTED_DAY` = 台北日 `yyyy-MM-dd`（與 `taipeiDayKey_` 同格式）
2. **當天後續請求跳過 FREE**，直接走 PAID（避免每筆都先撞 429 再 fallback）
3. **必開 cache**（顯式 + 隱式）：prompt 固定在前、圖在後；能建 `cachedContents` 就建——PAID 計費時 cache 命中可大幅省 token
4. **隔日自動恢復**：讀到 `GEMINI_FREE_EXHAUSTED_DAY !== 今日` 即清除，重新試 FREE

實作：`GeminiUsageLog.js` → `filterGeminiKeyEntriesForToday_`、`markGeminiFreeExhaustedToday_`。顯式 cache 依 **tier 分開**（FREE / PAID 各一份 cache ref）。

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
2. **`thinkingBudget` 是否符合任務**（OCR/抽取=`0`；推理才開）？
3. FREE → PAID fallback 是否保留？
4. **FREE 已滿是否記 `GEMINI_FREE_EXHAUSTED_DAY`、當天跳過 FREE？**
5. **fallback PAID 時是否優先用 cache？**
6. PAID 是否仍受 token/次數上限？
7. 固定 prompt 是否在圖片前（cache 友善）？
8. 是否記 log（不含 base64）？
9. 是否**未** commit API key？

## 詳細對照

見 [reference.md](reference.md)
