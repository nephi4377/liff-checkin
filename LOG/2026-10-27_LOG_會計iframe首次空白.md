# 2026-10-27｜會計 iframe 點開空白需重開

| Diff／目的 | 主控台點會計（含請款審核）偶發無畫面，重開才有 |
| 根因 | (1) `iframeMountReady` 在「僅有員工名單」時先以 permission=1 掛上，真 permission 到達改 query → IframeView `about:blank` 重掛卡空白；(2) loading 時 iframe 被 `hidden`，load 事件遺失則永遠空白；(3) 未就緒時主區無任何載入提示 |
| 技術 | `spa/app.js` 等 `currentUser`＋「準備會計模組」；`IframeView.js` overlay／雙 rAF／8s 安全逾時；`accounting_shell.js` rAF 重掛；cache bust `app.js?v=26.10.27.1`、`shell?v=12` |
| 驗證 | `node modules/accounting/tools/test-spa-iframe-remount.js`、`test-shell-iframe-remount.js` |
| 部署 | merge → GitHub Pages |
