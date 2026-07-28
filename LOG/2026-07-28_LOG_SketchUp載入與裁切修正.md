# 2026-07-28 LOG — SketchUp 載入 LIFF／圖片裁切修正

## 目的

- 外部瀏覽器開啟時 policy 慢或失敗 →「尚未設定 LIFF」
- 上傳原圖／渲染結果在畫面上被裁切

## 技術

| 項目 | 修正 |
|------|------|
| `config.js` | 新增 `LIFF_ID` 後備 |
| `app.js` | 啟動即用後備 LIFF；policy 快取；載入階段提示；依原圖算 `aspect_ratio` |
| `styles.css` | 對照區改 flex，圖片 `max-width/height` 完整顯示 |
| 後端 prompt | 輸出須同構圖、不裁邊 |

## 部署

- 待 clasp + CODING push
