@echo off
setlocal enabledelayedexpansion

REM 設定 UTF-8 編碼，避免中文路徑或檔名出錯
chcp 65001 > nul

echo.
echo  ================================================================
echo   程式碼備份轉換工具 for NotebookLM
echo  ================================================================
echo   此工具會將指定的 .js 和 .html 檔案複製為 .txt 格式，
echo   並存放在一個新的 'TXT_For_NotebookLM' 資料夾中。
echo.

REM --- 設定 ---
REM 批次檔所在的目錄 (來源根目錄)
set "SOURCE_ROOT=%~dp0"
REM 目標資料夾名稱
set "DEST_FOLDER_NAME=TXT_For_NotebookLM"
REM 完整的目標路徑
set "DEST_ROOT=%SOURCE_ROOT%%DEST_FOLDER_NAME%\"

echo  來源目錄: %SOURCE_ROOT%
echo  目標目錄: %DEST_ROOT%
echo.

REM --- 執行 ---
echo  [1/3] 正在清理舊的備份資料夾...
if exist "%DEST_ROOT%" (
    echo    - 正在刪除: %DEST_FOLDER_NAME%
    REM 【v3.0 穩健性修正】增加短暫延遲，降低 "檔案被佔用" 的錯誤機率。
    timeout /t 1 /nobreak > nul
    rmdir /S /Q "%DEST_ROOT%"
)
echo.
echo  [2/3] 正在建立目標資料夾結構...

REM 要處理的子資料夾列表 (相對於來源根目錄)，不包含 backend
set "SUBFOLDERS=spa modules\projects modules\attendance modules\info shared\js"

REM 建立根目錄
if not exist "%DEST_ROOT%" mkdir "%DEST_ROOT%"

REM 遍歷並建立子目錄
for %%d in (%SUBFOLDERS%) do (
    if not exist "%DEST_ROOT%%%d" (
        echo    - 建立資料夾: %DEST_FOLDER_NAME%\%%d
        mkdir "%DEST_ROOT%%%d"
    )
)
echo.
echo  [3/3] 正在複製並轉換檔案...

REM 遍歷子資料夾，複製 .js 和 .html 檔案為 .txt
for %%d in (%SUBFOLDERS%) do (
    for %%f in ("%SOURCE_ROOT%%%d\*.js" "%SOURCE_ROOT%%%d\*.html") do (
        REM 【v3.0 終極修正】根據您的建議，移除 echo 指令，並使用 > nul 將 copy 指令的輸出靜音。
        REM 這是最簡單且最可靠的方式，可以完全避免輸出流衝突和註解解析錯誤。
        copy /Y "%%f" "%DEST_ROOT%%%d\%%~nf.txt" > nul
    )
)

REM 【您的要求】新增：處理根目錄下的 .js 和 .html 檔案
for %%f in ("%SOURCE_ROOT%*.js" "%SOURCE_ROOT%*.html") do (
    copy /Y "%%f" "%DEST_ROOT%%%~nf.txt" > nul
)

echo  ...處理完成！
echo.
echo  ================================================================
echo   處理完成！所有檔案已轉換並儲存於 %DEST_FOLDER_NAME%
echo  ================================================================
echo.
pause