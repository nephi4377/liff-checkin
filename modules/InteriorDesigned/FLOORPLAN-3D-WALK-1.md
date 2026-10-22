# FLOORPLAN-3D-WALK-1（2026-10-22）

## 與 PR #191 的關係

- **#191**（`cursor/floorplan-3d-5-audit-b2e9`）為 FLOORPLAN-3D-5 稽核：確認 `main` 已具備牆／門窗 CSG／地板／櫃體標籤，**不重做 3D 幾何**。
- **室內漫遊**實作已在 **#183** 合併至 `main`（`LP_3D_walk.js`、`LP_3DViewer.js` 鳥瞰／室內切換）。本任務在 #191 分支上**補驗收**：預覽連結、測試、文件；PR 目標分支選 **#191**，以便與 3D-5 稽核一併審閱後再進 `main`。

## 功能摘要

| 項目 | 說明 |
|------|------|
| 眼高 | `LP_3D_DEFAULTS.WALK_EYE_HEIGHT_CM` = **160**（約 150–160cm 規格內） |
| 移動 | WASD、方向鍵；速度約 220 cm/s |
| 視角 | 桌機：按住左鍵拖曳；手機：左半屏平移、右半屏轉向 |
| 切回鳥瞰 | 工具列「鳥瞰」 |
| 邊界 | `walkBounds` 多邊形 clamp ＋ **WALK-2** 內牆線段／櫃體圓形碰撞（門洞可過、窗洞不可） |
| 2D 隔離 | 漫遊時移動鍵在 capture 階段處理，不觸發 2D 櫃體快捷（見 `lp-walk-keyguard.json` e2e） |

## 獨立測試連結（不覆蓋正式版）

本機或預覽站：

- `modules/InteriorDesigned/LP_LayoutPlanner_3d_walk_preview.html` → 自動載入 `e2e/fixtures/lp-3d-spec-demo.json` 並進入室內模式
- 等價 query：`LP_LayoutPlanner?lpPreview=1&lpFixture=e2e/fixtures/lp-3d-spec-demo.json&lp3d=walk`（勿用 `.html` 後綴，`serve` 301 會丟失 query）

`lpPreview=1` 會略過自動備份還原提示，避免干擾驗收。

## 測試

- Unit：`LP_3D_walk.test.js` + 既有 3D scene／furniture 測試
- E2E：漫遊切換截圖、URL 預覽、keyguard、#190／#191 既有 3D 回歸

## FLOORPLAN-3D-WALK-2（碰撞）

- 模組：`LP_3D_walk_collision.js`（純函式）＋ `LP_3D_walk.js` 整合。
- 內牆 **inner 環** 線段為障礙；**門**（`kind === 'door'`）在對應牆邊上開缺口可通過；**窗**不開缺口。
- 櫃體／牆片：實際寬深與旋轉的 **OBB**；兩點直線隔間牆（`drawnAreas` 兩點 + 厚度）與 `wallSegment` 同樣走 OBB。
- 身體半徑預設 **20 cm**；佈局內最窄門 &lt; 32 cm 時會縮小（≥ 60 cm 標準門仍用 20 cm）。
- 門洞僅對 `openingCutsWall` 所屬牆邊開缺口（非任意 55 cm 內牆邊）。
- 移動：分步掃描 + 法向推出，分軸有助沿牆滑動；極窄角或高速仍可能短暫貼牆抖動。

## 風險

- 無牆線佈局漫遊時 `walkBounds` 可能為 null，仍可移動但無邊界限制。
- 碰撞為 2D 線段／圓近似，非 mesh；斜牆轉角或門洞邊緣可能卡住，需 Nephi 決定是否加「脫困」按鈕。
- `lpPreview` 僅允許 `e2e/fixtures/` 路徑，勿用於載入客戶佈局。
