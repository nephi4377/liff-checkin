# LP-BUG-SWEEP-2（LayoutPlanner 3D／2D→3D）

**分支**：`cursor/lp-bug-sweep-2-576d`  
**基線**：`main`（#211 已併）  
**排除**：#212–#218 專用區（`LP_3D_snapshot` 房間視線 preset、`LP_2d_print*`、#218 `commitSaveState` 2D history 等）未改；相關疑項見未修表。

## Bug 修正表

| ID | 檔案:約略行 | 重現 | 嚴重度 | 修正 | 測試 |
|----|------------|------|--------|------|------|
| B1 | `LP_3D_scene.js` ~282 `openingCutsWall` | 旋轉門中心在室內、角點貼牆：漫遊可過、CSG 不挖洞 | 高 | 與 `openingAssociatesWithWall` 一致 | Vitest `旋轉門中心在室內…` |
| B2 | `LP_3DViewer.js` ~1481 `dispose` | `viewer.dispose()` 未 `controls.dispose()` | 中 | `controls?.dispose()` | `LP_3DViewer_lifecycle` |
| B3 | `LP_3DViewer.js` ~382 `ensureScene` | WebGL 建立失敗無提示 | 中 | try/catch + `setHint` | e2e 開 3D canvas |
| B4 | `LP_3D_scene.js` ~34 `classifyPlacedCabinet3DKind` | 系統櫃名稱含「門」（如開門高衣櫃）被當門片，3D／碰撞錯 | 高 | 僅在「門窗工程／門片」群組用名稱判門窗 | Vitest `系統櫃名稱含「門」字…` |
| B5 | `LP_3D_scene.js` ~410；`LP_3DViewer.js` ~590 | 2D 鏡像櫃 `mirrored` 開 3D 朝向不符 | 中 | descriptor 帶 `mirrored`；mesh `scale.x=-1` | Vitest `傳遞 2D 鏡像旗標…` |
| B6 | `LP_3DViewer.js` ~125 `buildWallBrush`；`LP_3D_walk_collision.js` | 旋轉門中心在室內：walk 開洞、牆 mesh 仍實心 | 高 | `resolveOpeningCutterCenterOnWall` 對齊 `openingSpanOnEdge` | Vitest `resolveOpeningCutterCenterOnWall` |
| B7 | `LP_LayoutPlanner.js` ~105 `scheduleLp3dRebuild` | 快速關 3D 後 debounce 仍 `rebuild()` | 低 | timer 內再檢查 `lp3dMode`；`closeLayoutPlanner3D` 清 timer | `LP_LayoutPlanner_3d_lazy` 靜態斷言 |
| B8 | `LP_3DViewer.js` `rebuild` | 兩點隔間牆僅碰撞 OBB、orbit 看不到 | 中 | `partitionWalls` 挤出 Box mesh | 沿用 `partitionWalls` descriptor 測試 + 3D e2e |
| B9 | `LP_3DViewer.js` `dispose` | `dispose()` 未釋放 contentGroup／標籤材質 | 低 | `disposeObject3D` + cap material dispose | lifecycle 仍過；與 B2 同檔 |

## 未修項與理由

| 項目 | 理由 |
|------|------|
| `buildLayout3DViewPresetOptions` floors 索引／無地板房間視線 | #214 已修，本 sweep 不碰 `LP_3D_snapshot.js` |
| 2D `selectArea` 牆 path、`loadState` 快照等 | #218 LP-BUG-SWEEP-1 |
| 2D 出圖比例尺／lpBound | #217 |
| 僅 `pointerdown` 觸控拖曳 2D 櫃 | 事件重構範圍大，見 SWEEP-1 |
| 漫遊時窗洞仍擋路徑（walk 不扣窗 span） | 既有設計＋測試預期；要改需產品確認 |
| `webglcontextlost` 自動恢復 | 範圍大；僅 B3 失敗提示 |
| 大平面極端 heap | 既有 `LP_3d-perf` e2e |

## 審查備註（非 bug）

- `rebuild()` 每次 `disposeObject3D` 內容群組；`close()` 不 dispose renderer（session 設計）。
- 無地板時 walk 環取自第一面牆 `inner`；單牆／空平面為降級行為。
- `LP_3D_pixel_rgb` 與 orbit 俯視 e2e 像素驗收一致，本輪無改動。

## 驗證

- 本地 `npm test --prefix modules/InteriorDesigned`（Vitest + Playwright 全 suite）。
- githack：`modules/InteriorDesigned/LP_LayoutPlanner.html`（PR 附 3D 截圖）。
