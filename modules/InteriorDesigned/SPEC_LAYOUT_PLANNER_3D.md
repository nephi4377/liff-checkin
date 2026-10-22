# LayoutPlanner 3D 檢視 — 設計說明（FLOORPLAN-3D-1）

## 工具位置與 2D 資料結構

- **頁面**：`modules/InteriorDesigned/LP_LayoutPlanner.html`
- **主程式**：`LP_LayoutPlanner.js`（狀態：`placedCabinets`、`drawnAreas` 等）
- **匯出 JSON**（`saveLayout` / ZIP）：`version`、`placedCabinets`、`drawnAreas`、`placedAnnotations`、`workspaceSize`（邊長 cm，畫布 1px = 1cm）、`layerVisibility` 等

### `placedCabinets[]`（平面家具／櫃體／部分牆片元件）

| 欄位 | 說明 |
|------|------|
| `id` | 唯一 id |
| `data` | 來自 Google Sheet：`name`、`group`、`width`／`depth`（cm）、`img`、`adjustable`、`isWall` 等 |
| `x`, `y` | 左上角座標（cm，與畫布 px 同尺度） |
| `rotation` | 度數，繞元件中心 |
| `currentW`, `currentH` | 目前寬、深（cm；2D 的「高」為平面深度） |
| `mirrored`, `opacity`, `note`, `addons`… | 報價／顯示用，3D MVP 不讀 |

### `drawnAreas[]`（使用者繪製區域）

| `type` | 說明 |
|--------|------|
| `wall` | `points[]`（內圈多邊形）、`thickness`（cm）、`pathData`（SVG 雙迴圈） |
| `floor` / `ceiling` | `points[]`、`areaInPing`、`linkedComponent`…；3D 後續階段再鋪面 |
| 門窗 | 多為 Sheet 元件拖入 `placedCabinets`，非獨立牆洞模型 |

座標：原點在畫布左上；**X 向右、Y 向下**（與 SVG 一致）。

---

## 3D 技術選型

| 項目 | 決策 |
|------|------|
| 函式庫 | **[Three.js](https://threejs.org/)**（r170+），以 **ES module CDN** 載入：`three.module.js` + `OrbitControls.js`（`importmap` 或動態 `import()`），不打包進 repo |
| 控制 | **OrbitControls**：左鍵旋轉、右鍵平移、滾輪縮放 |
| 第一人稱漫遊 | **第二階段**（`PointerLockControls` 或自製 WASD + 碰撞簡化） |
| 與 2D 隔離 | 全螢幕 overlay `#lp-3d-overlay`，`body.lp-3d-mode` 時停用 2D 畫布指標事件；關閉 3D 後完全恢復 |

---

## 2D → 3D 對應與預設高度（cm）

| 物件 | 3D 軸 | 預設 |
|------|--------|------|
| 平面 X | Three `X` | `x - workspaceSize/2`（工作區置中） |
| 平面 Y | Three `Z` | `y - workspaceSize/2` |
| 高度 | Three `Y` | 向上為正 |
| 繪製牆 `drawnAreas.wall` | 內圈 + 外擴 `thickness` 形成環狀，**向上拉伸** | **牆高 280**（約 9 尺 2） |
| 櫃體 `placedCabinets` | `BoxGeometry(w, h, d)` | **櫃高 90**（台面／矮櫃）；若 `data.height` 日後加入 Sheet 則優先 |
| 門（`classifyPlacedCabinet3DKind` → `door`） | 平面矩形拉高 | **門高 210**；`group` 為「門窗工程／門片」或名稱含「門」 |
| 窗（→ `window`） | 平面矩形拉高，**窗台離地** | **窗台 90 + 窗高 120**；名稱含「窗／落地窗」等 |
| 牆片元件 `data.isWall` | 同櫃體盒子 | **高 280、色偏灰** |
| 地板 | 薄板 | 第二階段；MVP 僅 **GridHelper** |

門窗分類邏輯見 `LP_3D_scene.js` 的 `classifyPlacedCabinet3DKind`（MVP **不挖牆洞**，僅在 3D 疊加門片／窗框盒子；牆體開洞為階段 3）。

旋轉：櫃體繞 Y 軸 `-rotation°`；中心為 `(x + currentW/2, y + currentH/2)`。

---

## 操作方式（MVP vs 後續）

**MVP（本 PR）**

- 底部列 **「3D 檢視」** ↔ **「2D 平面」** 切換
- 進入 3D 時依當下佈局重建 mesh；離開不修改 2D 狀態
- Orbit：旋轉／縮放；提示列說明操作

**後續**

- 編輯 2D 時若已開 3D：debounce 自動 rebuild 或「重新載入 3D」按鈕
- 門窗開洞（CSG 或替換牆段）
- `floor`/`ceiling` 平面 mesh、材質與層級 `layerVisibility`
- 第一人稱漫遊、行動裝置觸控手勢優化

---

## 效能與風險

- **預期規模**：住宅平面通常 &lt; 200 櫃體、&lt; 20 牆區；Extrude + Box **&lt; 500 mesh** 可即時 Orbit
- **風險**：整面 `ExtrudeGeometry` 牆環在極複雜多邊形可能三角化較慢；超大 `workspaceSize` 時相機 far 需調大
- **CDN**：離線或 CSP 阻擋時 3D 無法載入 → 顯示錯誤提示，2D 仍可用
- **不重現客戶資料**：示範僅用文件內假資料範例，不自動上傳真實佈局

---

## 分階段計畫

| 階段 | 內容 | 驗收 |
|------|------|------|
| **1（本 PR）** | 設計文件、3D 切換、牆環 + 門／窗／櫃體盒子、Orbit | 2D 不變；可旋轉縮放 |
| **2** | 地板／天花、材質、層級顯示、編輯後同步 | 與 `layerVisibility` 一致 |
| **3** | 牆體門窗洞（CSG）、櫃體高度來自 Sheet、截圖匯出 | 與報價元件資料一致 |
| **4** | 第一人稱、效能上限與 LOD | 大案場可流暢漫遊 |

---

## 假資料範例（測試用，無個資）

```json
{
  "version": "2.0",
  "workspaceSize": 2000,
  "placedCabinets": [
    {
      "id": "cab-demo-1",
      "x": 400,
      "y": 600,
      "rotation": 0,
      "currentW": 120,
      "currentH": 60,
      "data": { "name": "範例矮櫃", "group": "系統櫃", "width": 120, "depth": 60 }
    },
    {
      "id": "door-demo-1",
      "x": 500,
      "y": 300,
      "rotation": 0,
      "currentW": 90,
      "currentH": 15,
      "data": { "name": "房門", "group": "門窗工程", "width": 90, "depth": 15 }
    },
    {
      "id": "win-demo-1",
      "x": 700,
      "y": 300,
      "rotation": 0,
      "currentW": 150,
      "currentH": 15,
      "data": { "name": "落地窗", "group": "門窗工程", "width": 150, "depth": 15 }
    }
  ],
  "drawnAreas": [
    {
      "id": "area-demo-wall",
      "type": "wall",
      "thickness": 15,
      "points": [
        { "x": 300, "y": 300 },
        { "x": 900, "y": 300 },
        { "x": 900, "y": 800 },
        { "x": 300, "y": 800 }
      ]
    }
  ]
}
```

實作檔：`LP_3D_scene.js`（純函式）、`LP_3DViewer.js`（Three 場景）。
