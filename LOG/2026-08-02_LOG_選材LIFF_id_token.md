# 2026-08-02 CODING — 選材 LIFF id_token 傳送修正

## Diff／目的

選材打 project-console 時，正式登入的 id_token 只放在巢狀 `auth`，且 Hub 暫用身分誤讀 `userId`（實際是 `user_id`），易出現「缺少 liff_id_token」。

## 技術

| 檔案 | 說明 |
|------|------|
| `shared/js/accounting_api.js` | `buildMaterialPostBody_` 頂層帶 `liff_id_token`；portal 列表／明細改走同一組裝；Hub 暫用身分讀 `user_id` 且需有 token 或 bypass |
| `designer-material-selection.html` | `accounting_api.js?v=48` |

## 後端依賴

Backend_GAS `project-console`：雙 Channel 驗證 + bypass 探測快取修正（同日 LOG）

## 驗證

1. LINE → 主控台 → 選材：列表／新增正常
2. Network：選材 POST body 頂層有 `liff_id_token`（非 bypass 時）

## 部署

- **未部署**（需明確說部署）
