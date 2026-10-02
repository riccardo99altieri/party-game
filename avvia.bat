@echo off
chcp 65001 >nul
title Party Game
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js non e' installato.
  echo   Scaricalo da https://nodejs.org ^(versione LTS^), installalo e riprova.
  echo.
  pause
  exit /b 1
)

node server.js --open
echo.
pause
