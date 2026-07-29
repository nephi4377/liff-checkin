# 客戶 Rich Menu 測試版（未上線）

> **狀態：未上線** — 僅本機／GAS 手動測試，**未** deploy、**未**設 LINE 後台預設選單。  
> **定稿依據**：[客戶RichMenu_計劃.md](c:/Users/a9999/.cursor/plans/客戶RichMenu_計劃.md)、`SPEC/未來開發事項.md` §4

---

## 改了什麼

| 檔案 | 說明 |
|------|------|
| `backend/project-console/createCustomerRichMenus.js` | **新增** — 建立未綁四格＋會員六格；`linkCustomerRichMenuToTestUser_` 只掛測試 UID |
| `backend/project-console/createRichMenu.js` | 移除舊三格 CUSTOMER；改指向新腳本 |
| `backend/accounting-gas/master/CustomerFinanceModule.js` | `linkCustomerRichMenu_`／`syncCustomerRichMenuForLineUser_`；bind/revoke 回傳 `rich_menu_sync`（**預設關**） |
| `backend/accounting-gas/config_.js` | `RICH_MENU_TEST_MODE`、選單 ID getter |
| `backend/core_library/config.js`、`project-console/config_.js` | `CUSTOMER_GUEST/MEMBER_RICH_MENU_ID` getter |
| `CODING/richmenu-preview/render-richmenus.mjs` | 產出 `customer_guest_richmenu_v1`、`customer_member_richmenu_v1` 預覽圖 |
| `CODING/modules/info/customer-richmenu-preview.html` | **瀏覽器預覽頁**（主要驗收；各格連到客戶／設計師頁） |

---

## 選單與導向（定稿）

**版面**：四格為 **2×2**（上排申請|了解添心、下排 FAQ|FB）；六格為 **3×2**（上排收款|案場|綁定、下排了解添心|FAQ|FB）。圖稿 2500×843。

### 未綁四格

| 格 | 導向 |
|----|------|
| 申請綁定專案 | `LandingPage.html`（P0 占位；P1 換自助申請頁） |
| 了解添心 | `https://info.tanxin.space/modules/info/LandingPage.html`（uri 外開） |
| 常見問題 | `https://info.tanxin.space/modules/info/FAQ.html`（外開） |
| Facebook | `https://www.facebook.com/TainanTanXin`（uri 外開，**禁止 LIFF**） |

### 會員六格

| 格 | 導向 |
|----|------|
| 收款確認 | `https://liff.line.me/2007974938-d2y1uA1G` |
| 我的案場 | 同上 LIFF `?entity=material` |
| 綁定新專案 | 同未綁「申請」占位頁 |
| 了解添心／FAQ／Facebook | 同未綁 |

---

## 總監照做：如何測試（不上線）

### 1. 瀏覽器預覽（主要驗收方式）

打開 **客戶 Rich Menu 預覽頁**（不必 LINE、不必上傳圖）：

| 環境 | 網址 |
|------|------|
| 線上 | https://info.tanxin.space/modules/info/customer-richmenu-preview.html |
| 本機 | `CODING/modules/info/customer-richmenu-preview.html`（或本機 serve 同路徑） |

**三步驗收：**

1. 看「未綁定四格」「會員六格」版面是否為 2×2、3×2。
2. 可改「預覽案號」，點各格 **預覽客人畫面** → 新分頁應開對應頁（收款、案場／選材、落地頁、FAQ、FB 外開）。
3. 下方 **內部視角** 可開設計師選材登記頁。

本頁僅預覽；**正式 LINE 下方選單尚未上線**。

### 2. （選用）產 JPG 圖稿

僅在需要對照 LINE 圖檔或日後上傳 LINE API 時：

```bash
cd CODING/richmenu-preview
npm install
node render-richmenus.mjs
```

