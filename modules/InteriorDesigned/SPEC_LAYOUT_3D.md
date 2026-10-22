# LayoutPlanner 3D 檢視方案（LAYOUT-3D）

> 對應程式：`LP_LayoutPlanner.html` / `LP_LayoutPlanner.js` / `LP_core.js`  
> 第一階增量：`LP_layout3d.js`（2D→3D 資料）+ `LP_3dViewer.js`（three.js 唯讀預覽）

## 1. 現有 2D 資料模型（摘要）

### 1.1 座標與單位

| 項目 | 說明 |
|------|------|
| 畫布 | `#design-canvas`，邊長 `workspaceSize`（cm），預設 2000；**1 畫布 px = 1 cm** |
| 平面軸 | `x` 向右、`y` 向下（螢幕座標） |
| 匯出 JSON | `version: '2.0'`，含 `workspaceSize`、`placedCabinets`、`drawnAreas` 等 |

### 1.2 `placedCabinets[]`（家具／門窗／牆片元件）

來自 Google Sheet 拖放，`addCabinet` 建立：

```ts
{
  id: string,
  data: { name, group, width, depth, unitPrice, pricingType, img, isWall?, adjustable?, ... },
  x, y,                    // 左上角 cm
  currentW, currentH,      // 寬、深 cm（可拉伸）
  rotation: 0|90|180|270,
  mirrored: boolean,
  opacity, note, addons, ...
}
```

- **門／窗／牆片**：Sheet 或內建 SVG；`data.isWall` 表示貼牆薄件（2D 以寬×深呈現）。
- **櫃體**：`pricingType` 多為 `width`／`cai` 等，尺寸連動估價。

### 1.3 `drawnAreas[]`（使用者繪製區域）

| type | 欄位 | 3D 用途 |
|------|------|---------|
| `floor` | `points[]`, `areaInPing`, `linkedComponent` | 地板薄片 |
| `ceiling` | 同上 | 天花板薄片（預設高度） |
| `wall` | `points[]`（內圈）、`thickness`（cm）、`pathData`（SVG 雙迴圈） | 牆體環狀 extrude |

牆壁幾何與 2D 相同演算法：`calculateWallPath` → 外圈 `offsetPolygon` + 內圈原始點（見 `LP_LayoutPlanner.js`）。3D 轉換在 `LP_layout3d.js` 複用同等邏輯，避免依賴 DOM。

### 1.4 其他（本階不進 3D）

- `placedAnnotations`：工程標註線／文字  
- `background`：底圖（僅 2D 參考，3D 預設不顯示，避免比例誤導）  
- `constructionArea`：備註文字，無幾何

---

## 2. 3D 技術方案

### 2.1 技術選型

- **three.js**（ES module CDN：`three@0.170` + `OrbitControls`），與現有靜態站一致，不經 bundler。
- **單一資料源**：3D 僅讀取記憶體中 `placedCabinets` + `drawnAreas` + `workspaceSize`，不另存 3D 格式。
- **2D／3D 切換**：底部「3D 預覽」開啟全螢幕 modal；關閉後 2D 狀態不變、不寫入 history。

### 2.2 座標對應（2D cm → 3D world）

- 原點：畫布中心 `(workspaceSize/2, workspaceSize/2)` 對應 world `(0, 0, 0)`。
- `worldX = xCm - origin`，`worldZ = yCm - origin`，**worldY = 高度（cm）**。
- three.js 預設 Y-up；與 2D 俯视一致（北向為 -Z 可視需要，目前不翻 Z）。

### 2.3 預設高度（cm，可於 `LP_3D_DEFAULTS` 調整）

| 物件 | 預設 |
|------|------|
| 牆體 extrude | 280 |
| 一般家具方塊 | 85 |
| 高櫃／衣櫃（名稱含「衣櫃」「高櫃」） | 240 |
| 桌几（名稱含「桌」「茶几」） | 75 |
| `data.isWall` 薄件 | 同牆高，平面厚度取 `min(currentW,currentH)` |
| 地板／天花薄片 | 2 |

### 2.4 幾何策略（唯讀預覽）

1. **地板** `floor`：`Shape` + 薄 extrude（Y=0）。  
2. **天花** `ceiling`：同上，Y = 牆高 - 板厚。  
3. **牆** `wall`：外圈 Shape + 內圈 hole + extrude 至牆高。  
4. **家具**：`BoxGeometry`，中心對齊 2D 矩形中心，Y 軸旋轉 = `rotation`°，`mirrored` → scale.x = -1。

### 2.5 相機與操作

- `PerspectiveCamera` + `OrbitControls`：左鍵旋轉、右鍵平移、滾輪縮放。  
- 初次開啟依場景 bounding box 自動 framing。  
- 關閉 modal 時 `dispose()` 釋放 geometry/material，停止 render loop。

### 2.6 效能

- 單次 `render()` 重建 mesh（預覽開啟時），不每 frame 同步 2D。  
- 家具以 box 代替 SVG 貼圖，降低 draw call。  
- 建議單場景 < 500 box + < 50 牆環；超過可於後續做 instancing／LOD。

### 2.7 手機

- 現行 LP 仍以 UA `Mobi` 全屏阻擋桌面功能；3D modal 僅在桌面流程開啟。  
- 後續若開放平板：OrbitControls 已支援 touch；需放寬 mobile gate 並加大按鈕。

---

## 3. 分階段計畫

| 階段 | 內容 | 狀態 |
|------|------|------|
| **3D-1** | 設計文件、唯讀預覽、單元測試、draft PR | 本 PR |
| 3D-2 | 載入底圖為地面參考（半透明）、門窗開洞（CSG 或貼圖） | 待排 |
| 3D-3 | 3D 與 2D 並排、即時同步（debounce rebuild） | 待排 |
| 3D-4 | 材質／色票對應圖層、匯出 glTF 截圖 | 待排 |
| 3D-5 | 編輯模式（僅高度／牆高 UI，寫回 JSON schema 擴充欄位） | 需規格核准 |

---

## 4. 風險與限制

| 風險 | 說明 | 緩解 |
|------|------|------|
| 高度為推測值 | JSON 無櫃高，3D 用預設方塊 | 文件標示；後續 schema 加 `heightCm` |
| 牆體複雜多邊形 | offset 自交可能異常 | 與 2D 同算法；異常環境略過該牆 |
| CDN 可用性 | three 從 jsdelivr 載入 | 可改 pin 版本或改 self-host |
| 效能 | 超大坪數＋大量家具 | 延後 instancing；預覽前提示 |
| 底圖比例 | 3D 未顯示底圖 | 避免誤以為 3D 已校正比例 |

---

## 5. 本地／預覽試用（不影響 info.tanxin.space）

```bash
cd modules/InteriorDesigned
npx --yes serve@14 -l 8765 .
```

瀏覽 `http://127.0.0.1:8765/LP_LayoutPlanner.html` → 擺放元件或繪製牆／地板 → 點「3D 預覽」。

Cloud Agent / PR 預覽：使用 GitHub Pages 或 Cursor 環境之 **非正式** URL（非 main 部署），僅供 Nephi 驗收。

---

## 6. 測試

- `npm run test:unit`：`LP_layout3d` 2D→3D 轉換  
- `npm run test:e2e`：既有 LP 流程不受 3D 按鈕影響（預設不開 modal）

---

*文件版本：2026-10-22（LAYOUT-3D-1）*
