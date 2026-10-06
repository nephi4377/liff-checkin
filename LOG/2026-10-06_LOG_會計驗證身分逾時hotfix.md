# 2026-10-06｜會計驗證身分 60 秒逾時 hotfix

## Diff／目的

老闆（Yang）從主控台進會計功能選單 → 歷史記帳：`驗證身分` 卡滿 **60.0 秒** 後「連線逾時」。

## 技術

- 前端：`operator_context.js` 網址身分不依賴 sessionStorage；`accounting_api.js`／`accounting_boot.js` 主控台 uid 先暫用進門，`accounting_auth_me` 逾時 20s 且失敗可降級；`index.html`／`ledger_history.html` cache-bust
- 後端：`resolveStaffByUserId_` 預設沿用員工快取（不再每次清）；`auth_me`／稽核寫入失敗不拖垮登入
- SPEC：`19_HUB與會計全域身分傳承.md` 對齊

## 驗證

- `node modules/accounting/tools/test-hub-auth-provisional.js`
- 正式站 auth_me 量測：單次常 10～20s（修前會阻塞進門）；修後應先出選單

## 部署

- liff#103 → Pages 37419660623
- Backend#81 → clasp **@369**（Actions 37419647847）
- 正式站已含 `accounting_api.js?v=77`；auth_me 抽測約 2.8s
