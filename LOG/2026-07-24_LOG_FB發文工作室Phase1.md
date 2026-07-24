# 2026-07-24 LOG — FB 發文工作室 Phase 1 部署

## Diff／目的

上線「FB 發文工作室」Phase 1：上傳完工照 → AI 產繁中文案／改圖 → Canvas 裁切疊 LOGO → 人工貼粉專。HUB 入口（權限 ≥ 3）。

## 技術

| 區 | 內容 |
|----|------|
| 前端 | `tools/fb-post-studio/`（`index.html`／`studio.js`／`config.js`／`assets/`） |
| HUB | `spa/Dashboard.js` 卡片 → `https://info.tanxin.space/tools/fb-post-studio/` |
| SPEC | `21_FB_POST_STUDIO_SPEC.md`；資料字典 §8.3；檔案清冊 tools 列 |
| 後端（另倉） | accounting-gas：`FbPostStudio.js`、`WebApp.js`（`fb_post_ping`／`generate`／`edit_image`） |

## 驗證

1. 開正式網址可載入頁面  
2. 上傳圖 → 生成文案／改圖（需權限 ≥ 3 或對應驗證）  
3. 採用圖 → 裁切／疊 LOGO → 下載 JPG；複製文案  
4. 備註：`assets/logo.png` 若未放真實檔，會 fallback `logo.svg` placeholder  

## 部署紀錄

| 項目 | 值 |
|------|-----|
| 狀態 | 待 `upload.bat`（NONINTERACTIVE） |
| 預期 BAK | `../BAK/CODING_YYYYMMDD_HHmm_<電腦名>/` |
| 預期 URL | `https://info.tanxin.space/tools/fb-post-studio/` |
