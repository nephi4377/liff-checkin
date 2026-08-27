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

## 部署
- 備份：`../BAK/CODING_20260828_0046_*`
- 僅 commit：`modules/info/cases/*.html`（25 頁 VideoObject）+ 本 LOG
- 未納入：`.agents`、其他 LOG、草稿 md（已 stash／略過）
