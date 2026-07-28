# 2026-07-28 LOG — SketchUp 渲染保真模式

## 目的

解決 AI 亂改油漆面、樑柱變灰、平釘天花變造型天花；預設保真，僅加光線質感。

## 技術

| 位置 | 變更 |
|------|------|
| `SketchupRenderStudio.js` | `render_mode`／`preserve` 參數；強化 system／user prompt；保真 temperature 0.35 |
| `tools/sketchup-render-studio/` | 渲染模式、不要動勾選、分析摘要、雙渲染按鈕 |
| `SPEC/23_SKETCHUP_RENDER_STUDIO_SPEC.md` | UI 說明 |

## 驗證

1. 預設「保真」+ 全勾 → 側面略暗樑不變灰、平釘天花不變造型  
2. 「只加光線質感」強制保真  
3. 分析後見天花／樑柱摘要；保真不自動套風格  

## 部署

- 待：accounting-gas clasp + CODING push
