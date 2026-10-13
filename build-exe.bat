@echo off
setlocal EnableDelayedExpansion
title ClipForge Studio - Windows Portable .exe Builder

:: Set working directory to the folder where this batch file is located
cd /d "%~dp0"

echo ========================================================
echo       ClipForge Studio - Windows Portable .exe Builder
echo ========================================================
echo Folder: %CD%
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false

:: 1. Clean previous corrupted winCodeSign cache if any
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    echo [Cache] Cleaning previous incomplete winCodeSign cache...
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" >nul 2>&1
)

:: 2. Check Node.js
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm not found in your system PATH!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 3. Install dependencies
echo [Step 1/3] Checking dependencies...
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install encountered an error.
    echo.
    pause
    exit /b 1
)

:: 4. Build frontend UI
echo.
echo [Step 2/3] Building React Frontend UI (Vite)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Vite build failed!
    echo.
    pause
    exit /b 1
)

:: 5. Package Portable .exe
echo.
echo [Step 3/3] Packaging Standalone Portable .exe...
call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Note] If winCodeSign failed due to symlink permissions:
    echo Please Right-Click this build-exe.bat and select "Run as administrator"
    echo OR building unpacked executable folder as fallback...
    call npx electron-builder --dir
)

echo.
echo ========================================================
echo  BUILD PROCESS FINISHED!
echo.
echo  Check release\ folder for your .exe:
echo    release\ClipForge-windows-x64.exe
echo ========================================================
echo.
pause
