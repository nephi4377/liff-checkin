@echo off
@chcp 65001 > nul
setlocal
rem =================================================================
rem 全系統自動化部署腳本 v8.0 (穩定修復版)
rem 功能:
rem - [v8.0] 移除所有中文註解，根除 cmd 編碼問題。
rem - [v8.0] 修正 PowerShell 版本號替換的單引號語法錯誤。
rem - [v8.0] 在 git pull 前自動執行 git rebase --abort，解決 rebase 衝突。
rem - [v7.0] 新增 Git 索引修復機制。
rem - [v5.0] 整合後端部署腳本，實現一鍵化部署。
rem =================================================================

echo [本地備份] 正在執行程式碼備份...

rem --- 備份邏輯 ---
set "SOURCE_DIR=D:\Dropbox\程式備份用\CODING"
set "BACKUP_ROOT=D:\Dropbox\程式備份用\BAK"

rem [您的要求] 組合出包含 CODING、日期時間、電腦名稱的資料夾名稱
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TIMESTAMP=%%i"
set "BACKUP_FOLDER_NAME=CODING_%TIMESTAMP%_%COMPUTERNAME%"
set "BACKUP_PATH=%BACKUP_ROOT%\%BACKUP_FOLDER_NAME%"

mkdir "%BACKUP_PATH%"
echo    - 備份資料夾已建立: %BACKUP_PATH%

robocopy "%SOURCE_DIR%" "%BACKUP_PATH%" /E /XD .git /XF upload_new.bat > nul

echo    - 程式碼已成功備份至指定位置。
echo.
echo [前端部署] 正在檢查 Git 環境...
set "GIT_EXECUTABLE="

git --version >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Write-Output 'Git 已在系統 PATH 中找到。'"
    set "GIT_EXECUTABLE=git"
    goto git_found
)

powershell -Command "Write-Output '未在系統 PATH 中找到 Git，正在自動搜尋...'"
if exist "C:\Program Files\Git\bin\git.exe" (
    set "GIT_EXECUTABLE=C:\Program Files\Git\bin\git.exe"
    powershell -Command "Write-Output '於 \"C:\Program Files\Git\bin\\\" 找到 Git。'"
    goto git_found
)
if exist "%USERPROFILE%\AppData\Local\Programs\Git\bin\git.exe" (
    set "GIT_EXECUTABLE=%USERPROFILE%\AppData\Local\Programs\Git\bin\git.exe"
    echo 於使用者資料夾中找到 Git。
    goto git_found
)

echo.
powershell -Command "Write-Output '[錯誤] 自動搜尋 Git 失敗。'"
powershell -Command "Write-Output '請確認您已安裝 Git，或在腳本中手動設定 GIT_CMD 路徑。'"
goto end

:git_found
powershell -Command "Write-Output 'Git 可執行檔已設定為: %GIT_EXECUTABLE%'"
powershell -Command "Write-Output '[前端部署] 正在產生新的版本號...'"
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yy.MM.dd.HHmm')"') do set "NEW_VERSION=v%%i"
powershell -Command "Write-Output '新版本號為: %NEW_VERSION%'"

echo.
powershell -Command "Write-Output '[前端部署] 正在自動更新 managementconsole.html 中的版本號...'"
rem [您的要求] 核心修正：將 '.*' 中的單引號轉義為 ''
powershell -Command "(Get-Content -Path 'managementconsole.html' -Raw -Encoding UTF8) -replace \"var FRONTEND_VERSION = ''.*'';\", \"var FRONTEND_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'managementconsole.html' -Encoding UTF8"
if %errorlevel% neq 0 (
    echo.
    powershell -Command "Write-Output '錯誤: 更新 managementconsole.html 檔案失敗。請檢查檔案是否存在或被鎖定。'"
    goto end
)

echo.
powershell -Command "Write-Output '[前端部署] 正在自動更新 checkin.html 中的版本號...'"
powershell -Command "(Get-Content -Path 'checkin.html' -Raw -Encoding UTF8) -replace \"const APP_VERSION = ''.*'';\", \"const APP_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'checkin.html' -Encoding UTF8"
if %errorlevel% neq 0 (
    echo.
    powershell -Command "Write-Output '錯誤: 更新 checkin.html 檔案失敗。請檢查檔案是否存在或被鎖定。'"
    goto end
)

echo.
powershell -NoProfile -Command "Write-Output '[前端部署] 正在修復 Git 索引 (v7.0 終極版)...'"

powershell -NoProfile -Command "Write-Output '步驟 1/3: 正在使用 git fsck 檢查儲存庫完整性...'"
for /f "tokens=2" %%a in ('"%GIT_EXECUTABLE%" fsck --unreachable ^| findstr "dangling blob"') do (
    set "DANGLING_OBJECT=%%a"
    powershell -NoProfile -Command "Write-Output '偵測到損壞/懸空的物件: !DANGLING_OBJECT!'"
    
    set "OBJ_DIR=!DANGLING_OBJECT:~0,2!"
    set "OBJ_FILE=!DANGLING_OBJECT:~2!"
    set "OBJ_PATH=.git\objects\!OBJ_DIR!\!OBJ_FILE!"
    
    if exist "!OBJ_PATH!" (
        del "!OBJ_PATH!"
        powershell -NoProfile -Command "Write-Output '  -> 已成功刪除損壞的物件檔案: !OBJ_PATH!'"
    ) else (
        powershell -NoProfile -Command "Write-Output '  -> 警告: 找不到物件檔案 !OBJ_PATH!，可能已被處理。'"
    )
)

