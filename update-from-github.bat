@echo off
setlocal EnableDelayedExpansion
title ClipForge Studio - GitHub Auto Updater
cd /d "%~dp0"

echo ========================================================
echo       ClipForge Studio - One-Click GitHub Updater
echo ========================================================
echo Folder: %CD%
echo.

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed or not in your PATH!
    echo Please download Git for Windows from https://git-scm.com/
    pause
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm is not found in your PATH!
    pause
    exit /b 1
)

echo [Step 1/3] Fetching and pulling latest code from GitHub...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Git pull reported an issue (or no remote branch set).
    echo Continuing to build local files...
)

echo.
echo [Step 2/3] Compiling latest application bundle...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [Step 3/3] Launching updated ClipForge Desktop...
call npx electron .

echo.
echo Application closed.
pause
