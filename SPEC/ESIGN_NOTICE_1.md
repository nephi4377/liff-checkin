# 簽約注意事項（ESIGN-NOTICE-1）

客戶 LIFF 逐條確認 18 條裝潢標準規範＋手寫簽名鎖定。正式開關預設關。

## 放置

| 位置 | 理由 |
|------|------|
| 客戶頁 `modules/projects/esign-notice.html` | 與施工進度同屬「案號對客」；沿用客戶 LIFF ID |
| 內容 `modules/projects/data/esign-notice-2025-0922.json` | 版本化資料檔；改版不影響已簽快照 |
| 主控台分頁「簽約注意」於 `designer-customer-finance.html` | 案號明細已有綁定／對客連結；同事可複製連結用官 LINE 回覆傳（不做 PUSH） |
| 後端 `Backend_GAS/project-console/EsignNotice.js` | 與選材同站；重用 ClientPortalAccess 綁定核權 |

## 開關

- Script Property `ESIGN_NOTICE_ENABLED`（預設關）
- `ESIGN_NOTICE_TEST_PROJECTS`（逗號分隔測試案號白名單）

## 驗收（測試）

`node --test tools/test-esign-notice.mjs`
