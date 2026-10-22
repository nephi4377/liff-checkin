# LayoutPlanner 畫面回歸測試

## 測什麼

`e2e/LP_layout-planner.visual.spec.cjs` 會：

1. 以 Playwright `route` 將 `cdn.tailwindcss.com` 換成本地釘選腳本 `fixtures/tailwindcss.cdn.pinned.js`（避免 CDN 版本漂移與離線失敗）
2. 注入 **Noto Sans CJK** 字型堆疊（與 CI 安裝 `fonts-noto-cjk` 一致）
3. 載入 `LP_LayoutPlanner.html`，匯入示範配置 `fixtures/lp-walk-keyguard.json`
4. **2D**：`expect(page).toHaveScreenshot` 以「地板多邊形＋櫃體」viewport **clip** 截圖（locator 截圖不支援 clip）；**mask** 工具箱、預算面板、底列、toast、頂列說明與尺寸標籤
5. **3D**：開啟環繞檢視，等 `#lp-3d-viewport canvas` 出現後 **連續兩次 `requestAnimationFrame`** 再截 `#lp-3d-viewport`
6. 整段流程結束時確認 **無** `pageerror` 與 `console.error`（僅略過 CDN **載入失敗** 類訊息，見 `lp-visual-helpers.cjs`）

示範 JSON 的 `drawnAreas` 須含 **`areaInPing`**（與繪製完成時相同算法）；缺欄位時標籤會顯示「NaN 坪」，屬匯入資料不完整；`loadLayoutFromData` 目前不會自動重算坪數。

## 執行

於 `modules/InteriorDesigned`（建議先安裝字型，見下）：

```bash
npm run test:e2e -- e2e/LP_layout-planner.visual.spec.cjs
```

或跑完整模組測試（含 Vitest + 全部 Playwright）：

```bash
npm test
```

### 字型（與 CI 對齊）

基準圖應在 **GitHub Actions `ubuntu-latest` + `fonts-noto-cjk`** 產生。本機 Linux 請：

```bash
sudo apt-get install -y fonts-noto-cjk
fc-cache -f
```

未安裝時，2D 中文標籤可能與 CI 基準相差數千像素。

## 基準圖位置

`e2e/LP_layout-planner.visual.spec.cjs-snapshots/`

檔名含 Playwright 平台後綴（CI／本機 Linux 為 `-linux.png`）。**請只在與 CI 相同環境**（`ubuntu-latest`、已裝 `fonts-noto-cjk`、Chromium headless）更新基準，勿在 macOS／Windows 產生 snapshot。

建議流程：在 PR 的 **LayoutPlanner tests** workflow 綠燈環境下，於該 runner 類型本機或透過 CI 產物更新後 commit `*-snapshots/*.png`。

## 比對容忍度

| 截圖 | 設定 | 說明 |
|------|------|------|
| `lp-demo-2d.png` | `maxDiffPixels: 150` | 2D 幾何 clip 區；僅像素上限（不併用 ratio） |
| `lp-demo-3d-orbit.png` | `maxDiffPixelRatio: 0.028` | WebGL headless 略放寬；僅比例上限 |

全域預設見 `LP_playwright.config.cjs` → `expect.toHaveScreenshot`（`animations: 'disabled'` 等）。CI 下 `retries: 1`。

## 更新基準圖（刻意改 UI／3D 外觀後）

確認畫面變更為預期，並已安裝 `fonts-noto-cjk`，再：

```bash
cd modules/InteriorDesigned
npx playwright test --config LP_playwright.config.cjs e2e/LP_layout-planner.visual.spec.cjs --update-snapshots
```

將 `*-snapshots/*.png` 一併 commit。

## CI 相依

PR **#188**（`CI-TESTS-LIFF-1`）的 `layout-planner-tests.yml` 執行 `npm test --prefix modules/InteriorDesigned`。合入前請在該 workflow 加上安裝字型步驟，例如：

```yaml
- name: Noto CJK fonts (visual regression)
  run: sudo apt-get update && sudo apt-get install -y fonts-noto-cjk
```

（置於 Playwright e2e 之前。）本視覺測試隨 e2e 一併跑，**不需另建 workflow**。
