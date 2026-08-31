# 2026-08-31 LOG — SketchUp 渲染：送出圖自選＋畫筆

## Diff／目的

設計師可指定這次送出原圖或某一渲染版本；可用畫筆圈要改的地方。同時修正：嵌燈標籤與筒燈分開、正式站不要用開發測試身分、批次一張完成就顯示。

## 技術

| 區 | 內容 |
|----|------|
| 前端 | `tools/sketchup-render-studio/`（`index.html`／`app.js`／`styles.css`） |
| SPEC | `SPEC/23_SKETCHUP_RENDER_STUDIO_SPEC.md` |
| 後端（另倉） | accounting-gas：prompt、權限 ≥ 2、畫筆／送出圖契約 |

## 驗證

1. 橘色字顯示「這次送出：原圖」或「版本 N」
2. 選版本後再渲染，是改那一張而不是永遠原圖
3. 畫筆圈完再渲，成品不留紅線
4. 從 LINE／主控台進：使用紀錄是員工名，不是「開發測試」

## 部署

| 項目 | 值 |
|------|-----|
| 狀態 | **已上線** |
| commit | `2145689`（push 後 HEAD `2686a07`） |
| URL | `https://info.tanxin.space/tools/sketchup-render-studio/` |
