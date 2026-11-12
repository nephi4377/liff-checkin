# 色號看完工（MVP 原型）

點色號 → 看真實完工空間。僅少數手工掛圖，**未部署**。

## 本機開

倉庫根目錄：

```bash
npx --yes serve@14 -l 8080 .
```

開啟：http://127.0.0.1:8080/modules/info/sample-finish/  
（或直接 `.../sample-finish/index.html`）

若 8080 已被占用，可改用其他埠號，並同步調整瀏覽器網址。

## 圖從哪來

頁面只引用本目錄 `photos/`（精選可公開副本）。  
原型暫存母片在專案 Agent Store：`media/樣本頁完工照/`。  
**不要**把私人 Dropbox 案場路徑寫進本頁。

說明全文見專案文件 `樣本頁連完工照-MVP說明.md`。

## 自動化 smoke

倉庫根目錄先開 `serve@14 :8080`，再執行：

```bash
npx --yes -p playwright@1.49.1 node tools/test-sample-finish.mjs
```

無圖色號由 `fixtures/no-photo-color.json` 經測試腳本 `addInitScript` 注入，正式頁面仍只顯示四色。
