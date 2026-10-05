# 2026-10-05｜快審→待付款請款 pending 照片「驗證失敗」

## 目的
主控台→單據快審→請款帶 `pending` 時，帶圖失敗勿開致命「驗證失敗」；Hub 身分明確帶 `user_id`。

## 變更
- `modules/accounting/payment_request.html`：`loadPendingPhotos` 失敗改 `setWarn`；成功提示張數；Hub `user_id`／`auth.user_id`
- 後端（另 PR）：`accounting_pending_photos` 接受 Hub `user_id`

## 驗證
- 正式站 HTML 已含「無法自動帶入快審單據照片」「已帶入快審單據照片」
- 真人：楊婕妤主控台→快審→請款→應自動帶圖（待測）

## 部署（已上線）

- 2026-10-05：merge [liff-checkin#96](https://github.com/nephi4377/liff-checkin/pull/96) `db77e46`（功能 `6faf44c`）
- Pages [`37272036993`](https://github.com/nephi4377/liff-checkin/actions/runs/37272036993) **success**
- 後端：[Backend_GAS#74](https://github.com/nephi4377/Backend_GAS/pull/74) `d3b3038` → **@359**
