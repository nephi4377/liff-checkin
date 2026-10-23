# LP-BUG-SWEEP-1（LayoutPlanner 真 bug 修正）

**分支**：`cursor/lp-bug-sweep-1-576d`  
**基線**：`main`（#211 已合併）  
**排除**：#212／#213／#214／#217 專用檔（`LP_3D_snapshot.js`、`LP_2d_print*` 等）未改，避免 draft 衝突。

## Bug 修正表

| ID | 檔案:約略行 | 症狀 | 修正 | 測試 |
|----|------------|------|------|------|
| B1 | `LP_LayoutPlanner.js` `selectArea` | 點牆體（SVG path）時 `querySelector('polygon')` 為 null 拋錯 | 改 `renderAllDrawnAreas()` + `renderVertexHandles` | e2e `點選牆體區域不拋錯` |
| B2 | `LP_LayoutPlanner.js` `loadState` | Undo 未還原 background／`quotationManualOverrides`／`layerVisibility` | 與 `loadLayoutFromData` 對齊還原並刷新 UI | e2e `復原還原施工面積`（history 路徑）；B2 欄位同快照 |
| B3 | `LP_LayoutPlanner.js` `endDrag` | 底圖拖曳結束未 `saveState`，無法復原 | `wasDraggingBg` 時 commit | 手動／與 B2 同 stack 驗證；見未修觸控 |
| B4 | `LP_LayoutPlanner.js` `groupSelectedCabinets` | 子集再群組時舊 `layoutGroupId` 殘留 | 先解散 touched 群組再指派新 id | 程式審查；#214 無重疊 |
| B5 | `LP_LayoutPlanner.js` Delete | 多選時只刪 `selectedCabId` | `deleteSelectedCabinets()` | e2e `多選兩櫃 Delete` |
| B6 | `LP_LayoutPlanner.js` `renderSingleArea` | 舊檔牆體無 `pathData` 無法繪製／點選 | 載入時補 `calculateWallPath` | e2e `點選牆體區域`（`lp-bug-sweep-wall-only.json`） |

## 未修項與理由

| 項目 | 理由 |
|------|------|
| 櫃體僅 `mousedown` 無 `pointerdown`（觸控拖曳） | 需較大事件重構；手機仍以 LINE 提示為主（見 `AGENTS.md`） |
| #214 `buildLayout3DViewPresetOptions` floors 索引 | 已在 PR #214 修，本 sweep 不碰 `LP_3D_snapshot.js` |
| #217 2D 出圖 | 新功能分支，非 main bug |
| 坪數／3.3058 換算 | 依任務維持現行 |

## 效能觀察（大平面）

- `lp-perf-large` fixture（27 櫃）既有 e2e `LP_3d-perf`：反覆 2D↔3D heap／RAF 穩定（main／#211）。
- `renderAllDrawnAreas` 在 `selectArea` 多呼叫一次全量重繪：牆體點選瞬間成本可接受；若未來卡頓可改為僅更新選取樣式。

## 驗證

- Vitest + Playwright 全 suite（見 PR CI）。
- githack：`LP_LayoutPlanner_3d_room_preview.html`（牆體點選與 3D 無關，2D 用本地 e2e）。
