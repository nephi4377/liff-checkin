@echo off
:: =================================================================
::               Minimalist CODING Upload Script v1.3
:: =================================================================
:: Features:
:: 1. Perform a local backup.
:: 2. Push all changes to the 'main' branch on GitHub.
:: =================================================================

setlocal
:: [v1.5 核心修正] 參考 deploy.bat 的作法，在腳本開頭切換至 UTF-8 編碼，
:: 這可以從根本上解決所有因編碼不符造成的亂碼與指令執行失敗問題。
chcp 65001 > nul

echo.
echo [Step 1/3] Performing local backup...
set "SOURCE_DIR=%~dp0"
set "BACKUP_ROOT=%~dp0..\BAK"

for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TIMESTAMP=%%i"


set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%"
if errorlevel 1 (
    echo    - ERROR: Failed to create backup directory. Check path and permissions.
) else (
    REM [v1.6 核心修正] 根據您的建議，參考 deploy.bat 的作法，改用更穩定的 xcopy 指令。
    REM 建立一個 exclude.txt 檔案，列出所有要排除的檔案和資料夾。
    echo .git\ > exclude.txt
    echo upload.bat >> exclude.txt
    REM /E 複製所有子目錄(包含空的) /I 如果目的地不存在就建立 /Y 不提示直接覆寫 /EXCLUDE 指定排除列表
    xcopy "%SOURCE_DIR%" "%BACKUP_PATH%\" /E /I /Y /EXCLUDE:exclude.txt > nul
    echo    - Backup folder: %BACKUP_PATH%
    echo    - Backup complete.
)

:: [Step 2/3] Extracting frontend version and preparing commit message...
:: Extract FRONTEND_VERSION from managementconsole.html
for /f "delims=" %%i in ('powershell -Command "(Get-Content '%SOURCE_DIR%\modules\projects\managementconsole.html' | Select-String -Pattern 'var FRONTEND_VERSION = ''(.*?)'';' | ForEach-Object { $_.Matches.Groups[1].Value })"') do set "FRONTEND_SEMVER=%%i"

set "FULL_VERSION=%FRONTEND_SEMVER%-%TIMESTAMP%"
echo    - Frontend Version: %FRONTEND_SEMVER% (Build: %TIMESTAMP%)

echo.
echo [Step 3/4] Committing changes to Git...

:: Ensure we are on the main branch to avoid detached HEAD commits
git checkout main

:: Stage all changes
git add .

:: Create a commit with the full version
git commit -m "Auto-commit %FULL_VERSION%"
echo    - Git commit created.

echo.
echo [Step 4/4] Pushing changes to GitHub...
git push origin main

echo.
echo ==================================================================
echo  ^>^> Upload Complete! Version: %FULL_VERSION% ^<^<
echo =================================================================

:end
pause 
