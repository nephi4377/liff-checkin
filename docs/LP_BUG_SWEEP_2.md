# LP-BUG-SWEEP-2（LayoutPlanner 3D／2D→3D）

**分支**：`cursor/lp-bug-sweep-2-576d`  
**基線**：`main`（#211 已併）  
**排除**：#212–#218 專用區（`LP_3D_snapshot` 房間視線 preset、`LP_2d_print*`、#218 2D sweep 等）未改；相關疑項見未修表。

## Bug 修正表

| ID | 檔案:約略行 | 重現 | 修正 | 測試 |
|----|------------|------|------|------|
| B1 | `LP_3D_scene.js` `openingCutsWall` | 旋轉門中心在室內、角點貼牆：漫遊／碰撞已 associate，CSG 不挖洞 | 改為與 `openingAssociatesWithWall` 一致 | Vitest `旋轉門中心在室內…`；`LP_3D_walk_collision` 仍過 |
| B2 | `LP_3DViewer.js` `dispose` | `viewer.dispose()` 未 `controls.dispose()`，重開 3D 可能殘留 Orbit 監聽 | `controls?.dispose()` | `LP_3DViewer_lifecycle`；e2e 連點 3D |
| B3 | `LP_3DViewer.js` `ensureScene` | WebGL 建立失敗時無使用者提示 | try/catch + `getContext()` 檢查並 `setHint` | e2e `LP_bug-sweep-2` 開 3D canvas |

## 未修項與理由

| 項目 | 理由 |
|------|------|
| `buildLayout3DViewPresetOptions` floors 索引／無地板房間視線 | #214 已修，本 sweep 不碰 `LP_3D_snapshot.js` |
| 2D `selectArea` 牆 path、`loadState` 快照等 | #218 LP-BUG-SWEEP-1 |
| 2D 出圖比例尺／lpBound | #217 |
| 僅 `pointerdown` 觸控拖曳 2D 櫃 | 事件重構範圍大，見 SWEEP-1 |
| 大平面極端 heap | 既有 `LP_3d-perf` e2e 監控；未見新洩漏 |

## 審查備註（非 bug）

- `rebuild()` 每次 `disposeObject3D` 內容群組；`close()` 不 dispose renderer（lifecycle 測試設計）。
- 無地板時 walk 環取自第一面牆 `inner`（`LP_3D_scene`）；單牆／空平面為預期降級行為。
- `LP_3D_pixel_rgb` 分類閾值與 e2e 像素驗收一致，本輪無改動。

## 驗證

- 本地 `npm test --prefix modules/InteriorDesigned`（Vitest + Playwright 全 suite）。
- githack：`modules/InteriorDesigned/LP_LayoutPlanner.html`（PR 附 Playwright 截圖）。
