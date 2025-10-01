@echo off
setlocal

echo [前端部署] 正在將所有變更加入 Git...
git add .

echo.
echo [前端部署] 請輸入本次的更新說明 (例如: feat(main): 新增快取功能):
set /p commit_message=

git commit -m "%commit_message%"

echo.
echo [前端部署] 正在推送到 GitHub...
git push

echo.
echo [前端部署] 完成！
pause
