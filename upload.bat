@echo off
setlocal

:: =================================================================
:: 前端自動化部署腳本 v2.0
:: 功能:
:: 1. 自動產生 YY.MM.DD.HHmm 格式的版本號。
:: 2. 強制以 UTF-8 編碼更新 HTML 檔案中的版本號，解決亂碼問題。
:: 3. 自動將版本號作為 commit 訊息，無需手動輸入。
:: 4. 執行 git add, commit, pull, push 完整流程。
:: =================================================================

:: 確保命令提示字元能正確顯示中文
chcp 65001 > nul

echo [前端部署] 正在產生新的版本號...
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yy.MM.dd.HHmm')"') do set "NEW_VERSION=v%%i"
echo 新版本號為: %NEW_VERSION%

echo.
echo [前端部署] 正在自動更新 managementconsole.html 中的版本號...
:: [核心修正] 使用 PowerShell 讀取、替換版本號，並強制以 UTF-8 編碼寫回檔案
powershell -Command "(Get-Content -Path 'managementconsole.html' -Raw -Encoding UTF8) -replace \"const FRONTEND_VERSION = '.*';\", \"const FRONTEND_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'managementconsole.html' -Encoding UTF8"
if %errorlevel% neq 0 (
    echo.
    echo 錯誤: 更新 HTML 檔案失敗。請檢查檔案是否存在或被鎖定。
    goto end
)

echo [前端部署] 正在將所有變更加入 Git...
git add . 

echo.
echo [前端部署] 正在自動提交變更...
:: [核心修正] 自動使用版本號作為 commit message，不再需要手動輸入
git commit -m "Update frontend to %NEW_VERSION%"

echo.
echo [前端部署] 正在從 GitHub 同步最新變更 (rebase 模式)...
git pull --rebase
if %errorlevel% neq 0 (
    echo.
    echo 錯誤: 'git pull' 失敗。請手動解決合併衝突後再試一次。
    goto end
)

echo.
echo [前端部署] 正在推送到 GitHub...
git push

echo.
echo [前端部署] 完成！
:end
pause 
