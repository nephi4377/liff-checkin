# SketchUp 渲染工作室（前端）

完整 API／部署規格：`accounting-gas/SPEC/SKETCHUP_RENDER_STUDIO_SPEC.md`

部署路徑：`CODING/tools/sketchup-render-studio/` → `https://info.tanxin.space/tools/sketchup-render-studio/`

## 功能

- 多圖上傳（最多 8 張），下排小圖切換
- **左右對照**：左原圖、右渲染結果，依螢幕高度盡量大圖顯示
- **燈光來源標籤**：窗戶自然光、間接照明、坎燈、投射燈、櫃內燈光等（可多選）
- **多版本**：同一張圖可多次渲染，下排「此圖版本」小圖切換
- **批次渲染**：呼叫 `sketchup_render_batch`，第一張成功後自動作整案風格錨點

## 開發測試

```
index.html?dev=1&api=https://script.google.com/macros/s/你的部署ID/exec
```

## 檔案

| 檔案 | 說明 |
|------|------|
| `index.html` | 頁面結構 |
| `styles.css` | 深色 UI、大圖對照 |
| `app.js` | LIFF、API、狀態管理 |

## 複製到 CODING

```bat
xcopy /E /I tools\sketchup-render-studio ..\CODING\tools\sketchup-render-studio
```

然後執行 `CODING/upload.bat`。
