# QUOTE-EDITOR-3（切片 1–2）

人話規格：Project store `docs/QUOTE-EDITOR-3-規格.md`。

## 程式對照

| 白話 | 程式 |
|------|------|
| 主控台「線上報價」分頁 | `designer-customer-finance.html` → `panelQuote` |
| 編輯頁：試算表格子、加購、扣費、版本 | `modules/projects/quote-editor.html`＋`quote-editor-grid.js` |
| 客人看報價＋確認 | `modules/projects/quote-view.html` |
| 前端再擋成本／廠商價 | `quote-editor-sanitize.js` |
| API | `AccountingApi.quoteEditor*` → `quote_editor_*` |

## 試算表填法（同事）

點格子打字；Tab、方向鍵換格，Enter 往下。最底永遠留一列空白，在空白列打字或在最後一列按 Enter 會再補一列。工種、單位用選的；品名可打，也可點標準計價帶入單位和單價，之後仍可改。可貼上 Excel 多列（Tab 分開）。小計、工種小計、總計跟著變。每列可刪、在下方插一列、上下移。刪除和上下移會寫回這份草稿（只有草稿能改；已送出或已確認的不能改）。櫃子的抽屜／拉籃用「＋加購」變成縮排子列，名稱、數量、單價可自填。格子會自動暫存。客人頁仍只有單位、數量、金額，沒有單價。功能開關不在這一層。

## 測

```bash
node --test tools/test-quote-editor.mjs tools/test-quote-editor-grid.mjs
```
