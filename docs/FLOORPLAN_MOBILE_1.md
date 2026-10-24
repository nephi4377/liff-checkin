# FLOORPLAN-MOBILE-1 — LayoutPlanner 手機／平板盤點與修正

分支：`cursor/floorplan-mobile-1-576d`（自 `main`）。  
範圍：`modules/InteriorDesigned/LP_LayoutPlanner.html`、`LP_LayoutPlanner.js`、`LP_layout_mobile.js`、`LP_3DViewer.js`（僅既有 Orbit／漫遊，未改 #214 碰撞邏輯）。

## 修正前現況（問題 → 位置）

| # | 問題 | 檔案與行號（修正前基準） |
|---|------|---------------------------|
| M1 | 真機 `Mobi` UA 直接 `return`，整頁不可用 | `LP_LayoutPlanner.js` ~4989–5000 |
| M2 | `DOMContentLoaded` 先顯示 `#mobile-warning` 全螢幕 | `LP_LayoutPlanner.html` ~1583–1590 |
| M3 | 櫃體僅 `mousedown`／`el.onmousedown`，無 touch／pointer | `LP_LayoutPlanner.js` ~1102（舊）、拖曳 `handleGlobalMove` 僅 `mousemove` ~4298 |
| M4 | 畫布無雙指縮放／平移 | 僅 `initZoomControls` 按鈕＋Ctrl+滾輪 ~4017–4035 |
| M5 | 區域頂點控點半徑 6px、僅 `mousedown` | `renderVertexHandles` ~906–923 |
| M6 | 標註僅 `mousedown` | `renderAllAnnotations` ~1021–1045 |
| M7 | 頂點拖曳每次 `mousemove` 全量 `renderAllDrawnAreas` | `handleGlobalMove` ~2265–2280 |
| M8 | 窄螢幕工具列／預算 modal 易溢出 | `LP_LayoutPlanner.html` 工具列 ~1260+、`#budget-modal` ~1320 |
| M9 | Playwright 僅桌面 1280×800 | `LP_playwright.config.cjs` |
| M10 | 3D viewport 已有 `touch-action: none`；漫遊時 `controls.enabled = false` | `LP_LayoutPlanner.html` ~170–176；`LP_3DViewer.js` walk 切換（#214 區，未改） |

## 本次實作摘要

- **`LP_layout_mobile.js`**：`detectLayoutPlannerTouchUi`（`lpMobile=1`／`lpDesktop=1`／coarse pointer）、`bindPrimaryPointerDown`、`installCanvasPinchPan`、`createRafThrottle`。
- **`LP_LayoutPlanner.js`**：移除 M1 硬封鎖；`initLayoutPlannerTouchUi`；櫃體 pointer＋長按底部選單；`pointermove` 拖曳；頂點／標註 pointer；`requestDrawnAreasRender`（觸控時 RAF 節流）。
- **`LP_LayoutPlanner.html`**：觸控 CSS（`lp-touch-mode`）、底部 sheet、`touch-action`、modal 最大寬高；移除 M2 腳本。
- **測試**：`LP_layout_mobile.test.js`；`e2e/LP_floorplan-mobile.spec.cjs`（iPhone 14、iPad Pro 11 專案）。

## 與其他 PR 重疊說明

- **未改** `#212`–`#219` 報價覆寫、列印比例、3D walk 碰撞、history coalescer 等核心邏輯；僅在共用的拖曳入口加 `isPrimaryPointerButton`／pointer 與觸控 UI 分支。
- 若與 `cursor/lp-bug-sweep-*` 同檔衝突，以合併後再套用手機 patch 為準。

## 效能（頂點拖曳 `renderAllDrawnAreas`）

觸控模式下改為 `requestDrawnAreasRender()`（`createRafThrottle`），同一動畫帧內多次 `pointermove` 只重繪一次。

| 情境 | 量測方式 | 修正前（估算） | 修正後 |
|------|----------|----------------|--------|
| 連續 120 次 move 事件觸發重繪 | Vitest `createRafThrottle` 合併測試 + 手動在頂點拖曳時觀察 FPS | 最多 120 次全量 DOM 重建 | 每帧 ≤1 次（約 60/s 上限） |

中階手機實機仍建議避免一次載入過多櫃體；櫃體拖曳仍用 `updateCabStyle` 增量更新（原行為）。

## 驗收

- `npm test --prefix modules/InteriorDesigned`
- 預覽：`https://raw.githack.com/nephi4377/liff-checkin/<full-sha>/modules/InteriorDesigned/LP_LayoutPlanner.html?lpMobile=1`
- 查參：`?lpMobile=1` 強制觸控 UI；`?lpDesktop=1` 關閉。