powershell -NoProfile -Command "Write-Output '步驟 2/3: 正在移除 Git 索引與有問題的檔案追蹤...'"
if exist ".git\index" (
    del .git\index
    powershell -NoProfile -Command "Write-Output '  -> 已移除損壞的 .git/index 檔案。'"
)
"%GIT_EXECUTABLE%" rm --cached approval_dashboard.html >nul 2>&1

powershell -NoProfile -Command "Write-Output '步驟 3/3: 正在重置工作區狀態...'"
"%GIT_EXECUTABLE%" reset
if %errorlevel% neq 0 (
    powershell -NoProfile -Command "Write-Output '[錯誤] ''git reset'' 失敗，請手動檢查 Git 儲存庫狀態。'"
    goto end
)
powershell -NoProfile -Command "Write-Output 'Git 儲存庫已成功修復並重置。'"

echo.
echo [前端部署] 正在將所有變更加入 Git...

set "GIT_ADD_ATTEMPTS=0"
:retry_git_add
set /a "GIT_ADD_ATTEMPTS+=1"

"%GIT_EXECUTABLE%" add .
if %errorlevel% equ 0 (
    powershell -Command "Write-Output ''git add' 成功。'"
    goto commit_changes
)

if %GIT_ADD_ATTEMPTS% lss 3 (
    echo.
    powershell -Command "Write-Output '[警告] ''git add'' 第 %GIT_ADD_ATTEMPTS% 次失敗，極有可能是 Dropbox 正在同步檔案。'"
    powershell -Command "Write-Output '8 秒後自動重試...'"
    timeout /t 8 /nobreak > nul
    goto retry_git_add
)

echo.
powershell -Command "Write-Output '[錯誤] ''git add'' 連續失敗 3 次，部署中止。'"
powershell -Command "Write-Output '請檢查是否有程式鎖定檔案 (如 Dropbox、防毒軟體)，或手動執行 ''git add .'' 查看詳細錯誤。'"
goto end

:commit_changes
echo.
echo [前端部署] 正在提交變更...

"%GIT_EXECUTABLE%" diff --cached --quiet --exit-code

if %errorlevel% neq 1 (
    powershell -Command "Write-Output '沒有偵測到檔案變更，無需提交。'"
    goto after_commit
)

set "GIT_COMMIT_ATTEMPTS=0"
:retry_git_commit
set /a "GIT_COMMIT_ATTEMPTS+=1"

powershell -Command "Write-Output '偵測到檔案變更，正在嘗試第 %GIT_COMMIT_ATTEMPTS% 次提交...'"
"%GIT_EXECUTABLE%" commit -m "Update frontend to %NEW_VERSION%"

if %errorlevel% equ 0 (
    powershell -Command "Write-Output ''git commit'' 成功。'"
    goto after_commit
)

if %GIT_COMMIT_ATTEMPTS% lss 3 (
    echo.
    powershell -Command "Write-Output '[警告] ''git commit'' 第 %GIT_COMMIT_ATTEMPTS% 次失敗，極有可能是檔案鎖定問題。'"
    powershell -Command "Write-Output '8 秒後自動重試...'"
    timeout /t 8 /nobreak > nul
    goto retry_git_commit
)

echo.
powershell -Command "Write-Output '[錯誤] ''git commit'' 連續失敗 3 次，部署中止。'"
powershell -Command "Write-Output '請手動執行 ''git commit'' 查看詳細錯誤，或暫停 Dropbox/防毒軟體後再試。'"
goto end

:after_commit
echo.
powershell -Command "Write-Output '[前端部署] 正在從 GitHub 同步最新變更 (rebase 模式)...'"

rem --- [您的要求] 核心修正：在 pull 之前，先中止任何可能存在的 rebase ---
powershell -Command "Write-Output '正在中止任何可能未完成的 rebase...'"
"%GIT_EXECUTABLE%" rebase --abort >nul 2>&1


rem --- 在 pull 之前再次嚴格檢查工作區狀態 ---
for /f %%i in ('"%GIT_EXECUTABLE%" status --porcelain') do (
    echo.
    powershell -Command "Write-Output '[錯誤] 偵測到未提交的變更，無法執行 git pull。'"
    powershell -Command "Write-Output '這通常表示先前的 git add 或 commit 步驟因檔案鎖定而失敗。請暫停 Dropbox 同步後再試。'"
    goto end
)

"%GIT_EXECUTABLE%" pull --rebase
if %errorlevel% neq 0 (
    echo.
    powershell -Command "Write-Output '[錯誤] ''git pull'' 失敗。請手動解決合併衝突後再試一次。'"
    goto end
)

echo.
powershell -Command "Write-Output '[前端部署] 正在推送到 GitHub...'"
"%GIT_EXECUTABLE%" push origin main

echo.
powershell -Command "Write-Output '[前端部署] 成功！版本 %NEW_VERSION% 已部署並推送到 GitHub。'"

echo.
powershell -Command "Write-Output '================================================================='"
powershell -Command "Write-Output '[後端部署] 正在自動部署 CheckinSystem...'"
call "..\backend\CheckinSystem\deploy.bat"

echo.
powershell -Command "Write-Output '================================================================='"
powershell -Command "Write-Output '[後端部署] 正在自動部署 project-console...'"
call "..\backend\project-console\deploy.bat"

echo.
powershell -Command "Write-Output '================================================================='"
powershell -Command "Write-Output '🎉 全系統部署流程已成功完成！'"

:end
pause 
