# FLOORPLAN-3D-5 稽核報告（2026-10-22）

## 結論

**`main` 已具備任務 (a)～(d) 所列能力，本次不重做 3D 實作。**  
線上站 `https://info.tanxin.space/modules/InteriorDesigned/LP_LayoutPlanner.html` 的 `LP_3DViewer.js` 與 repo `main` 一致（含 `buildWallBrush`、CSG 開洞、地板薄板、類別上色與櫃體標籤）。

Nephi 反映「只有素色方塊」較可能來自：**未在 2D 繪製牆線／未載入含 `drawnAreas.wall` 的佈局**，或門窗元件中心不在牆帶內（開洞與牆體造型不會出現）。見下方差距與操作說明。

## 驗收項目對照

| 項目 | 狀態 | 實作位置 |
|------|------|----------|
| (a) 2D 牆線 → 有高度牆體 | ✅ | `LP_3D_scene.js` `buildLayout3DDescriptor`；`LP_3DViewer.js` `ExtrudeGeometry` + 牆高 280cm |
| (b) 門窗牆上開口（窗台 90cm） | ✅ | `openingCutsWall` + `three-bvh-csg` 差集；窗 `baseYCm` 90、高 120 |
| (c) 地板面 | ✅ | `drawnAreas.floor` 或牆內圈 fallback → `buildSlabMesh` |
| (d) 櫃體類別上色 + 名稱 | ✅ | `LP_3D_furniture.js`；`createLabelSprite` 僅 **櫃體**（`kind === 'cabinet'`） |

## 相關 commit（`main`）

- `1529c9f` — 3D MVP（方塊時代起點）
- `72df58d` / `67aa7ef` — 門窗分類、牆洞 CSG（FLOORPLAN-3D-1/2）
- `da35bdf` — 地板／天花、室內行走、全螢幕 UI
- `4ba0926` — 行走模式與 2D 快捷鍵隔離

## 已知限制（PR 不需重寫程式，但需 Nephi／設計師知悉）

1. **牆體依 `drawnAreas` 的 `wall` 多邊形**；只放櫃體、不畫牆時，3D 主要是格線 + 方塊家具（舊體感）。
2. **門窗開洞**需元件落在牆厚帶內；名稱／群組需符合 `classifyPlacedCabinet3DKind`（或右側「3D 類型」手動覆寫）。
3. **標籤**僅櫃體；門窗無文字標籤。
4. **`layerVisibility`** 尚未同步 3D 顯示。
5. **材質**為簡化 PBR／色塊，非寫實渲染。
6. **室內行走**已存在（WASD），但無碰撞／視線高度可調等進階漫遊。

## 與未合併 PR 可能衝突

- **#184 / #187**（2D）：若改 `LP_LayoutPlanner.js` 的 `saveState`／`drawnAreas`／`placedCabinets` 結構，可能影響 `buildLayout3DDescriptor` 輸入。
- **#186**（報價匯出）：通常不碰 3D 檔；若共用 `placedCabinets` 欄位仍需注意。

## 測試

- 單元：`LP_3D_scene.test.js`、`LP_3D_furniture.test.js` 等（18 passed）。
- E2E：`e2e/LP_layout-planner.spec.cjs`（含本 PR 新增「示範佈局」案例與截圖）。
- 示範資料：`e2e/fixtures/lp-3d-spec-demo.json`（與 `SPEC_LAYOUT_PLANNER_3D.md` 假資料一致，無個資）。

## 建議下一步（需 Nephi 決定）

1. **產品定位**：給客戶展示 vs 設計師自查 → 是否加「一鍵載入 3D 示範／教學」、是否強制提示「請先完成牆線」。
2. **是否部署溝通**：功能已在 `main` 與 info 站；若內部仍見舊版，查 CDN／快取或是否用不同 URL。
3. **功能優先序**：門窗標籤、`layerVisibility` 同步、Sheet `height`、3D 截圖匯出、碰撞漫遊。

## 獨立測試方式（不覆蓋正式版）

沿用正式 `LP_LayoutPlanner.html`，**載入佈局** → 選 `e2e/fixtures/lp-3d-spec-demo.json`（或本機 `npm test` 產出之 artifact 截圖流程）。無需另開平行 HTML 產品頁。
