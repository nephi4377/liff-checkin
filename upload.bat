@echo off
:: =================================================================
::               Minimalist CODING Upload Script v1.3
:: =================================================================
:: Features:
:: 1. Perform a local backup.
:: 2. Push all changes to the 'main' branch on GitHub.
:: =================================================================

:: [v1.3] Switched all output to English to eliminate all encoding issues.
setlocal

echo.
echo [Step 1/3] Performing local backup...
:: [v1.4] Changed paths to English to permanently resolve encoding issues.
:: Please ensure you have manually renamed the folder '程式備份用' to 'CodeBackups'.

:: Use relative paths based on the script's location.
:: %~dp0 is the path of the current script (e.g., D:\Dropbox\CodeBackups\CODING\)
set "SOURCE_DIR=%~dp0"
set "BACKUP_ROOT=%~dp0..\BAK"

for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TIMESTAMP=%%i"


set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%"
if errorlevel 1 (
    echo    - ERROR: Failed to create backup directory. Check path and permissions.
) else (
    :: [核心修正] /XF 參數不應包含完整路徑，否則會將整個來源目錄排除。
    :: 只需提供檔名即可。
    robocopy "%SOURCE_DIR%" "%BACKUP_PATH%" /E /XD .git /XF "upload.bat" > nul
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
