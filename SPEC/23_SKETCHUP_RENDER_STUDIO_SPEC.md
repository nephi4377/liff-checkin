# SketchUp 渲染工作室 — 開發規格書（CODING 前端）

> **狀態**：已上線  
> **正式網址**：https://info.tanxin.space/tools/sketchup-render-studio/  
> **前端**：`CODING/tools/sketchup-render-studio/`  
> **後端**：`backend/accounting-gas/SketchupRenderStudio.js`（經 `WebApp.js` 路由）  
> **完整後端規格**：accounting-gas `SPEC/SKETCHUP_RENDER_STUDIO_SPEC.md`

---

## 一句話

上傳 SketchUp 截圖 → AI 分析建議 → 寫實室內渲染；支援多圖批次、燈光來源標籤、每圖局部 Prompt。

---

## 前端檔案

| 檔案 | 說明 |
|------|------|
| `tools/sketchup-render-studio/index.html` | 主頁：左右對照、控制列、進階設定 |
| `tools/sketchup-render-studio/app.js` | 前端邏輯（LIFF／dev bypass、批次 API） |
| `tools/sketchup-render-studio/config.js` | `GAS_URL`、`PUBLIC_URL`、`MAX_IMAGES` |
| `tools/sketchup-render-studio/styles.css` | 版面樣式 |
| `spa/Dashboard.js` | HUB 卡片（權限 ≥ 2；外連） |

---

## UI 重點

- 左原圖｜右渲染結果大圖對照
- 下排小圖切換角度；每圖可多版本
- 全域 Prompt ＋「此圖自訂 Prompt」（橘點標示）
- **渲染模式**：保真（預設）／風格美化／自由發揮
- **這些不要動**：天花類型、樑柱顏色、牆面油漆、線條開口、家具擺位（預設全勾；家具不預設加）
- 分析後顯示摘要（天花／樑柱／建議），保真模式不自動套風格
- 雙主按鈕：「只加光線質感」／「依下方設定美化」
- 燈光來源 chips（窗戶自然光、間接照明、嵌燈、燈帶等；**櫃內燈需自行勾選**）
- **這次送出哪一張**：可選原圖或某個渲染版本；狀態列會寫目前送出哪張
- **畫筆**：在送出圖上圈要改的地方；輸出時不要留下筆跡
- 後端基本 prompt：**不加櫃體內側燈、不新增櫃體、不自行加家具**
- 單張渲染／批次渲染（批次一張完成就顯示）

---

## API（accounting-gas）

認證：LIFF 權限 ≥ 2，或 `secret`／`dev_bypass`（後端 `resolveSketchupRenderAuth_`；與 AI 實驗室門檻分開）。

| action | 說明 |
|--------|------|
| `sketchup_render_ping` | 健康檢查、風格／光線預設 |
| `sketchup_render_analyze` | 分析空間與建議參數 |
| `sketchup_render` | 單張渲染 |
| `sketchup_render_batch` | 多圖批次（≤8） |

POST `Content-Type: text/plain;charset=utf-8`，body 為 JSON。

---

## 測試

- 本機：`?dev=1` 或勾選進階「開發 bypass」
- 可覆寫 GAS：`?api=<exec_url>` 或進階設定欄位
