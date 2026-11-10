# QUOTE-EDITOR-3（切片 1–2）

人話規格：Project store `docs/QUOTE-EDITOR-3-規格.md`。

## 程式對照

| 白話 | 程式 |
|------|------|
| 主控台「線上報價」分頁 | `designer-customer-finance.html` → `panelQuote` |
| 編輯頁加空間／挑工項／扣費／版本 | `modules/projects/quote-editor.html` |
| 客人看報價＋確認 | `modules/projects/quote-view.html` |
| 前端再擋成本／廠商價 | `quote-editor-sanitize.js` |
| API | `AccountingApi.quoteEditor*` → `quote_editor_*` |

## 測

```bash
node --test tools/test-quote-editor.mjs
```
