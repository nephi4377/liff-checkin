# 2026-10-29 派工正式站「沒有變」— 換包＋停外開自動 LINE Login

## Diff／目的

正式站已是 #237 Mantle 產物，但外開瀏覽器會被 `sheet-bridge` **自動 `liff.login`** 整頁蓋成 LINE Login，看起來像「沒有變」。再加 SW／CDN 快取可能卡住舊 HTML。

## 技術

- `sheet-bridge.js`：僅 LINE App 內自動登入；外開顯示綠色「用 LINE 登入同步試算表」
- `index.html`：`et-build=20261029c`、資產 `?v=20261029c`、換 build 時清 caches
- `registerSW.js`／`sw.js`：強制 update、`SKIP_WAITING`、precache 納入 `sheet-bridge.js` 並更新 revision

## 驗證

- [ ] push／merge main 後 live HTML 含 `et-build`／`20261029c`
- [ ] 外開 `?role=paigong`（無 preview）可見 Mantle＋登入按鈕，非 LINE Login 白頁
- [ ] 截圖存 artifacts／media
