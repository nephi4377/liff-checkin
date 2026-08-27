# 2026-08-28 VideoObject 補 duration（影片 SEO）

## 目的
Google Search Console 影片報表：頁面有索引，但影片索引為 0；VideoObject 常缺 `duration`。

## 變更
- 對 `modules/info/cases/*.html`（不含 index）的 JSON-LD `VideoObject`：
  - 補 `duration`（ISO 8601，自 YouTube 實際片長）
  - 正規化 `contentUrl`／`embedUrl`
  - `thumbnailUrl` 改為陣列（maxres + hq）
- 成功 **25／26**；**#658** 目前僅 playlist、無單支 VideoObject，略過（待有單支網址再補）

## SPEC
公開案例頁無獨立 SPEC 契約；僅 JSON-LD 欄位補強，未改 API／字典。

## #658 單支影片（同日）
- 改為 `Ew03kbqkfAU` 嵌入 + VideoObject（`PT13M47S`）
- sitemap `lastmod` → 2026-08-28；案例列表縮圖改官方影片圖
- 部署後請 GSC「網址檢查」請求編入索引
