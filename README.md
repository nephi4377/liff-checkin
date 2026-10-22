# liff-checkin
添心設計 LIFF 打卡系統前端頁面

## 開發環境

### 安裝

- 根目錄：`npm ci`
- LINE Rich Menu 圖片工具：`npm ci --prefix richmenu-preview`
- 室內設計工具：`npm ci --prefix modules/InteriorDesigned`
- 第一次跑瀏覽器測試時，需在 `modules/InteriorDesigned` 執行 `npx playwright install chromium --with-deps`

### 啟動

- 主控台首頁：`npx --yes serve@14 -l 8080 .`，開啟 `http://127.0.0.1:8080/`
- 室內設計工具：`npm run serve --prefix modules/InteriorDesigned`，開啟 `http://127.0.0.1:8765/LP_LayoutPlanner`

### 驗證

- 室內設計工具完整測試：`npm test --prefix modules/InteriorDesigned`
