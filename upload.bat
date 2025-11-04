@echo off
:: =================================================================
::               極簡版 CODING 上傳腳本 v1.0
:: =================================================================
:: 功能:
:: 1. 執行本地備份。
:: 2. 將所有變更推送到 GitHub 的 main 分支。
:: =================================================================

@chcp 950 > nul
setlocal

echo.
echo [步驟 1/3] 執行本地備份...
set "SOURCE_DIR=D:\Dropbox\程式備份用\CODING"
set "BACKUP_ROOT=D:\Dropbox\程式備份用\BAK"
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TIMESTAMP=%%i"
set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%"
robocopy "%SOURCE_DIR%" "%BACKUP_PATH%" /E /XD .git /XF upload.bat > nul
echo    - 備份資料夾: %BACKUP_PATH%
echo    - 備份完成。

echo.
echo [步驟 2/3] 提交變更到 Git...

:: 確保切換到 main 分支，避免在 detached HEAD 狀態下提交
git checkout main

:: 將所有變更加入索引
git add .

:: 建立一個包含時間戳的提交
git commit -m "Auto-commit at %TIMESTAMP%"

echo    - Git commit 已建立。

echo.
echo [步驟 3/3] 推送變更到 GitHub...
git push origin main

echo.
echo =================================================================
echo  🎉 上傳完成！
echo =================================================================

:end
pause 
