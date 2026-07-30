@echo off
title StockSight FinTech & Quant Research Server
color 0A

echo =======================================================
echo 🚀 STARTING STOCKSIGHT INSTITUTIONAL QUANT SERVER...
echo =======================================================
echo.
echo Server active on http://localhost:3000
echo Close this window to stop the server.
echo.

:: Launch browser in background after 2 second delay to ensure Express port is bound
start "" powershell -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

:: Start Node.js server independently
node server.js

pause
