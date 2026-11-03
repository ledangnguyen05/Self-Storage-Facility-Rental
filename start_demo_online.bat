@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title BOXORA - DEMO ONLINE LAUNCHER (CLOUDFLARE)
color 0B

echo ==============================================================================
echo         BOXORA SELF-STORAGE - DEMO ONLINE LAUNCHER (ALL-IN-ONE)
echo ==============================================================================
echo.
echo Script nay se tu dong thuc hien 5 buoc:
echo   [1/5] Khoi dong PostgreSQL Database (Port 5432)
echo   [2/5] Khoi dong Backend Spring Boot (Port 8080)
echo   [3/5] Mo Cloudflare Quick Tunnel cho Backend (Port 8080 -^> HTTPS)
echo   [4/5] Build Frontend ^& Deploy len Cloudflare Pages (boxora-storage.pages.dev)
echo   [5/5] Mo trinh duyet voi URL Online da ket noi san Backend
echo.
echo ------------------------------------------------------------------------------

REM --- PHAT HIEN JDK 21/17 CHO BACKEND ---
set "DETECTED_JDK="
for %%B in ("C:\Program Files\Eclipse Adoptium" "C:\Program Files\Java" "C:\Program Files\Microsoft" "C:\Program Files\BellSoft" "C:\Program Files\Amazon Corretto" "C:\Program Files\Zulu") do (
    if not defined DETECTED_JDK (
        if exist "%%~B" (
            for /f "delims=" %%D in ('dir /b /ad /o-n "%%~B\*21*" 2^>nul') do (
                if not defined DETECTED_JDK if exist "%%~B\%%D\bin\java.exe" set "DETECTED_JDK=%%~B\%%D"
            )
            for /f "delims=" %%D in ('dir /b /ad /o-n "%%~B\*17*" 2^>nul') do (
                if not defined DETECTED_JDK if exist "%%~B\%%D\bin\java.exe" set "DETECTED_JDK=%%~B\%%D"
            )
        )
    )
)
if not defined DETECTED_JDK goto :SKIP_JDK
set "JAVA_HOME=%DETECTED_JDK%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
echo [INFO] Su dung JDK: %JAVA_HOME%
:SKIP_JDK

REM ==============================================================================
REM [1/5] KIEM TRA & KHOI DONG POSTGRESQL (PORT 5432)
REM ==============================================================================
echo.
echo [1/5] Kiem tra PostgreSQL Database (Port 5432)...
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo   - PostgreSQL da dang chay tren Port 5432.
    goto :PG_READY
)

echo   - PostgreSQL chua chay. Dang thu khoi dong Windows Service hoac Docker...
for /f "tokens=2 delims=: " %%S in ('sc query state^= all ^| findstr /i "SERVICE_NAME.*postgresql"') do (
    net start "%%S" >nul 2>&1
)
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 goto :PG_READY

where docker >nul 2>&1
if errorlevel 1 goto :PG_CHECK_AFTER
docker compose -f "%~dp0docker-compose.yml" up -d postgres >nul 2>&1

:PG_CHECK_AFTER
timeout /t 3 /nobreak >nul
netstat -ano | findstr ":5432 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo   - Da khoi dong PostgreSQL thanh cong!
) else (
    echo   [CANH BAO] Khong the tu dong bat PostgreSQL tren Port 5432. Hay dam bao PostgreSQL da bat!
)

:PG_READY
REM ==============================================================================
REM [2/5] KIEM TRA & KHOI DONG BACKEND SPRING BOOT (PORT 8080)
REM ==============================================================================
echo.
echo [2/5] Kiem tra Backend Spring Boot (Port 8080)...
netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo   - Backend da dang chay tren Port 8080! Bo qua buoc khoi dong lai.
    goto :START_TUNNEL
)

set "JAR_FILE=%~dp0BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar"
if exist "%JAR_FILE%" goto :START_BACKEND_JAR

echo   - Chua co file JAR, dang build va khoi dong Backend qua Maven...
start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 1"
goto :WAIT_BACKEND

:START_BACKEND_JAR
echo   - Tim thay JAR, khoi dong truc tiep...
start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 2"

:WAIT_BACKEND
echo   - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)...
set /a WAIT_COUNT=0
:WAIT_BACKEND_LOOP
timeout /t 3 /nobreak >nul
netstat -ano | findstr ":8080 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo   - Backend da san sang tren Port 8080!
    goto :START_TUNNEL
)
set /a WAIT_COUNT+=1
if !WAIT_COUNT! lss 30 (
    echo     ... lan !WAIT_COUNT!/30 - dang cho Backend khoi dong...
    goto :WAIT_BACKEND_LOOP
)
echo   [CANH BAO] Backend chua mo Port 8080 sau 90s. Kiem tra cua so BOXORA BACKEND!

