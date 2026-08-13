# 2026-08-13｜客戶 Rich Menu 第 1 波（只掛測試帳）

> **目的**：讓總監用自己的 LINE 看到奶油金四格，點連結驗收。  
> **不做**：官方後台預設選單、全員掛單、自動換六格、自助申請頁。

## Diff／目的

把定案圖稿放到正式站，後端建立四格／六格選單，**只掛黃俊豪**。測完可換回員工選單。

## 技術

| 位置 | 說明 |
|------|------|
| `modules/info/asset/richmenu/*.jpg` | 奶油金＋現況，全幅 2500×1686（約佔一半聊天室） |
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

- CODING：`3ec3107` push `origin main`（只加本波檔案，未跑 `upload.bat` 的 `git add .`，以免送出完工原圖）
- 圖稿已可開：https://info.tanxin.space/modules/info/asset/richmenu/customer_guest_richmenu_v1.jpg
- 黃俊豪 LINE 已掛未綁四格（2026-08-13 16:37）
- 同日稍後：標題加大後換圖（仍同一套選單，不重建）
- 晚間：總監要照片放大、維持半幅。縮小格距並拉近實景，重出 JPG 後重建選單再掛測試帳
- 同晚改口：改**全幅 2500×1686**（佔約一半聊天室），圖網址 `?v=full`，重建後再掛測試帳