會得到 `customer_guest_richmenu_v1.jpg`、`customer_member_richmenu_v1.jpg`（2500×843）。  
**上傳圖到公開 HTTPS 並填進 `createCustomerRichMenus.js`** 是 **日後要在 LINE 掛選單** 才需要，不是日常瀏覽器驗收步驟。

### 3. 在 GAS 建立兩套選單（project-console 專案，選用）

1. 打開 **project-console** Apps Script（勿跑 upload.bat／deploy）。
2. 執行函式 **`createCustomerRichMenus`**。
3. 看執行紀錄，記下兩個 ID（會寫入 Script Properties）：
   - `CUSTOMER_GUEST_RICH_MENU_ID`（四格）
   - `CUSTOMER_MEMBER_RICH_MENU_ID`（六格）
4. **不要**在 LINE 後台設「預設 Rich Menu」，**不要**呼叫 `setDefaultRichMenu`。

### 4. 只對測試 LINE 帳號掛選單（選用，需實機 LINE）

**方式 A — GAS 手動（project-console）**

```javascript
// 執行一次，把 Uxxxxxxxx 換成測試用手機的 LINE UID
linkCustomerRichMenuToTestUser_('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'guest');
// 或會員六格：
linkCustomerRichMenuToTestUser_('Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'member');
```

**方式 B — LINE Developers / curl**

```http
POST https://api.line.me/v2/bot/user/{userId}/richmenu/{richMenuId}
Authorization: Bearer {Channel Access Token}
```

只替換 **你自己的測試 UID**，不要對全體好友批次掛。

### 5. 測 bind 自動換單（選用，預設關）

在 **accounting-gas** Script Properties 設：

| 屬性 | 值 |
|------|-----|
| `RICH_MENU_TEST_MODE` | `true` |
| `CUSTOMER_GUEST_RICH_MENU_ID` | 步驟 2 的四格 ID |
| `CUSTOMER_MEMBER_RICH_MENU_ID` | 步驟 2 的六格 ID |
| `OFFICIAL_LINE_CHANNEL_ACCESS_TOKEN` | 官方 LINE token（與客戶好友同 channel） |

然後在內部頁執行 **`client_portal_bind`**（代綁）→ 應回傳 `rich_menu_sync` 且掛六格；  
**`client_portal_revoke`** 解除最後一筆 → 應掛回四格。

測完請把 `RICH_MENU_TEST_MODE` 改回刪除或 `false`。

### 6. 驗收勾選

**瀏覽器預覽（步驟 1，必做）**

- [ ] 四格 2×2、六格 3×2 標題正確
- [ ] 收款確認 → 客戶預覽頁（`staff_preview=1`）
- [ ] 我的案場 → 客戶預覽且進選材
- [ ] 了解添心／FAQ／FB 連結正確
- [ ] 設計師選材頁可開

**LINE 實機（步驟 3–4，選用、上線前）**

- [ ] 測試帳號下方是四格或六格
- [ ] Facebook 外開（非 LIFF 內嵌）
- [ ] 官方帳號「預設 Rich Menu」仍為空，**全體好友未被改選單**

---

## 還缺什麼（上線前）

| 項目 | 現況 |
|------|------|
| **申請綁定頁** | P0 指 `LandingPage.html` 占位；P1 需客人自助申請頁 |
| **圖稿 HTTPS** | 預覽圖需上傳圖床並更新 `createCustomerRichMenus.js` 兩個 IMAGE_URL |
| **FB URL** | 已用 `https://www.facebook.com/TainanTanXin`（與 fb-post-studio／官網一致）；若粉專改址請更新 `CR_FB_URL_` |
| **待審不換選單** | 現行 `client_portal_bind` 仍寫 `active`；待審流程 P1 再改 |
| **正式上線** | 需總監另指示：deploy、設圖、是否開 `RICH_MENU_TEST_MODE` 或改為正式開關 |

---

## 明確聲明

**本批變更未上線。** 未執行 `upload.bat`、`clasp deploy`、`deploy.bat`；未設定 LINE 官方帳號預設 Rich Menu。
