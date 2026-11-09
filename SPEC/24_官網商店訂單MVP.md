# 官網商店訂單 MVP（骨架）

> 狀態：Slice 1 前端骨架 + Slice 2 prep（後端 stub）。Woo 為訂單真相來源。  
> 詳細產品規則：Project store `docs/shop-order-backend-plan.md`

## 白話流程

```
客人在 LINE 選購 → 取得訂單編號 → 收到「需付款」通知 → 在 LINE 付款
→ 員工在 Hub 人工「標記已付款」（付款成功不會自動改狀態）
→ 未標記已付款超過 7 天 → 訂單到期刪除
```

## 程式對照表

| 白話（圖上） | 程式對照 |
| --- | --- |
| 員工看訂單列表／標記已付款 | `modules/shop/orders-admin.html`；Hub `#/shop/orders`；`ShopApi.markPaid` |
| 客人 LINE 下單／自查／付款頁 | `customer-shop.html`／`customer-orders.html`／`customer-pay.html` |
| 前端 API 契約（可 mock） | `shared/js/shop_api.js` |
| 後端標記已付款 | Backend_GAS `shop-orders` → `shop_orders_mark_paid` |
| 設定（等人工貼值） | `CONFIG.SHOP_GAS_WEB_APP_URL`、`SHOP_CUSTOMER_LIFF_ID`；GAS `WOO_*` |

## 硬規則（鎖定）

1. 每筆有**訂單編號**  
2. 付款成功 **≠** 自動改狀態  
3. 員工後台變更＝**標記已付款**  
4. 未付且未標記已付款：**7 天**到期刪除  
5. 不自建商品庫；不做自動退刷  

## 部署注意

- 前端：合併 main → GitHub Pages（`info.tanxin.space`）  
- 後端：`shop-orders` **尚無** `.clasp.json`／Web App；程式進 Git 後仍須另建 GAS 專案並設 `WOO_*`（勿自行捏造金鑰）
