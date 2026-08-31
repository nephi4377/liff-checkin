# 2026-08-31 LOG — SketchUp：主控台帶身分開頁

## Diff／目的

從主控台開渲染工作室改走員工 `?uid=`，避免外部瀏覽器 LINE 登入 400。

## 技術

| 檔 | 內容 |
|----|------|
| `spa/Dashboard.js` | 開啟／複製網址附 `?uid=` |
| `spa/app.js`／`index.html` | cache `v26.08.31.3` |
| `tools/sketchup-render-studio/app.js` | 有 uid 則 ping，不 init LIFF；400 改人話 |
| SPEC | `SPEC/23_SKETCHUP_RENDER_STUDIO_SPEC.md` |

未納入：`LOG/2026-08-31_LOG_多處錯誤送到AI.md`（無關）

## 驗證

1. 主控台「開啟網站」網址有 `?uid=`
2. 開頁連線成功，不再 400
3. 畫面身分不是「開發測試」（有 ping `display_name` 時顯示姓名）

## 部署

| 項目 | 值 |
|------|-----|
| 狀態 | 待本輪 push |
