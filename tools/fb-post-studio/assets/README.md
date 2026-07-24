# FB 發文工作室 — 資產與第三方說明

## LOGO／貼圖

### 為什麼不能完美讀所有 `.ai`？

瀏覽器**無法執行完整 Illustrator 引擎**。  
本工具「一鍵轉透明 PNG」僅在下列情況盡力處理：

| 來源 | 行為 |
|------|------|
| **PNG／SVG／WebP** | 轉成 PNG；PNG／SVG 保留透明 |
| **JPG** | 盡力把近白底變透明（邊緣可能不乾淨） |
| **PDF 相容 `.ai`／PDF** | 用 pdf.js 渲第一頁再近白去背 |
| **舊式／複雜 `.ai`** | **失敗** → 清楚提示：請用 Illustrator 匯出透明 PNG |

**美編主檔仍建議保留 `.ai`**；發文疊圖用匯出的透明 PNG（長邊建議 ≥2000px）。

### 貼圖素材庫

- 存本機 **IndexedDB**（失敗則退 **localStorage**）
- 可加分類標籤；點素材即可套用為精修步驟的 LOGO／貼圖
- 上限見 `config.STICKER_MAX`

### 內建檔

- `logo.svg`／`logo.png`：開發用 placeholder，非正式品牌檔

---

## 短影音（ffmpeg.wasm）

- **不要**把 `ffmpeg-core.wasm` 等巨大 binary 塞進 git  
- 執行時由 CDN 載入（`config.REEL.FFMPEG_*`，預設 unpkg）  
- 本機／公司網若擋 CDN → 合成會失敗並**降級 WebM**，畫面上有說明  
- 內建 BGM 為瀏覽器**程序生成**的輕量音，非商用曲庫；正式發文請自行確認授權或改上傳自有音檔

---

## 原則

- 品牌字／LOGO／貼圖 → Canvas 疊真實 PNG／SVG（或轉換後的 PNG）  
- **不要**要求 Gemini 在圖上畫品牌字樣  
