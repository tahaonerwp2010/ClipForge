@echo off
title ClipForge Studio - Desktop Runner
cd /d "%~dp0"

echo ========================================================
echo       ClipForge Studio - Run Desktop App
echo ========================================================
echo Folder: %CD%
echo.

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your PATH!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies first...
    call npm install --legacy-peer-deps
)

echo [1/2] Compiling latest app changes (takes ~2 seconds)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo [2/2] Launching ClipForge Desktop...
call npx electron .
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Electron failed to start.
)
echo.
pause
