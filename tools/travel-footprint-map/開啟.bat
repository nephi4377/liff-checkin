@echo off
chcp 65001 >nul
title 旅遊足跡地圖
cd /d "%~dp0"
echo.
echo  旅遊足跡地圖 — 正在啟動本機預覽…
echo  瀏覽器將開啟 http://127.0.0.1:5188
echo  關閉此視窗即停止服務。
echo.
start "" "http://127.0.0.1:5188"
npx --yes serve -l 5188 .
