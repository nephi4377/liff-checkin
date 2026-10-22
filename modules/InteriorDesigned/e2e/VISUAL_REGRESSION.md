# LayoutPlanner 畫面回歸測試

## 測什麼

`e2e/LP_layout-planner.visual.spec.cjs` 會：

1. 載入 `LP_LayoutPlanner.html`
2. 匯入示範配置 `fixtures/lp-walk-keyguard.json`（與鍵盤守衛 E2E 共用，非客戶圖面）
3. 對 **2D**（`#design-canvas`）與 **3D 環繞**（`#lp-3d-viewport`）各截一張基準圖並與 repo 內 snapshot 比對
4. 整段流程結束時確認 **無** `pageerror` 與 `console.error`

## 執行

於 `modules/InteriorDesigned`：

```bash
npm run test:e2e -- e2e/LP_layout-planner.visual.spec.cjs
```

或跑完整模組測試（含 Vitest + 全部 Playwright）：

```bash
npm test
```

## 基準圖位置

`e2e/LP_layout-planner.visual.spec.cjs-snapshots/`

檔名含 Playwright 平台後綴（CI／本機 Linux 為 `-linux.png`）。請在 **與 CI 相同 OS**（GitHub `ubuntu-latest`）更新基準，避免 macOS／Windows 字體與 WebGL 差異。

## 比對容忍度

| 截圖 | 設定 | 說明 |
|------|------|------|
| `lp-demo-2d.png` | `maxDiffPixels: 120`, `maxDiffPixelRatio: 0.01` | 2D SVG／DOM，較嚴 |
| `lp-demo-3d-orbit.png` | `maxDiffPixels: 2500`, `maxDiffPixelRatio: 0.035` | WebGL 抗鋸齒與光照在 headless 下略有像素差，略放寬 |

全域預設見 `LP_playwright.config.cjs` → `expect.toHaveScreenshot`（`animations: 'disabled'` 等）。

## 更新基準圖（刻意改 UI／3D 外觀後）

確認畫面變更為預期，再：

```bash
cd modules/InteriorDesigned
npx playwright test --config LP_playwright.config.cjs e2e/LP_layout-planner.visual.spec.cjs --update-snapshots
```

將 `*-snapshots/*.png` 一併 commit。

## CI 相依

PR **#188**（`CI-TESTS-LIFF-1`）的 workflow 已執行 `npm test --prefix modules/InteriorDesigned`，本視覺測試會隨 e2e 一併跑，**不需另建 CI workflow**。合併順序建議：可先合 #188，或本 PR 合入後由 #188 分支 rebase 以在 PR 上看到綠燈。
