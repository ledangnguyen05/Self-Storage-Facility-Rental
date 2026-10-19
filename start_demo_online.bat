@echo off
setlocal EnableDelayedExpansion
title BOXORA - 1-CLICK CLOUDFLARE DEPLOY & BACKEND ONLINE
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo       BOXORA - 1-CLICK DEPLOY CLOUDFLARE PAGES & RUN BACKEND ONLINE
echo ==============================================================================
echo.
echo Quy trinh tu dong:
echo   1. Build va Day Frontend moi nhat len Cloudflare Pages (boxora-storage.pages.dev)
echo   2. Kiem tra & Khoi dong PostgreSQL (Port 5432)
echo   3. Khoi dong Backend Spring Boot (Port 8080) voi JDK 21
echo   4. Mo Cloudflare Tunnel ket noi Backend ra toan cau (HTTPS)
echo   5. Tu dong ghep URL va mo trinh duyet truc tiep den website da online
echo.

:: -----------------------------------------------------------------------------
:: BƯỚC 1: KIỂM TRA POSTGRESQL (PORT 5432)
:: -----------------------------------------------------------------------------
echo [1/5] Kiem tra Database PostgreSQL (Port 5432)...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName localhost -Port 5432 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua bat! Dang thu khoi dong Service PostgreSQL...
    powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service"
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] PostgreSQL dang hoat dong tot.
)

:: -----------------------------------------------------------------------------
:: BƯỚC 2: BUILD VÀ DEPLOY FRONTEND LÊN CLOUDFLARE PAGES
:: -----------------------------------------------------------------------------
echo.
echo [2/5] Dang build va deploy Frontend len Cloudflare Pages (boxora-storage)...
cd /d "%~dp0FE\boxora-web"

echo   - Dang build Frontend (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build Frontend that bai! Vui long kiem tra code.
    pause
    exit /b 1
)

echo   - Dang day len Cloudflare Pages (boxora-storage)...
call npx wrangler pages deploy dist --project-name=boxora-storage --commit-dirty=true
if %errorlevel% neq 0 (
    echo [WARNING] Wrangler deploy gap loi hoac can xac thuc. Vui long kiem tra lai wrangler login.
) else (
    echo [OK] Frontend da duoc deploy thanh cong len Cloudflare Pages!
)

cd /d "%~dp0"

:: -----------------------------------------------------------------------------
:: BƯỚC 3: KHỞI ĐỘNG BACKEND SPRING BOOT (PORT 8080)
:: -----------------------------------------------------------------------------
echo.
echo [3/5] Kiem tra va khoi dong Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Backend Spring Boot da dang chay tren Port 8080.
) else (
    echo   - Dang khoi dong Backend Spring Boot trong cua so rieng...
    start "BOXORA - BACKEND SPRING BOOT (PORT 8080)" cmd /k "cd /d \"%~dp0BE\boxora\" && setup_and_run_backend.bat 2"
    
    echo   - Cho Backend khoi tao va san sang tren Port 8080...
    set /a RETRY=0
    :WAIT_BACKEND
    timeout /t 3 /nobreak >nul
    set /a RETRY+=1
    powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName localhost -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
    if %errorlevel% neq 0 (
        if !RETRY! lss 25 (
            echo     ...dang cho Backend khoi dong (!RETRY!/25)...
            goto WAIT_BACKEND
        ) else (
            echo [WARNING] Backend khoi dong hoi cham, he thong se tiep tuc mo tunnel...
        )
    ) else (
        echo [OK] Backend Spring Boot da san sang tren Port 8080!
    )
)

:: -----------------------------------------------------------------------------
:: BƯỚC 4: KHỞI TẠO CLOUDFLARE TUNNEL CHO BACKEND (PORT 8080)
:: -----------------------------------------------------------------------------
echo.
echo [4/5] Kiem tra Cloudflare Tunnel (cloudflared)...
set "CLOUDFLARED=C:\tools\cloudflared.exe"
if not exist "!CLOUDFLARED!" (
    echo [DOWNLOAD] Dang tai Cloudflare Tunnel ve C:\tools...
    if not exist "C:\tools" mkdir "C:\tools"
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'C:\tools\cloudflared.exe' -UseBasicParsing"
)

set "LOGFILE=%TEMP%\boxora_backend_tunnel.log"
if exist "!LOGFILE!" del /f /q "!LOGFILE!" >nul 2>&1

echo   - Dang mo Cloudflare Quick Tunnel cho Backend (http://localhost:8080)...
start "BOXORA - BACKEND TUNNEL" /min "!CLOUDFLARED!" tunnel --url http://localhost:8080 --logfile "!LOGFILE!"

echo   - Dang lay public HTTPS tunnel URL...
set "BACKEND_TUNNEL_URL="
for /l %%i in (1,1,25) do (
    timeout /t 1 /nobreak >nul
    if exist "!LOGFILE!" (
        for /f "tokens=*" %%a in ('powershell -NoProfile -Command "Select-String -Path $env:TEMP\boxora_backend_tunnel.log -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' | ForEach-Object { $_.Matches.Value } | Select-Object -First 1"') do (
            if not "%%a"=="" (
                set "BACKEND_TUNNEL_URL=%%a"
                goto TUNNEL_READY
            )
        )
    )
)

:TUNNEL_READY
if "!BACKEND_TUNNEL_URL!"=="" (
    echo [WARNING] Chua lay duoc link trycloudflare tu dong.
    echo Vui long xem log tai: !LOGFILE!
    set "FINAL_DEMO_URL=https://boxora-storage.pages.dev"
) else (
    echo [OK] Backend Tunnel Public HTTPS: !BACKEND_TUNNEL_URL!
    set "FINAL_DEMO_URL=https://boxora-storage.pages.dev?api=!BACKEND_TUNNEL_URL!"
)

:: -----------------------------------------------------------------------------
:: BƯỚC 5: TỰ ĐỘNG MỞ TRÌNH DUYỆT VÀ THEO DÕI LIÊN TỤC
:: -----------------------------------------------------------------------------
echo.
echo ==============================================================================
echo [5/5] HE THONG DA SAN SANG VA DANG CHAY ONLINE 100%%!
echo ==============================================================================
echo.
echo Link Website Demo Hoan Chinh (Chia se cho nguoi khac truy cap toan cau):
echo.
echo       !FINAL_DEMO_URL!
echo.
echo Backend API Endpoint: !BACKEND_TUNNEL_URL!
echo Cloudflare Pages Frontend: https://boxora-storage.pages.dev
echo.
echo Dang tu dong mo trinh duyet...
start "" "!FINAL_DEMO_URL!"
echo.
echo ==============================================================================
echo [CHU Y] Giu cua so nay mo de duy tri website online. Nhan Ctrl + C de dung.
echo ==============================================================================
echo.

:: Loop monitoring
:MONITOR_LOOP
timeout /t 10 /nobreak >nul
goto MONITOR_LOOP
