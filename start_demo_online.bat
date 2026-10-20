@echo off
setlocal EnableDelayedExpansion
title BOXORA - 1-CLICK CLOUDFLARE DEPLOY AND BACKEND ONLINE
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo       BOXORA - 1-CLICK DEPLOY CLOUDFLARE PAGES AND RUN BACKEND ONLINE
echo ==============================================================================
echo.
echo Quy trinh tu dong:
echo   1. Kiem tra va Khoi dong PostgreSQL - Port 5432
echo   2. Khoi dong Backend Spring Boot - Port 8080 voi JDK 21
echo   3. Mo Cloudflare Tunnel ket noi Backend ra toan cau - HTTPS
echo   4. Build va Day Frontend moi nhat len Cloudflare Pages (tich hop san URL Backend)
echo   5. Tu dong mo trinh duyet truc tiep den website da online hoan hao
echo.

:: -----------------------------------------------------------------------------
:: BUOC 1: KIEM TRA POSTGRESQL (PORT 5432)
:: -----------------------------------------------------------------------------
echo [1/5] Kiem tra Database PostgreSQL...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua bat! Dang thu khoi dong Service PostgreSQL...
    powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [OK] PostgreSQL dang hoat dong tot.
)

:: -----------------------------------------------------------------------------
:: BUOC 2: KHOI DONG BACKEND SPRING BOOT (PORT 8080)
:: -----------------------------------------------------------------------------
echo.
echo [2/5] Kiem tra va khoi dong Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto BACKEND_RUNNING

echo   - Dang khoi dong Backend Spring Boot trong cua so rieng...
start "BOXORA - BACKEND SPRING BOOT (PORT 8080)" /d "%~dp0BE\boxora" cmd /k setup_and_run_backend.bat 2
echo   - Dang cho Backend khoi tao tren Port 8080...

set /a RETRY_COUNT=0
:CHECK_BACKEND_PORT
ping 127.0.0.1 -n 4 >nul
set /a RETRY_COUNT+=1
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto BACKEND_RUNNING
if !RETRY_COUNT! GEQ 35 goto BACKEND_TIMEOUT
echo     ...dang cho Backend khoi dong - lan !RETRY_COUNT! tren 35
goto CHECK_BACKEND_PORT

:BACKEND_TIMEOUT
echo [WARNING] Backend khoi dong hoi cham, he thong se tiep tuc mo tunnel...
goto PROCEED_TUNNEL

:BACKEND_RUNNING
echo [OK] Backend Spring Boot da san sang tren Port 8080!

:PROCEED_TUNNEL
:: -----------------------------------------------------------------------------
:: BUOC 3: KHOI TAO CLOUDFLARE TUNNEL CHO BACKEND (PORT 8080)
:: -----------------------------------------------------------------------------
echo.
echo [3/5] Kiem tra va mo Cloudflare Tunnel cho Backend...
set "CLOUDFLARED=C:\tools\cloudflared.exe"
if not exist "!CLOUDFLARED!" (
    echo [DOWNLOAD] Dang tai Cloudflare Tunnel ve C:\tools...
    if not exist "C:\tools" mkdir "C:\tools"
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'C:\tools\cloudflared.exe' -UseBasicParsing"
)

set "LOGFILE=%TEMP%\boxora_backend_tunnel.log"
taskkill /f /im cloudflared.exe >nul 2>&1
if exist "!LOGFILE!" del /f /q "!LOGFILE!" >nul 2>&1

echo   - Dang mo Cloudflare Quick Tunnel cho Backend qua giao thuc HTTP/2 on dinh...
start "BOXORA - BACKEND TUNNEL" /min "!CLOUDFLARED!" --protocol http2 --logfile "!LOGFILE!" tunnel --url http://localhost:8080

echo   - Dang trich xuat public HTTPS tunnel URL...
set "BACKEND_TUNNEL_URL="
set /a TUNNEL_TRY=0
:CHECK_TUNNEL_LOG
ping 127.0.0.1 -n 2 >nul
set /a TUNNEL_TRY+=1
if exist "!LOGFILE!" (
    for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "try { $m = ((Get-Content -Path $env:TEMP\boxora_backend_tunnel.log -Raw -ErrorAction SilentlyContinue) | Select-String -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com').Matches[0].Value; if ($m) { Write-Output $m } } catch {}"`) do (
        if not "%%u"=="" (
            set "BACKEND_TUNNEL_URL=%%u"
            goto TUNNEL_SUCCESS
        )
    )
)
if !TUNNEL_TRY! LSS 30 goto CHECK_TUNNEL_LOG

:TUNNEL_SUCCESS
if "!BACKEND_TUNNEL_URL!"=="" (
    echo [WARNING] Chua lay duoc link trycloudflare tu dong.
    echo Vui long xem log tai: !LOGFILE!
    set "BACKEND_TUNNEL_URL=http://localhost:8080"
) else (
    echo [OK] Backend Tunnel Public HTTPS: !BACKEND_TUNNEL_URL!
)

:: -----------------------------------------------------------------------------
:: BUOC 4: BUILD VA DEPLOY FRONTEND LEN CLOUDFLARE PAGES
:: -----------------------------------------------------------------------------
echo.
echo [4/5] Cau hinh va Deploy Frontend len Cloudflare Pages...
cd /d "%~dp0FE\boxora-web"

echo   - Ghi nhan Backend API URL vao file .env cua Frontend: !BACKEND_TUNNEL_URL!
echo VITE_API_BASE_URL=!BACKEND_TUNNEL_URL!> .env

echo   - Dang build Frontend voi URL Backend truc tiep...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build Frontend that bai! Vui long kiem tra code.
    pause
    exit /b 1
)

echo   - Dang day len Cloudflare Pages (boxora-storage - Main Production)...
call npx wrangler pages deploy dist --project-name=boxora-storage --branch=main --commit-dirty=true
if %errorlevel% neq 0 (
    echo [WARNING] Wrangler deploy gap loi hoac can xac thuc.
) else (
    echo [OK] Frontend da duoc deploy thanh cong len Cloudflare Pages!
)

cd /d "%~dp0"

:: -----------------------------------------------------------------------------
:: BUOC 5: TU DONG MO TRINH DUYET VA THEO DOI
:: -----------------------------------------------------------------------------
echo.
set "FINAL_DEMO_URL=https://boxora-storage.pages.dev?api=!BACKEND_TUNNEL_URL!"
echo ==============================================================================
echo [5/5] HE THONG DA SAN SANG VA DANG CHAY ONLINE 100%%!
echo ==============================================================================
echo.
echo Link Website Demo (Co the mo truc tiep hoac chia se toan cau):
echo.
echo       https://boxora-storage.pages.dev
echo   hoac: !FINAL_DEMO_URL!
echo.
echo Backend API Endpoint: !BACKEND_TUNNEL_URL!
echo Cloudflare Pages Frontend: https://boxora-storage.pages.dev
echo.
echo Tai khoan dang nhap Quan tri (Admin):
echo   - Email:    admin1@gmail.com
echo   - Password: 123456
echo.
echo Dang tu dong mo trinh duyet...
start "" "!FINAL_DEMO_URL!"
echo.
echo ==============================================================================
echo [CHU Y] Giu cua so nay mo de duy tri Backend Tunnel online.
echo         Neu dong cua so nay, ket noi tunnel tu may tinh se bi ngat!
echo ==============================================================================
echo.

:MONITOR_LOOP
ping 127.0.0.1 -n 11 >nul
goto MONITOR_LOOP
