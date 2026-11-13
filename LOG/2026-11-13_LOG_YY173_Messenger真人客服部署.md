# 2026-11-13｜YY-173 Messenger 真人客服正式部署（前端）

## Diff／目的
豪哥核准合併部署 liff-checkin #316：`fb-human-desk.html`＋Hub `#/fb-human-desk`（權限 ≥ 2）。

## 技術
- 合併：`0f1b93a11be2f7bbd4150de80439c42bd67416c1`（Merge #316）
- Pages：[43375016838](https://github.com/nephi4377/liff-checkin/actions/runs/43375016838) **success**
- 正式入口：https://info.tanxin.space/modules/info/fb-human-desk.html  
  Hub：https://info.tanxin.space/#/fb-human-desk（LINE 內開主控台）
- 後端對應：Backend #349／project-console **@692**（先於前端上線）
- 未另跑 upload.bat

## 驗證
- 頁面 HTTP 200，標題「添心設計 · Messenger 真人客服」
- 直開頁會走 LIFF／LINE 登入閘（非 Hub endpoint 時 LINE 回 400＝預期閘門）
- `fb_human_list` 已註冊於正式 GAS（無效 token → LIFF 驗證失敗，非未知 POST）
- **未**對正式客戶真發訊
