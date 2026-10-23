# FLOORPLAN-3D-ROOM-1（2026-10-23）

## 結論

以 **`cursor/floorplan-integrate-1`（PR #204）** 為基底；**牆體、門窗 CSG 開口、地板、櫃體類別分色與名稱標籤、視線高度室內漫遊** 已在整合分支具備（源自 `main` #183 與後續 #198／#202 等），本任務**不重做**上述實作，僅補：

- 獨立 **3D 房間鳥瞰** 預覽入口：`LP_LayoutPlanner_3d_room_preview.html`（與既有漫遊預覽並列，皆不覆蓋正式 URL）
- e2e：房間預覽連結驗收
- 修正段長標籤 e2e 在畫布 `transform: scale` 下的座標（`#zoom-reset-btn`）

## 功能對照（整合分支已具備）

| 驗收項 | 狀態 | 位置 |
|--------|------|------|
| 牆體（`drawnAreas.wall`） | ✅ | `LP_3D_scene.js`、`LP_3DViewer.js` `buildWallBrush` |
| 門窗開口（窗台約 90cm） | ✅ | `openingCutsWall` + `three-bvh-csg` |
| 地板 | ✅ | `buildSlabMesh`（`floor` 或牆內圈 fallback） |
| 櫃體分色 + 名稱標籤 | ✅ | `LP_3D_furniture.js`、`createLabelSprite`（櫃體） |
| 視線高度漫遊（WASD） | ✅ | `LP_3D_walk.js`、撞牆 `LP_3D_walk_collision.js` |
| 3D 資源釋放 | ✅ | `LP_3D_dispose.js`、#202 lifecycle 測試 |

## 獨立預覽（勿覆蓋正式版）

**遠端（raw.githack.com，完整 commit SHA）** — 勿用 jsDelivr 開 `.html`（常變 `text/plain`）。首次可能出現 rawgit.hack 閘門，點 **Open the page**。

- Orbit（主頁）：`https://raw.githack.com/nephi4377/liff-checkin/7df9c20a3acbfde5bc9fdd6eb0b35685bfa02d52/modules/InteriorDesigned/LP_LayoutPlanner.html?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit`
- Walk（主頁）：`https://raw.githack.com/nephi4377/liff-checkin/7df9c20a3acbfde5bc9fdd6eb0b35685bfa02d52/modules/InteriorDesigned/LP_LayoutPlanner.html?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=walk`
- Stub 捷徑：`LP_LayoutPlanner_3d_room_preview.html` → 上列 orbit

本機（repo 根目錄 `serve` 或 `modules/InteriorDesigned` `:8765`）：

- **房間鳥瞰（本任務）**：`LP_LayoutPlanner_3d_room_preview.html`
- **室內漫遊**：`LP_LayoutPlanner_3d_walk_preview.html`
- 等價 query：`LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=orbit|walk`

`lpPreview=1` 略過自動備份還原；`lpFixture` 僅允許 `e2e/fixtures/`。

## 舊存檔與 2D

- 3D 僅讀 `placedCabinets`／`drawnAreas`／`workspaceSize`，不改 2D 狀態；示範 fixture 與 `SPEC_LAYOUT_PLANNER_3D.md` 假資料一致。

## 測試

- Vitest：3D scene／furniture／dispose／walk／lifecycle（整合分支 89 項）
- Playwright：含 `3D 房間預覽連結`、FLOORPLAN-3D-5 示範佈局、#190 視覺、#202 perf

## 風險

- 未畫牆線的佈局在 3D 仍像「只有方塊」；需載入含 `wall`／`floor` 的 JSON 或示範 fixture。
- 門窗開洞需元件中心落在牆厚帶內。
- 整合分支新 2D UI 見 `docs/FLOORPLAN_INTEGRATE_1.md`「正式版可見、尚未 gate」表。
