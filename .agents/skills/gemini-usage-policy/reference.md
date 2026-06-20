# Gemini 使用 — 技術對照（accounting-gas）

## API 呼叫順序

```
FREE key →（quota/429）→ PAID key（先 checkGeminiPaidQuota_）
```

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

## 常見錯誤

| 現象 | 原因 |
|------|------|
| OCR 全失敗 | 未設 FREE/PAID key |
| PAID 從不觸發 | FREE 仍可用 |
| PAID 被擋 | 次數/token 上限；查 `Gemini額度彙總` |
| cache 無折扣 | prompt 被改字／未用 2.5 模型 |
| 顯式 cache 建失敗 | prompt 低於 Google 最低 token；靠隱式 cache |
