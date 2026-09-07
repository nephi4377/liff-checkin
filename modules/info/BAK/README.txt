添心設計｜客戶接洽流程備份紀錄

用途：
本資料夾保存 onboardingflow.html 的歷史版本與還原資訊。
BAK 內既有備份原則上只讀，不覆寫、不刪除。

備份紀錄
----------------------------------------
2026-09-07｜舊版客戶接洽流程
正式檔：modules/info/onboardingflow.html
版本：React + Babel + Tailwind CDN 舊版
重構前 Commit：55eb649043d31293d47675eb492ee8843751d9ef
用途：新版發生問題時，可依此 Commit 還原重構前完整版本。

2026-09-07｜新版重構
新版改為原生 HTML / CSS / JavaScript，移除 React、Babel、Tailwind CDN 等外部執行依賴。
正式檔仍為：modules/info/onboardingflow.html

備份規則
----------------------------------------
1. 重要結構修改前，先建立備份或記錄可還原 Commit。
2. BAK 內舊備份不得由自動排程覆寫或刪除。
3. 每次新增備份，在本檔追加日期、檔名/Commit、修改原因。
4. 正式運作檔永遠維持 modules/info/onboardingflow.html。
