@echo off
@chcp 65001 > nul
setlocal

:: =================================================================
:: 全系統自動化部署腳本 v5.2 (穩定還原版)
:: 功能:
:: - [v5.2] 移除 git commit 與 git pull 的自動重試，還原至最穩定版本。
:: - [v5.0] 強化流程控制，在 pull 之前再次檢查工作區狀態，避免衝突。
:: - [v5.0] 全面改用 PowerShell 輸出中文，根除亂碼問題。
:: - [v5.0] 整合後端部署腳本，實現一鍵化部署。
:: - [v5.0] 延長重試等待時間，並在失敗時給予更明確的提示。
:: 1. 自動產生 YY.MM.DD.HHmm 格式的版本號。
:: 2. 強制以 UTF-8 編碼更新 HTML 檔案中的版本號，解決亂碼問題。
:: 3. 自動將版本號作為 commit 訊息。
:: 4. 執行 git add, commit, pull, push 完整流程。
:: 5. 自動觸發後端部署。
:: =================================================================

echo [前端部署] 正在檢查 Git 環境...
:: --- Git 可執行檔自動偵測與設定 v2.0 ---
set "GIT_EXECUTABLE="

:: 1. 檢查 'git' 指令是否直接可用 (已在 PATH 中)
git --version >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Write-Output 'Git 已在系統 PATH 中找到。'"
    set "GIT_EXECUTABLE=git"
    goto git_found
)

:: 2. 如果 PATH 中沒有，則自動搜尋常見安裝路徑
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

:: 3. 如果自動搜尋失敗，顯示錯誤並結束
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
:: [核心修正] 使用 PowerShell 讀取、替換版本號，並強制以 UTF-8 編碼寫回檔案
powershell -Command "(Get-Content -Path 'managementconsole.html' -Raw -Encoding UTF8) -replace \"var FRONTEND_VERSION = '.*';\", \"var FRONTEND_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'managementconsole.html' -Encoding UTF8"
if %errorlevel% neq 0 (
    echo.
    powershell -Command "Write-Output '錯誤: 更新 HTML 檔案失敗。請檢查檔案是否存在或被鎖定。'"
    goto end
)

echo.
echo [前端部署] 正在將所有變更加入 Git...

:: --- [v3.0 核心改造] 自動重試 git add ---
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

:: [v2.1 修正] 檢查是否有任何已暫存的變更需要提交
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

:: --- [v5.0 核心改造] 在 pull 之前再次嚴格檢查工作區狀態 ---
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
:: [v2.3 修正] 明確指定推送到 origin 的 main 分支，避免意外推送到其他分支
"%GIT_EXECUTABLE%" push origin main

echo.
powershell -Command "Write-Output '[前端部署] 成功！版本 %NEW_VERSION% 已部署並推送到 GitHub。'"

:: --- [v4.0 新增] 自動觸發後端部署 ---
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