:START_TUNNEL
REM ==============================================================================
REM [3/5] MO CLOUDFLARE QUICK TUNNEL & TU DONG LAY URL HTTPS
REM ==============================================================================
echo.
echo [3/5] Dang mo Cloudflare Quick Tunnel cho Backend (Port 8080)...

where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay 'cloudflared' tren may!
    echo Hay cai dat bang lenh: winget install Cloudflare.cloudflared
    pause
    exit /b 1
)

set "TUNNEL_LOG=%TEMP%\boxora_cloudflared.log"
taskkill /f /im cloudflared.exe >nul 2>&1
if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1

start "BOXORA - CLOUDFLARE TUNNEL" /min cmd /c "cloudflared tunnel --url http://localhost:8080 --logfile "%TUNNEL_LOG%" --no-autoupdate"

echo   - Dang lay URL HTTPS tu Cloudflare Tunnel...
set "TUNNEL_URL="
set /a TUNNEL_WAIT=0
:WAIT_TUNNEL_LOOP
timeout /t 2 /nobreak >nul
for /f "delims=" %%U in ('powershell -NoProfile -Command "if (Test-Path '%TUNNEL_LOG%') { $c = Get-Content '%TUNNEL_LOG%' -Raw -ErrorAction SilentlyContinue; if ($c -match 'https://[a-zA-Z0-9]+-[a-zA-Z0-9\-]+\.trycloudflare\.com') { $matches[0] } }"') do (
    set "TUNNEL_URL=%%U"
)
if defined TUNNEL_URL goto :TUNNEL_FOUND
set /a TUNNEL_WAIT+=1
if !TUNNEL_WAIT! lss 20 (
    goto :WAIT_TUNNEL_LOOP
)

echo   [LOI] Khong lay duoc URL tu Cloudflare Tunnel sau 40 giay!
echo   Vui long kiem tra ket noi mang hoac file log: %TUNNEL_LOG%
pause
exit /b 1

:TUNNEL_FOUND
echo   - Da tao Tunnel thanh cong!
echo   - Backend HTTPS URL: !TUNNEL_URL!

REM ==============================================================================
REM [4/5] BUILD FRONTEND VOI URL TUNNEL & DEPLOY CLOUDFLARE PAGES
REM ==============================================================================
echo.
echo [4/5] Dang cap nhat cấu hình Frontend, Build va Deploy len Cloudflare Pages...
echo VITE_API_BASE_URL=!TUNNEL_URL!> "%~dp0FE\boxora-web\.env"

pushd "%~dp0FE\boxora-web"
echo   - Dang chay npm run build...
call npm run build
set "BUILD_EXIT=!errorlevel!"

REM Khoi phuc .env ve localhost ngay sau khi build xong de khong anh huong start_local.bat
echo VITE_API_BASE_URL=http://localhost:8080> "%~dp0FE\boxora-web\.env"

if not "!BUILD_EXIT!"=="0" (
    echo   [LOI] Build Frontend that bai!
    popd
    pause
    exit /b 1
)

echo   - Dang deploy len Cloudflare Pages (boxora-storage)...
call npx wrangler pages deploy dist --project-name boxora-storage --commit-dirty=true
if errorlevel 1 (
    echo   [CANH BAO] Deploy Cloudflare Pages gap loi (co the chua login wrangler).
    echo   Ban van co the dung link: https://boxora-storage.pages.dev?api=!TUNNEL_URL!
)
popd

REM ==============================================================================
REM [5/5] HOAN TAT & MO TRINH DUYET
REM ==============================================================================
set "FINAL_URL=https://boxora-storage.pages.dev?api=!TUNNEL_URL!"
echo !FINAL_URL!| clip

echo.
echo ==============================================================================
echo                      HE THONG DEMO ONLINE DA SAN SANG!
echo ==============================================================================
echo.
echo   - Backend Local     : http://localhost:8080
echo   - Backend Tunnel    : !TUNNEL_URL!
echo   - Frontend Online   : https://boxora-storage.pages.dev
echo   - Link Demo Day Du  : !FINAL_URL!
echo     (Da tu dong COPY link nay vao Clipboard - chi can Ctrl+V de gui!)
echo.
echo   [LUU Y QUAN TRONG]:
echo   KHONG DONG cua so "BOXORA - BACKEND" va "BOXORA - CLOUDFLARE TUNNEL"
echo   (dang thu nho duoi thanh Taskbar) trong suot qua trinh Demo!
echo ==============================================================================
echo.
echo Dang mo trinh duyet...
start "" "!FINAL_URL!"
pause