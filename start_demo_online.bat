@echo off
setlocal EnableDelayedExpansion
title BOXORA - 1-CLICK INSTANT ONLINE DEMO (NO VPS NEEDED)
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo       BOXORA - KHOI CHAY DEMO ONLINE 1-CLICK (KHONG CAN VPS)
echo ==============================================================================
echo.
echo [INFO] He thong se tu dong khoi dong:
echo   1. Backend Spring Boot (Port 8080)
echo   2. Frontend React Vite (Port 5173)
echo   3. Cloudflare Tunnel (Sinh link HTTPS Public toan cau de demo)
echo.

:: 1. Kiem tra PostgreSQL Port 5432
echo [1/4] Kiem tra ket noi Database PostgreSQL...
powershell -Command "$t = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua bat tren port 5432! Dang thu bat service...
    powershell -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service"
) else (
    echo [OK] PostgreSQL dang hoat dong tot.
)

:: 2. Khoi dong Backend Spring Boot trong cua so rieng
echo.
echo [2/4] Dang khoi dong Backend Spring Boot...
start "BOXORA - BACKEND (PORT 8080)" cmd /k "cd /d \"%~dp0BE\boxora\" && setup_and_run_backend.bat"

:: 3. Khoi dong Frontend trong cua so rieng
echo.
echo [3/4] Dang khoi dong Frontend React (Vite)...
start "BOXORA - FRONTEND (PORT 5173)" cmd /k "cd /d \"%~dp0FE\boxora-web\" && npm run dev"

:: 4. Cho 3 giay de server khoi tao
echo.
echo [INFO] Dang cho cac server khoi tao trong 5 giay...
timeout /t 5 /nobreak >nul

:: 5. Kiem tra cloudflared
set "CLOUDFLARED=C:\tools\cloudflared.exe"
if not exist "!CLOUDFLARED!" (
    echo [DOWNLOAD] Dang tai Cloudflare Tunnel...
    if not exist "C:\tools" mkdir "C:\tools"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'C:\tools\cloudflared.exe' -UseBasicParsing"
)

echo.
echo ==============================================================================
echo [4/4] DANG MO TUNNEL CLOUDFLARE... LINK DEMO CUA ANH SE XUAT HIEN DUOI DAY!
echo ==============================================================================
echo.
echo Luu y: Hay copy duong link https://*.trycloudflare.com ben duoi de gui cho nguoi khac xem demo!
echo.
"!CLOUDFLARED!" tunnel --url http://localhost:5173

pause
