@echo off
chcp 65001 > nul
setlocal

echo.
echo ====================================================
echo   添心設計前端程式碼檔案整理工具
echo ====================================================
echo.
echo 警告：此操作將移動檔案，請務必先備份您的 CODING 資料夾！
echo.
pause
echo.

:: 確保批次檔在正確的目錄下執行
cd /d "%~dp0"

echo 正在建立子資料夾結構...
echo.

:: 建立 assets 子資料夾
mkdir "assets"
mkdir "assets\css"

:: 建立 shared 子資料夾
mkdir "shared"
mkdir "shared\js"

:: 建立 spa 子資料夾
mkdir "spa"

:: 建立 modules 子資料夾
mkdir "modules"
mkdir "modules\attendance"
mkdir "modules\projects"
mkdir "modules\projects\js"
mkdir "modules\info"

echo.
echo 子資料夾建立完成。
echo 正在移動檔案...
echo.

:: ====================================================
:: 移動檔案到新的位置
:: ====================================================

:: assets/css
if exist "style.css" move "style.css" "assets\css\" > nul
if exist "style.css" echo   - style.css -> assets\css\

:: shared/js
if exist "utils.js" move "utils.js" "shared\js\" > nul
if exist "utils.js" echo   - utils.js -> shared\js\
if exist "taskSender.js" move "taskSender.js" "shared\js\" > nul
if exist "taskSender.js" echo   - taskSender.js -> shared\js\

:: spa
if exist "app.js" move "app.js" "spa\" > nul
if exist "app.js" echo   - app.js -> spa\
if exist "Dashboard.js" move "Dashboard.js" "spa\" > nul
if exist "Dashboard.js" echo   - Dashboard.js -> spa\
if exist "ProjectBoard.js" move "ProjectBoard.js" "spa\" > nul
if exist "ProjectBoard.js" echo   - ProjectBoard.js -> spa\
if exist "IframeView.js" move "IframeView.js" "spa\" > nul
if exist "IframeView.js" echo   - IframeView.js -> spa\

:: modules/attendance
if exist "checkin.html" move "checkin.html" "modules\attendance\" > nul
if exist "checkin.html" echo   - checkin.html -> modules\attendance\
if exist "leave_request.html" move "leave_request.html" "modules\attendance\" > nul
if exist "leave_request.html" echo   - leave_request.html -> modules\attendance\
if exist "approval_dashboard.html" move "approval_dashboard.html" "modules\attendance\" > nul
if exist "approval_dashboard.html" echo   - approval_dashboard.html -> modules\attendance\
if exist "attendance_report.html" move "attendance_report.html" "modules\attendance\" > nul
if exist "attendance_report.html" echo   - attendance_report.html -> modules\attendance\
if exist "shift_schedule.html" move "shift_schedule.html" "modules\attendance\" > nul
if exist "shift_schedule.html" echo   - shift_schedule.html -> modules\attendance\

:: modules/projects
if exist "daily_report.html" move "daily_report.html" "modules\projects\" > nul
if exist "daily_report.html" echo   - daily_report.html -> modules\projects\
if exist "managementconsole.html" move "managementconsole.html" "modules\projects\" > nul
if exist "managementconsole.html" echo   - managementconsole.html -> modules\projects\
if exist "gantt.html" move "gantt.html" "modules\projects\" > nul
if exist "gantt.html" echo   - gantt.html -> modules\projects\
if exist "report.html" move "report.html" "modules\projects\" > nul
if exist "report.html" echo   - report.html -> modules\projects\
if exist "NewSiteForm.html" move "NewSiteForm.html" "modules\projects\" > nul
if exist "NewSiteForm.html" echo   - NewSiteForm.html -> modules\projects\

:: modules/projects/js
if exist "main.js" move "main.js" "modules\projects\js\" > nul
if exist "main.js" echo   - main.js -> modules\projects\js\
if exist "api.js" move "api.js" "modules\projects\js\" > nul
if exist "api.js" echo   - api.js -> modules\projects\js\

:: modules/info
if exist "onboardingflow.html" move "onboardingflow.html" "modules\info\" > nul
if exist "onboardingflow.html" echo   - onboardingflow.html -> modules\info\
if exist "FAQ.html" move "FAQ.html" "modules\info\" > nul
if exist "FAQ.html" echo   - FAQ.html -> modules\info\

:: 根目錄檔案 (不移動)
echo.
echo 以下檔案保留在根目錄：
echo   - index.html
echo   - hub.html
echo   - sw.js
echo.

echo ====================================================
echo   檔案整理完成！
echo ====================================================
echo.
echo 下一步：請務必手動更新程式碼中的所有檔案路徑。
echo.
pause
