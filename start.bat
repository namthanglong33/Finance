@echo off
title Cong cu Tai chinh Nam Thang Long
echo ============================================
echo   Cong cu Tai chinh Nam Thang Long
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Chua cai dat Node.js!
    echo Vui long tai va cai dat tai: https://nodejs.org
    pause
    exit /b 1
)

:: Check pnpm
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Chua cai dat pnpm!
    echo Dang cai dat pnpm...
    npm install -g pnpm
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
    echo [1/3] Cai dat thu vien (lan dau chay se mat vai phut)...
    pnpm install
)

echo [2/3] Khoi dong API Server tren cong 3000...
start "API Server - Nam Thang Long" cmd /k "cd /d "%~dp0artifacts\api-server" && pnpm run dev"

echo Dang cho API Server san sang...
timeout /t 5 /nobreak >nul

echo [3/3] Khoi dong giao dien Dashboard tren cong 5000...
start "Dashboard - Nam Thang Long" cmd /k "cd /d "%~dp0artifacts\financial-dashboard" && pnpm run dev"

echo.
echo Dang cho Dashboard san sang...
timeout /t 5 /nobreak >nul

echo.
echo ============================================
echo   Ung dung da san sang!
echo   Mo trinh duyet va truy cap:
echo   http://localhost:5000
echo ============================================
echo.

start "" "http://localhost:5000"

echo Nhan phim bat ky de dong cua so nay.
echo (Giu 2 cua so "API Server" va "Dashboard" mo de app hoat dong)
pause >nul
