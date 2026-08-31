# 2026-08-31 LOG｜HUB FAQ 改掛新版

## Diff／目的
主控台「客戶常見問答」仍開舊 `FAQ.html`。改為開新版公開 FAQ。

## 技術
- `spa/app.js`：`#/faq` iframe 改 `modules/info/SQAQ2.html`
- `index.html`：版本 `v26.08.31.1`（破快取）
- 主控台卡片、使用教學仍走 `#/faq`，不用改連結
- 舊 `FAQ.html` 未刪
- **SPEC**：無 API／資料字典變更

## 驗證
- [ ] HUB 點「客戶常見問答」出現新版（可搜尋、約 73 題）
- [ ] 不是舊版「客戶常見問答」舊頁

## 部署
- 未部署（等明示）
