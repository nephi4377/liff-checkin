@echo off
:: =================================================================
::               極簡版 CODING 上傳腳本 v1.2
:: =================================================================
:: 功能:
:: 1. 執行本地備份。
:: 2. 將所有變更推送到 GitHub 的 main 分支。
:: =================================================================

:: [v1.2] 在腳本最開頭強制使用繁體中文編碼頁(950)，以正確處理包含中文的檔案路徑。
@chcp 950 > nul
setlocal

echo.
echo [Step 1/3] Performing local backup...
set "SOURCE_DIR=D:\Dropbox\程式備份用\CODING"
set "BACKUP_ROOT=D:\Dropbox\程式備份用\BAK"
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TIMESTAMP=%%i"
set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%"
:: [v1.1] 修正 robocopy 的 /XF 參數語法，需提供完整路徑。
robocopy "%SOURCE_DIR%" "%BACKUP_PATH%" /E /XD .git /XF "%SOURCE_DIR%\upload.bat" > nul
echo    - Backup folder: %BACKUP_PATH%
echo    - Backup complete.

echo.
echo [Step 2/3] Committing changes to Git...

:: 確保切換到 main 分支，避免在 detached HEAD 狀態下提交
git checkout main

:: 將所有變更加入索引
git add .

:: 建立一個包含時間戳的提交 (使用 PowerShell 產生的 TIMESTAMP)
git commit -m "Auto-commit at %TIMESTAMP%"

echo    - Git commit created.

echo.
echo [Step 3/3] Pushing changes to GitHub...
git push origin main

echo.
echo =================================================================
echo  🎉 Upload complete!
echo =================================================================

:end
pause 
