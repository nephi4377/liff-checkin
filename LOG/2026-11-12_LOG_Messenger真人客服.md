# 2026-11-12｜Messenger 真人客服頁

## 結果
- 新增 `modules/info/fb-human-desk.html`：選對話、顯示最後來訊時間、手動回覆、成功／失敗。
- 主控台 `#/fb-human-desk` 入口（權限 ≥ 2）。
- `?mock=1` 可演練 24h／HUMAN_AGENT／超過七天三種狀態。
- 後端對應 Backend_GAS `fb_human_list`／`fb_human_reply`（另 PR）。
- 正式部署與 Meta 送審留待確認。

## 驗證
- 本機：`npx --yes serve@14 -l 8080 .` → 開 `/modules/info/fb-human-desk.html?mock=1`
- 術語：`SPEC/專有名詞白話對照.md` 補 GAS_Connector_V2／HUMAN_AGENT
