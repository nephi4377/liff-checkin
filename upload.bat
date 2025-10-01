@echo off
setlocal

:: 將當前命令提示字元的字元編碼切換到 UTF-8 (65001)，以正確顯示中文字。
chcp 65001 > nul

echo [前端部署] 正在產生新的版本號...
:: 步驟 1: 使用 PowerShell 產生格式為 vYY.MM.DD.HHmm 的版本號
for /f "delims=" %%i in ('powershell -Command "(Get-Date).ToString('yy.MM.dd.HHmm')"') do set "NEW_VERSION=v%%i"
echo 新版本號為: %NEW_VERSION%

echo.
echo [前端部署] 正在自動更新 managementconsole.html 中的版本號...
:: 步驟 2: 使用 PowerShell 讀取 HTML 檔案，替換掉舊的版本號，然後寫回檔案
powershell -Command "(Get-Content -Path 'managementconsole.html' -Raw) -replace \"const FRONTEND_VERSION = '.*';\", \"const FRONTEND_VERSION = '%NEW_VERSION%';\" | Set-Content -Path 'managementconsole.html'"

echo [前端部署] 正在將所有變更加入 Git...
:: 步驟 3: 將所有變更加入 Git 暫存區
git add . 

echo.
echo [前端部署] 請輸入本次的更新說明 (例如: feat(main): 新增快取功能):
set /p commit_message=

git commit -m "%commit_message%"

echo.
echo [前端部署] 正在從 GitHub 同步最新變更 (rebase 模式)...
:: 步驟 4: 先拉取遠端的最新變更，確保本地分支是基於最新版本
git pull --rebase

echo.
echo [前端部署] 正在推送到 GitHub...
:: 步驟 5: 將本地的提交推送到遠端 GitHub 倉庫
git push

echo.
echo [前端部署] 完成！
pause 
