@echo off
echo [前端部署] 正在將所有變更加入 Git...
git add .

echo.
echo [前端部署] 正在建立存檔紀錄 (commit)...
git commit -m "日常更新"

echo.
echo [前端部署] 正在推送到 GitHub...
git push

echo.
echo [前端部署] 完成！
pause
