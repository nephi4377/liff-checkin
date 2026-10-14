# 2026-10-14｜客戶 Rich Menu：常見問題 → 作品集

## 決策

未綁四格、會員六格原本的「常見問題／FAQ」格，改成 **作品集**，點了外開官網：

`https://tanxin.space/portfolio/`（帶 `openExternalBrowser=1`，與 Facebook 同為跳出 LINE）

## 改了什麼（本 repo）

| 項目 | 說明 |
|------|------|
| 預覽頁 | `modules/info/customer-richmenu-preview.html` 文案與連結 |
| 圖稿腳本 | `richmenu-preview/render-richmenus.mjs` 標題／副標 |
| 正式站圖 | `modules/info/asset/richmenu/customer_*_richmenu_v1.jpg` 已重產 |
| SPEC | `未來開發事項.md`、`專有名詞白話對照.md` 對齊 |

後端熱區／URI：見 Backend_GAS `project-console/createCustomerRichMenus.js`（另 PR）。

## LINE 側還要做什麼（未部署、需人工）

1. **先把前端圖稿推到正式站**（Pages），確認 JPG 可開且 `?v=portfolio`。
2. GAS 推送／部署 `createCustomerRichMenus.js` 後，執行 **`createCustomerRichMenus`**（會**新建**兩套選單、寫入新 ID）。  
   - 只跑 `refreshCustomerRichMenuImages` **不夠**：那只換圖，**不會**改點擊網址。
3. 有掛過舊選單的人（測試帳／已綁會員）要**重新掛**新 ID（`#測試選單 四格／六格` 或對應 link 函式）。
4. `config_.js` 裡的預設選單 ID fallback 若仍寫舊 ID，部署後應一併更新為新 ID（或靠 Script Properties）。
5. **不要**設官方預設選單（既有政策不變）。

## 驗證（本環境）

- 已重跑 `node render-richmenus.mjs`，JPG 複製到 `modules/info/asset/richmenu/`
- 預覽頁 `data-key="portfolio"` → `tanxin.space/portfolio/`
