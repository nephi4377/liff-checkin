# Gemini 使用 — 技術對照（accounting-gas）

## API 呼叫順序

```
FREE key →（quota/429）→ 記 GEMINI_FREE_EXHAUSTED_DAY → 當天跳過 FREE
         → PAID key（先 checkGeminiPaidQuota_，必開 cache）
```

## FREE 額度用盡

| Property | 用途 |
|----------|------|
| `GEMINI_FREE_EXHAUSTED_DAY` | 台北日 `yyyy-MM-dd`；等於今日 = 當天不再 call FREE |

- 觸發：FREE 回 429 / 403 / `RESOURCE_EXHAUSTED`
- 清除：日期 ≠ 今日（或隔日第一次讀取時）
- PAID fallback 時**務必**走顯式 cache（`prompt_cache_key` + `static_prompt`）；tier 切換後 PAID 需自己的 cache ref

## Log 分頁欄位（`Gemini使用紀錄`）

- `request_meta` JSON 含 `cache_mode`：`explicit` | `implicit`
- `response_meta` 含 `cachedContentTokenCount`（有命中 cache 時 > 0）
- **不記** base64 圖片

## Cache Script Properties

格式：`GEMINI_CACHE_{cacheKey}_{tier}_{model}_NAME` / `_EXPIRE`

OCR cache key：

- `ocr_invoice`
- `ocr_bank_passbook`

## 預算預設（未設 Property 時）

- 日 token：**3M**（約 USD 1～2／日 PAID OCR）
- 月 token：**80M**（約 USD 40～80／月，對應 **USD 100** 預算餘裕）
- 次數：**不限制**（`DAILY/MONTHLY_LIMIT=0`）

FREE key 優先；多數情況實際帳單 **低於** 預算上限。

## thinkingBudget

| 值 | Flash | Pro |
|----|-------|-----|
| `0` | 關 thinking | ❌ 不支援，會 400 |
| `-1` | 動態 | 動態（預設） |
| 正整數 | 上限 token | 上限 token |

- thinking token 計入 `usageMetadata`（含 `thoughtsTokenCount`）；log 時一併看 total
- OCR：`OcrInvoice.buildGeminiVisionBody_` 固定 `0`
- 未設 `thinkingConfig` 的 flash 請求 ≈ 動態 thinking，成本明顯高於 OCR

## 常見錯誤

| 現象 | 原因 |
|------|------|
| OCR 全失敗 | 未設 FREE/PAID key |
| PAID 從不觸發 | FREE 仍可用 |
| 每筆都先 429 再 PAID | 未記 `GEMINI_FREE_EXHAUSTED_DAY`、當天仍試 FREE |
| PAID 費用偏高 | FREE 滿後未開 cache |
| PAID 被擋 | 次數/token 上限；查 `Gemini額度彙總` |
| cache 無折扣 | prompt 被改字／未用 2.5 模型 |
| 顯式 cache 建失敗 | prompt 低於 Google 最低 token；靠隱式 cache |
| flash 費用暴增 | 未設 `thinkingBudget: 0`（非推理任務） |
| Pro 設 0 報 400 | Pro 不能關 thinking |
