# 2026-08-25 LOG｜公開案例 sitemap／案例列表可發現性

## 目的
修復／強化 `info.tanxin.space` 公開案例被搜尋引擎發現的路徑。

## 現況確認
- 根目錄 `https://info.tanxin.space/sitemap.xml` 目前已可正常回 200（先前工具端曾見 500，疑為 Pages 建置／快取空窗）。
- `robots.txt` 已允許爬蟲並指向根 sitemap。
- Google `site:` 查詢尚未收錄案例頁（需 Search Console 送 sitemap／請索引後等待）。

## 本輪變更
- 新增 `modules/info/cases/index.html` 案例列表頁（含 ItemList 結構化資料）。
- 同步根目錄與 `modules/info/sitemap.xml`：列入案例列表與全部公開案例頁；移除內部用途的 InviteSheet（不進公開 SEO sitemap）。
- `SQAQ2.html`、`LandingPage.html` 補上案例列表內連。
- `index.html` 增加 `#/cases` 直達案例列表。

## 部署
- 目標：CODING／`liff-checkin` GitHub Pages（`info.tanxin.space`）
- 方式：`upload.bat`（NONINTERACTIVE）→ push `main`
- 日期：2026-08-26
- 上線後請到 Google Search Console 提交 `https://info.tanxin.space/sitemap.xml`，並對案例列表／代表案例「請編入索引」。

## 未做
- 未改正式業務程式、未部署 GAS、未自動提交 GSC。
