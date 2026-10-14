# 2026-10-14｜請款卡住＋客戶 Rich Menu 作品集上線

## Diff／目的

一起上線兩條（硬約束：不動員工／廠商 Rich Menu）：

1. 請款卡住 → 正式路徑用真實員工身分（[#167](https://github.com/nephi4377/liff-checkin/pull/167)）
2. 客戶選單 FAQ→作品集（[#168](https://github.com/nephi4377/liff-checkin/pull/168)＋GAS [#136](https://github.com/nephi4377/Backend_GAS/pull/136)）

## 部署

| 目標 | 結果 |
|------|------|
| liff Pages | [38549072653](https://github.com/nephi4377/liff-checkin/actions/runs/38549072653) success；`7cd9c79` |
| project-console | [38549085792](https://github.com/nephi4377/Backend_GAS/actions/runs/38549085792) @631；選單重建後 @633 |
| accounting-gas clasp | **未改、未部署**（#167 純前端） |

## 驗證

- 正式站 `payment_request.html` 載 `accounting_api.js?v=108`；含 `allowLocalAuthBypassDemo_`
- 預覽頁／圖稿含「作品集」；`?v=portfolio` JPG last-modified 對齊 Pages
- LINE：新客戶 guest／member ID 已寫 Properties；官方預設仍無；員工選單 ID 未變

## 客人掛法

綁定成功逐人掛六格；**未** setDefault（待使用者確認是否要設，有蓋到員工風險則維持現狀）。
