# 2026-08-13｜客戶 Rich Menu 第 1 波（只掛測試帳）

> **目的**：讓總監用自己的 LINE 看到奶油金四格，點連結驗收。  
> **不做**：官方後台預設選單、全員掛單、自動換六格、自助申請頁。

## Diff／目的

把定案圖稿放到正式站，後端建立四格／六格選單，**只掛黃俊豪**。測完可換回員工選單。

## 技術

| 位置 | 說明 |
|------|------|
| `modules/info/asset/richmenu/*.jpg` | 奶油金＋現況，2500×843，約 200KB |
| `modules/info/customer-richmenu-preview.html` | 預覽頁定案奶油金 |
| `SPEC/專有名詞白話對照.md`、`SPEC/未來開發事項.md` | 四格／六格文案對齊計劃 |

**未納入 git**：`richmenu-preview/bg/` 完工原圖（檔太大）。

## 驗證

- 正式站可開兩張 JPG
- 黃俊豪開官方 LINE → 下方四格
- Facebook 跳出 LINE
- 其他好友選單不變
- 測完執行「換回員工選單」

## 部署

- CODING：`git push origin main`（只加本波檔案，未跑 `upload.bat` 的 `git add .`，以免送出完工原圖）
