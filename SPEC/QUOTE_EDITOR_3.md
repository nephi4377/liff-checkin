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

## 開啟方式

- 後台「開啟報價編輯」在**同一分頁**打開，沿用這一頁已有的員工身分。網址只帶案號，不帶帳號、姓名、權限。
- 有人直接打開編輯頁，這分頁又沒有員工身分，也不在 LINE 或主控台裡：不跳 LINE 登入。畫面上寫「請從後台『設計師客戶財務 → 線上報價』開啟」，並給回設計師客戶財務的連結。

## 測

```bash
node --test tools/test-quote-editor.mjs
```
