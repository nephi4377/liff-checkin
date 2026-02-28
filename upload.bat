@echo off
setlocal
chcp 65001 > nul

:: =================================================================
::               添心設計：高品質部署腳本 v1.5 (精鍊版)
:: =================================================================
:: 1. 執行精確路徑備份 (排除 _待開發備份_ 與無效文件)
:: 2. 自動同步至 GitHub main 分支
:: =================================================================

echo.
echo [Step 1/3] 執行精確備份 (排除無效檔案)...
set "SOURCE_DIR=%~dp0"
set "BACKUP_ROOT=%~dp0..\BAK"

:: 獲取時間戳記
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmm')"') do set "TIMESTAMP=%%i"
set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%" 2>nul
if errorlevel 1 (
    echo    - 警告: 無法建立備份目錄，請檢查權限。
) else (
    REM 使用精確排除清單執行備份
    xcopy "%SOURCE_DIR%*" "%BACKUP_PATH%\" /E /I /Y /EXCLUDE:%SOURCE_DIR%exclude_list.txt > nul
    echo    - 備份路徑: %BACKUP_PATH%
    echo    - 備份完成。
)

echo.
echo [Step 2/3] 準備 Git 變更...
cd /d "%SOURCE_DIR%"

:: 檢查 Git 狀態
git checkout main
git add .

:: 提取版本號 (從 managementconsole.html)
for /f "delims=" %%i in ('powershell -Command "(Get-Content 'modules\projects\managementconsole.html' | Select-String -Pattern 'var FRONTEND_VERSION = ''(.*?)'';' | ForEach-Object { $_.Matches.Groups[1].Value })"') do set "VER=%%i"

echo    - 目前版本: %VER% (編譯時間: %TIMESTAMP%)
git commit -m "feat(deploy): %VER% at %TIMESTAMP% (Refactored Core)"

echo.
echo [Step 3/3] 推送至雲端 (GitHub)...
git push origin main

echo.
echo ==================================================================
echo  >> 部署流程結束！版本: %VER% <<
echo ==================================================================
pause
