@echo off
:: [強制修復工具] 重置 Git 並強制覆蓋遠端
chcp 65001 > nul

echo ========================================================
echo  警告：此操作將刪除本地的 Git 歷史紀錄 (版本紀錄)
echo  並將您目前的檔案「強制覆蓋」到 GitHub 上。
echo  您的程式碼檔案 (HTML, JS 等) 不會被刪除，請放心。
echo ========================================================
echo.

:: 1. 嘗試讀取目前的遠端網址 (如果讀不到，請手動輸入)
echo 正在嘗試讀取遠端儲存庫網址...
    set REMOTE_URL=https://github.com/nephi4377/liff-checkin.git

echo.
echo 目標儲存庫: %REMOTE_URL%
pause

echo.
echo [1/5] 清理損毀的 Git 資料庫...
rmdir /s /q .git

echo [2/5] 重新初始化 Git...
git init
git branch -M main

echo [3/5] 設定遠端...
git remote add origin %REMOTE_URL%

echo [4/5] 加入所有檔案...
git add .

echo [5/5] 建立新版本並強制上傳...
git commit -m "Reset repository: Recovered from corruption"
git push -u -f origin main

echo.
echo ========================================================
echo  ✅ 修復完成！
echo  現在您可以刪除此檔案，並繼續使用 upload.bat 了。
echo ========================================================
pause