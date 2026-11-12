# 2026-11-12｜Messenger 真人客服頁

## 結果
- `fb-human-desk.html`：選對話後顯示最近來訊／回覆；穩定意圖 ID；逾 24h 須勾選未解決；結果不明先查對話再重試；切換對話作廢進行中結果。
- Hub `#/fb-human-desk`（權限 ≥ 2）。
- mock：`?mock=1`、`mock_fail=1`、`mock_unknown=1`、`mock_refresh=1`。
- 正式部署／Meta 送審／真實客戶送訊：不做。

## 驗證
- `npx --yes serve@14 -l 8080 .` → `/modules/info/fb-human-desk.html?mock=1`
- 術語：`SPEC/專有名詞白話對照.md` 補 GAS_Connector_V2／HUMAN_AGENT
