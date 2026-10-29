# 2026-10-29 — 員工待辦／派工緊急回滾（Mantle UI）

## Diff／目的

正式站 `info.tanxin.space/employee-todo/` 進不去：SEC-1（#216）改 LIFF 登入後，LINE 回 **400 invalid url**（`redirectUri`＝`/employee-todo/` 與 `?role=*` 皆被拒）。緊急回滾靜態包至 SEC-1 前 Mantle 版，恢復可開頁。

## 技術

- 還原 `employee-todo/` 至 commit `284e22e`（bundle `index-B0wpJKiW.js`）
- 移除 SEC-1 產物 `index-C8CgDPLv.js`／`index-IAtrLr-6.css`
- `employee-todo-src` 暫保留 SEC-1 源碼；**勿** `npm run build` 覆寫正式靜態包，直到 LINE LIFF Endpoint／Callback 納入 `https://info.tanxin.space/employee-todo/`
- MantleDB v2 `yang-employee-todo-v2-1792379200`：資料仍在（查詢當下 8 tasks、open=0）；**未**以測資或試算表覆寫
- 試算表 `1QfVtsf7…` 為較舊快照（仍見未完成項），與 Mantle 不同步；回滾後仍以 Mantle 為準

## 驗證

- [ ] 正式站 `?role=paigong`／`?role=ende` 不再出現 LINE 400
- [ ] 畫面可載入；同步指向 Mantle v2（禁測資 POST）
- [ ] 截圖 `media/employee-todo-broken-fixed.png`

## 部署

- 分支：`cursor/employee-todo-rollback-liff-2272`
- 方式：合併 `main` → GitHub Pages
