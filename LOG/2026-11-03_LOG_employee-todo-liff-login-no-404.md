# 2026-11-03 派工綠鈕 LINE 登入卡住／誤以為 404

## Diff／目的

外開 `?role=paigong` 點綠色「用 LINE 登入…」後無法完成登入（使用者回報「點進去 404」）。查證：LIFF Endpoint／`redirectUri` 皆指向 `…/modules/projects/employee-todo/?role=…`（正式站 **200**，非路徑 404）；#256 改成**外開也自動 `liff.login`**，取消後 `et-liff-login-attempt-v1` 旗標卡住，綠鈕形同失效。

## 技術

- `sheet-bridge.js`：外開**不**自動 `liff.login`；僅 LINE App 內自動；綠鈕文案恢復「用 LINE 登入同步試算表」；`fromUser` 清旗標後再 login；`redirectUri` 固定 Endpoint 前綴
- `et-build=20261103c`（`build:pwa` 更新 SW precache／`index.html`／`registerSW.js`）
- Endpoint（LINE Console 已設）：`https://info.tanxin.space/modules/projects/employee-todo/`（無需改 Console）

## 驗證

- [x] curl Endpoint／`?role=paigong` → 200；OAuth `redirect_uri`＝Endpoint＋role → access.line.me 登入頁（非 404）
- [x] 本機／Incognito：外開見 Mantle＋綠鈕、不整頁自動跳 LINE；清旗標後點綠鈕進 `access.line.me`
- [ ] 合併 Pages 後：外開點綠鈕進 LINE Login，登入後回派工頁可同步 Sheet
