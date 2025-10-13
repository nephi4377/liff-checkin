@echo off
:: [v2.2 修正] 確保命令提示字元能正確處理 UTF-8 編碼的腳本內容
chcp 65001 > nul
setlocal

:: =================================================================
:: 前端自動化部署腳本 v2.0
:: 功能:
:: 1. 自動產生 YY.MM.DD.HHmm 格式的版本號。
:: 2. 強制以 UTF-8 編碼更新 HTML 檔案中的版本號，解決亂碼問題。
:: 3. 自動將版本號作為 commit 訊息，無需手動輸入。
:: 4. 執行 git add, commit, pull, push 完整流程。
:: =================================================================

echo [前端部署] 正在檢查 Git 環境...
:: --- Git 可執行檔自動偵測與設定 v2.0 ---
set "GIT_EXECUTABLE="

:: 1. 檢查 'git' 指令是否直接可用 (已在 PATH 中)
git --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Git 已在系統 PATH 中找到。
    set "GIT_EXECUTABLE=git"
    goto git_found
)

:: 2. 如果 PATH 中沒有，則自動搜尋常見安裝路徑
echo 未在系統 PATH 中找到 Git，正在自動搜尋...
if exist "C:\Program Files\Git\bin\git.exe" (
    set "GIT_EXECUTABLE=C:\Program Files\Git\bin\git.exe"
    echo 於 "C:\Program Files\Git\bin\" 找到 Git。
    goto git_found
)
if exist "%USERPROFILE%\AppData\Local\Programs\Git\bin\git.exe" (
    set "GIT_EXECUTABLE=%USERPROFILE%\AppData\Local\Programs\Git\bin\git.exe"
    echo 於使用者資料夾中找到 Git。
    goto git_found
)

:: 3. 如果自動搜尋失敗，顯示錯誤並結束
echo.
echo [錯誤] 自動搜尋 Git 失敗。
echo 請確認您已安裝 Git，或在腳本中手動設定 GIT_CMD 路徑。
goto end

:git_found
echo Git 可執行檔已設定為: %GIT_EXECUTABLE%
echo [前端部署] 正在產生新的版本號...
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yy.MM.dd.HHmm')"') do set "NEW_VERSION=v%%i"
echo 新版本號為: %NEW_VERSION%

echo.
echo [前端部署] 正在自動更新 managementconsole.html 中的版本號...
:: [核心修正] 使用 PowerShell 讀取、替換版本號，並強制以 UTF-8 編碼寫回檔案
powershell -Command "(Get-Content -Path 'managementconsole.html' -Raw -Encoding UTF8) -replace \"var FRONTEND_VERSION = '.*';\", \"var FRONTEND_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'managementconsole.html' -Encoding UTF8"
if %errorlevel% neq 0 (
    echo.
    echo 錯誤: 更新 HTML 檔案失敗。請檢查檔案是否存在或被鎖定。
    goto end
)

echo.
echo [前端部署] 正在將所有變更加入 Git...
"%GIT_EXECUTABLE%" add .
if %errorlevel% neq 0 (
    echo.
    echo 錯誤: 'git add' 失敗。
    echo 請檢查是否有其他程式鎖定檔案 ^(如 Dropbox、防毒軟體、編輯器^)，或檢查資料夾權限。
    goto end
)

echo.
echo [前端部署] 正在檢查並提交變更...

:: [v2.1 修正] 檢查是否有任何已暫存的變更需要提交
"%GIT_EXECUTABLE%" diff --cached --quiet --exit-code
if %errorlevel% equ 1 (
    echo 偵測到檔案變更，正在提交...
    "%GIT_EXECUTABLE%" commit -m "Update frontend to %NEW_VERSION%"
    if %errorlevel% neq 0 (
        echo.
        echo 錯誤: 'git commit' 失敗。
        echo 請檢查 Git 設定 ^(如 user.name, user.email^) 或手動解決問題。
        goto end
    )
) else (
    echo 沒有偵測到檔案變更，無需提交。
)

echo.
echo [前端部署] 正在從 GitHub 同步最新變更 (rebase 模式)...
"%GIT_EXECUTABLE%" pull --rebase
if %errorlevel% neq 0 (
    echo.
    echo 錯誤: 'git pull' 失敗。請手動解決合併衝突後再試一次。
    goto end
)

echo.
echo [前端部署] 正在推送到 GitHub...
:: [v2.3 修正] 明確指定推送到 origin 的 main 分支，避免意外推送到其他分支
"%GIT_EXECUTABLE%" push origin main

echo.
echo [前端部署] 成功！
echo 版本 %NEW_VERSION% 已部署並推送到 GitHub。
:end
pause 
