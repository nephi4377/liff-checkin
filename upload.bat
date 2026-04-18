@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1

REM =================================================================
REM   Tanxin deploy script v1.6
REM   Step1: robocopy backup to ..\BAK
REM   Step2: git add, commit only if staged changes exist
REM   Step3: git push origin main
REM   Env: set NONINTERACTIVE=1 to skip final pause
REM =================================================================

set "SOURCE_DIR=%~dp0"
cd /d "%SOURCE_DIR%" || (echo [錯誤] 無法切換到腳本目錄 & exit /b 1)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo [錯誤] 目前目錄不是 Git 儲存庫。
    exit /b 1
)

set "BACKUP_ROOT=%SOURCE_DIR%..\BAK"
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd_HHmm')"') do set "TIMESTAMP=%%i"
set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

echo.
echo [Step 1/3] 備份至 BAK（robocopy）...
if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%" 2>nul
robocopy "%SOURCE_DIR%." "%BACKUP_PATH%" /E /R:1 /W:1 /XD .git BAK "_待開發備份_" .vscode node_modules /XF upload.bat exclude_list.txt *.tmp /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 (
    echo    - 警告: 備份可能失敗 ^(robocopy errorlevel !ERRORLEVEL!^)，請檢查磁碟與路徑。
) else (
    echo    - 備份路徑: %BACKUP_PATH%
    echo    - 備份步驟完成。
)

echo.
echo [Step 2/3] Git：checkout / add / commit...
git checkout main 2>nul
if errorlevel 1 (
    echo [錯誤] 無法 checkout main，請手動處理分支狀態。
    exit /b 1
)

git add .

call :ReadFrontendVersion

git diff --cached --quiet
if errorlevel 1 (
    echo    - 目前版本: !VER! ^(時間戳: %TIMESTAMP%^)
    git commit -m "feat(deploy): !VER! at %TIMESTAMP% (Refactored Core)"
    if errorlevel 1 (
        echo [錯誤] git commit 失敗。
        exit /b 1
    )
) else (
    echo    - 無暫存變更，略過 commit ^(版本參考: !VER!^)。
)

echo.
echo [Step 3/3] 推送至 GitHub ^(origin main^)...
git push origin main
if errorlevel 1 (
    echo [錯誤] git push 失敗，請檢查網路與權限。
    exit /b 1
)

echo.
echo ==================================================================
echo    部署流程結束 — 版本: !VER!
echo ==================================================================

if not defined NONINTERACTIVE pause
exit /b 0

:: -----------------------------------------------------------------
:: 從 managementconsole.html 讀取 FRONTEND_VERSION（單行 PowerShell，避免折行斷在 cmd）
:: -----------------------------------------------------------------
:ReadFrontendVersion
set "VER=unknown"
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content 'modules\projects\managementconsole.html' | Select-String -Pattern 'var FRONTEND_VERSION = ''(.*?)'';' | ForEach-Object { $_.Matches.Groups[1].Value })"') do set "VER=%%i"
if "!VER!"=="" set "VER=unknown"
exit /b 0
