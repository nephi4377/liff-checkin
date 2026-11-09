# 官網商店訂單 MVP（骨架）

> 狀態：Slice 3 兩段報價／匯款（Hub mock + 真 API stage）。Woo 為訂單真相來源。  
> 詳細產品規則：Project store `docs/shop-order-backend-plan.md`

## 白話流程

```
客人官網下單 → 取得訂單編號（待報價／未成立）
→ 員工報運費並寄匯款說明（待匯款／未成立）
→ 客人匯款 → 員工確認收款 →「標記已付款」＝訂單成立
→ 未標記已付款超過 7 天 → 訂單到期刪除
```

## 程式對照表

| 白話（圖上） | 程式對照 |
| --- | --- |
| 員工看訂單／報價／確認收款 | `modules/shop/orders-admin.html`；Hub `#/shop/orders`；`ShopApi.quoteAndNotifyTransfer`／`markPaid` |
| 客人 LINE 自查／付款頁 | `customer-orders.html`／`customer-pay.html`（下單以官網 Woo 為準） |
| 前端 API 契約（可 mock） | `shared/js/shop_api.js`（`?shop_mock=1` 示意三態） |
| 後端報價／標記已付款 | Backend_GAS `shop-orders` → `shop_orders_quote_and_notify_transfer`／`shop_orders_mark_paid` |
| 設定 | `CONFIG.SHOP_GAS_WEB_APP_URL`；GAS `WOO_*`、`SHOP_BANK_TRANSFER_TEXT` |

## 硬規則（鎖定）

1. 每筆有**訂單編號**  
2. 匯款／付款成功 **≠** 自動改狀態；**標記已付款**才成立  
3. 報價前不寄匯款帳戶；報價後才 Notify #2  
4. 未付且未標記已付款：**7 天**到期刪除  
5. 不自建商品庫；不做自動退刷  

## 部署注意

- 前端：合併 main → GitHub Pages（`info.tanxin.space`）  
- 後端：`shop-orders` **已部署 Web App；`WOO_*` Script Properties 已設定（值不進 Git）；前端已接 `SHOP_GAS_WEB_APP_URL`
