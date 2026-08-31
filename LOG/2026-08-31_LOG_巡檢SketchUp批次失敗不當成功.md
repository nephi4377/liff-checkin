# 2026-08-31 LOG — 巡檢：SketchUp 批次失敗不當成功

## Diff／目的

設計師從主控台開「SketchUp 渲染工作室」：
- 開頁連不上時只寫「載入失敗」，沒有再試，人只能關了重開。
- 按「批次渲染全部」時，即使每張都失敗，結束仍寫「批次渲染結束」（成功樣式），像做完了但其實沒圖。

未改渲染規則、燈種或權限；只分失敗／成功，並提供再試。

## 技術

- `tools/sketchup-render-studio/index.html`：開頁狀態列＋「再試一次」
- `tools/sketchup-render-studio/app.js`：ping 自動再試一次；批次結束依失敗張數寫人話
- `tools/sketchup-render-studio/styles.css`：開頁失敗排版
- `SPEC/23_SKETCHUP_RENDER_STUDIO_SPEC.md`

未改 GAS。Cloud 無法 `upload.bat`；合 main 後才算正式站。

## 驗證

- `node --check tools/sketchup-render-studio/app.js`
- `node tools/sketchup-render-studio/batch-finish.test.mjs`
- 本機開頁加壞掉的 `?api=`：應看到「載入失敗」與「再試一次」，不可只停在載入中
