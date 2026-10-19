@echo off
setlocal EnableDelayedExpansion
title BOXORA - Hybrid Online Runner (Backend Local + Cloudflare Pages)
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo       BOXORA - HYBRID LOCAL BACKEND ^& CLOUDFLARE PAGES FRONTEND
echo ==============================================================================
echo.
echo [1] Frontend cua anh da duoc deploy vinh vien tren Cloudflare Pages tai:
echo     👉 https://boxora-storage.pages.dev
echo.
echo [2] Bay gio script se khoi dong Backend Local va mo duong truyen Cloudflare...
echo.

:: 1. Kiem tra PostgreSQL
echo [1/3] Kiem tra Database PostgreSQL...
powershell -Command "$t = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua bat! Dang khoi dong service...
    powershell -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service"
) else (
    echo [OK] PostgreSQL port 5432 san sang!
)

:: 2. Kiem tra Backend Port 8080 da chay chua
echo.
echo [2/3] Kiem tra Backend Spring Boot (Port 8080)...
powershell -Command "$t = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [INFO] Backend chua chay. Dang khoi dong Backend trong cua so rieng...
    start "BOXORA - BACKEND SPRING BOOT" cmd /k "cd /d \"%~dp0BE\boxora\" && setup_and_run_backend.bat"
    echo Dang cho Backend khoi dong trong 6 giay...
    timeout /t 6 /nobreak >nul
) else (
    echo [OK] Backend da dang chay tren port 8080!
)

:: 3. Mo Cloudflare Tunnel cho Backend (Port 8080)
echo.
echo ==============================================================================
echo [3/3] DANG TAO DUONG TRUYEN CLOUDFLARE CHO BACKEND (PORT 8080)...
echo ==============================================================================
echo.
echo Hay chu y duong link ben duoi co dang: https://xxxx.trycloudflare.com
echo.
echo SAU KHI CO LINK, ANH CHI CAN MO TRINH DUYET TRUY CAP:
echo 👉 https://boxora-storage.pages.dev?api=https://xxxx.trycloudflare.com
echo.
echo (Web se tu dong ghi nho Backend nay cho toan bo cac lan truy cap sau!)
echo ==============================================================================
echo.

C:\tools\cloudflared.exe tunnel --url http://localhost:8080
pause
