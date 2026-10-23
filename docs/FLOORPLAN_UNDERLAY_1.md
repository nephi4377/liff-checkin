# FLOORPLAN-UNDERLAY-1 — LayoutPlanner 平面底圖

## 現況盤點（main @ 2026-10）

| 能力 | main 既有 | 本任務 |
|------|-----------|--------|
| JPG/PNG 匯入 | `#bg-upload` + data URL 存 JSON | 保留；加壓縮與大小檢查 |
| PDF | 無 | 前端 `pdfjs-dist` 僅轉第一頁，不上傳 |
| 拖曳／滑桿縮放 | 底圖調整模式 | 保留；鎖定時禁用 |
| 兩點比例校正 | 無 | 兩點 + 實際長度 (cm) |
| 旋轉對齊 | 無 | 兩點拉水平 + 手動角度 |
| 透明度／鎖定／隱藏 | 固定 opacity 0.8 | 可調；存 layout |
| undo/redo 還原底圖 | **缺**（`loadState` 未套 background） | 已修 |
| 描牆吸附／正交 | `resolveDrawingPointerPosition` | 沿用；可加精確段長 |
| 報價／ZIP／存圖 | html2canvas 含底圖 | 匯出時暫藏 `#bg-layer` |
| 3D／報價 | 牆來自 `drawnAreas` | 與底圖無耦合 |

## 存檔策略

- 底圖以 **JPEG data URL** 嵌在 layout JSON / localStorage autosave（與既有 `background.src` 相同）。
- 建議上限 **約 3.5MB**（`UNDERLAY_MAX_DATA_URL_BYTES`）；匯入時自動縮邊長與 JPEG 品質。
- **不**上傳 Dropbox／GAS／外部轉檔；PDF 僅在瀏覽器內 rasterize。
- localStorage 滿時 autosave 可能失敗（console 已有提示）；設計師應定期「儲存佈局」下載 JSON。

## UI 流程（設計師）

1. 設定 → 平面圖：選 JPG/PNG/PDF。
2. 勾選「底圖調整模式」拖曳／滾輪縮放；或用「兩點校正」+ 實際長度；「旋轉對齊」使兩點連線水平。
3. 透明度／鎖定／隱藏：編輯時仍可看見（隱藏僅影響作業視覺，資料仍保留）。
4. 繪製牆壁：沿底圖點頂點；可填「下一段長度 (cm)」再點擊以固定段長。
5. 儲存佈局或依 autosave；重開頁還原備份或上傳 JSON。

## A3/A4 出圖（#217）

底圖預設 **不**進報價列印與客戶 ZIP 平面圖。若日後要在 #217 平面出圖顯示底圖，可加 query flag（本 PR 未啟用）。

## 測試

- Vitest：`LP_underlay.test.js`
- Playwright：`e2e/LP_floorplan-underlay.spec.cjs`（示範圖 `e2e/fixtures/demo-floorplan-underlay.png`）
- 預覽：`raw.githack.com/nephi4377/liff-checkin/<sha>/modules/InteriorDesigned/LP_LayoutPlanner.html`
