# 2026-11-13 — TX-52 商店訂單縮圖 data URL

## Diff／目的
Hub `#/shop/orders` 在 LINE 仍無商品圖。改新檔 `orders-line.html`，縮圖改經 GAS／photon 轉 data URL 再顯示。

## 技術
- iframe → `modules/shop/orders-line.html?v=26.11.13.5`
- build meta：`26.11.13.5-imgproxy`
- `ShopApi.resolveThumbs`

## 驗證
- [ ] 正式站／LINE：狀態列有 build 字樣且詳情有縮圖
