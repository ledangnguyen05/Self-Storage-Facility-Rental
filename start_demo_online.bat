@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title BOXORA - DEMO ONLINE LAUNCHER (CLOUDFLARE)
color 0B

cd /d "%~dp0"

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
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe" set "DETECTED_JDK=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
if defined DETECTED_JDK goto :APPLY_JDK

for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-21*" "C:\Program Files\Eclipse Adoptium\jdk-17*" "C:\Program Files\Java\jdk-21*" "C:\Program Files\Java\jdk-17*" "C:\Program Files\Microsoft\jdk-21*" "C:\Program Files\Microsoft\jdk-17*") do (
    if exist "%%~D\bin\java.exe" set "DETECTED_JDK=%%~D"
)
if not defined DETECTED_JDK goto :SKIP_JDK

:APPLY_JDK
set "JAVA_HOME=!DETECTED_JDK!"
set "PATH=!JAVA_HOME!\bin;!PATH!"
echo [INFO] Su dung JDK: !JAVA_HOME!

:SKIP_JDK

REM ==============================================================================
REM [1/5] KIEM TRA & KHOI DONG POSTGRESQL (PORT 5432)
REM ==============================================================================
echo.
echo [1/5] Kiem tra PostgreSQL Database (Port 5432)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :PG_ALREADY_UP

echo   - PostgreSQL chua chay. Dang thu khoi dong Windows Service hoac Docker...
powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue"
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :PG_STARTED_MSG

where docker >nul 2>&1
if errorlevel 1 goto :PG_CHECK_AFTER
docker compose -f "%~dp0docker-compose.yml" up -d postgres >nul 2>&1

:PG_CHECK_AFTER
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :PG_STARTED_MSG

echo   [CANH BAO] Khong the tu dong bat PostgreSQL tren Port 5432. Hay dam bao PostgreSQL da bat!
goto :PG_READY

:PG_ALREADY_UP
echo   - PostgreSQL da dang chay tren Port 5432.
goto :PG_READY

:PG_STARTED_MSG
echo   - Da khoi dong PostgreSQL thanh cong!

:PG_READY
REM ==============================================================================
REM [2/5] KIEM TRA & KHOI DONG BACKEND SPRING BOOT (PORT 8080)
REM ==============================================================================
echo.
echo [2/5] Kiem tra Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :BACKEND_ALREADY_UP

set "JAR_FILE=%~dp0BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar"
powershell -NoProfile -Command "if (!(Test-Path 'BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar')) { exit 1 }; $jarTime=(Get-Item 'BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar').LastWriteTime; $newer=Get-ChildItem 'BE\boxora\src' -Recurse -File | Where-Object { $_.LastWriteTime -gt $jarTime } | Select-Object -First 1; if ($newer) { exit 1 } else { exit 0 }"
if %errorlevel% equ 0 goto :START_BACKEND_JAR

echo   - Chua co file JAR hoac source code moi hon JAR, dang build va khoi dong Backend qua Maven...
start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 1"
goto :WAIT_BACKEND

:START_BACKEND_JAR
echo   - Tim thay JAR moi nhat, khoi dong truc tiep...
start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 2"

:WAIT_BACKEND
echo   - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)...
set /a WAIT_COUNT=0

:WAIT_BACKEND_LOOP
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :BACKEND_READY_MSG

set /a WAIT_COUNT+=1
if !WAIT_COUNT! GEQ 30 goto :BACKEND_TIMEOUT_MSG
echo     ... lan !WAIT_COUNT!/30 - dang cho Backend khoi dong...
goto :WAIT_BACKEND_LOOP

:BACKEND_ALREADY_UP
echo   - Backend da dang chay tren Port 8080! Bo qua buoc khoi dong lai.
goto :START_TUNNEL

:BACKEND_READY_MSG
echo   - Backend da san sang tren Port 8080!
goto :START_TUNNEL

:BACKEND_TIMEOUT_MSG
echo   [CANH BAO] Backend chua mo Port 8080 sau 90s. Kiem tra cua so BOXORA BACKEND!

:START_TUNNEL
REM ==============================================================================
REM [3/5] MO CLOUDFLARE QUICK TUNNEL & TU DONG LAY URL HTTPS
REM ==============================================================================
echo.
echo [3/5] Dang mo Cloudflare Quick Tunnel cho Backend (Port 8080)...

set "CLOUDFLARED_EXE="
where cloudflared >nul 2>&1
if not errorlevel 1 set "CLOUDFLARED_EXE=cloudflared"
if defined CLOUDFLARED_EXE goto :CLOUDFLARED_OK

if exist "%LOCALAPPDATA%\cloudflared\cloudflared.exe" set "CLOUDFLARED_EXE=%LOCALAPPDATA%\cloudflared\cloudflared.exe"
if defined CLOUDFLARED_EXE goto :CLOUDFLARED_OK

if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" set "CLOUDFLARED_EXE=C:\Program Files (x86)\cloudflared\cloudflared.exe"
if defined CLOUDFLARED_EXE goto :CLOUDFLARED_OK

if exist "C:\Program Files\cloudflared\cloudflared.exe" set "CLOUDFLARED_EXE=C:\Program Files\cloudflared\cloudflared.exe"
if defined CLOUDFLARED_EXE goto :CLOUDFLARED_OK

echo   - Chua co 'cloudflared' tren may, dang tu dong tai cloudflared.exe...
if not exist "%LOCALAPPDATA%\cloudflared" mkdir "%LOCALAPPDATA%\cloudflared" >nul 2>&1
curl.exe -L -s -o "%LOCALAPPDATA%\cloudflared\cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
if exist "%LOCALAPPDATA%\cloudflared\cloudflared.exe" set "CLOUDFLARED_EXE=%LOCALAPPDATA%\cloudflared\cloudflared.exe"
if defined CLOUDFLARED_EXE goto :CLOUDFLARED_OK

echo [LOI] Khong the tai 'cloudflared.exe'! Vui long kiem tra ket noi mang.
pause
exit /b 1

:CLOUDFLARED_OK
set "TUNNEL_LOG=%TEMP%\boxora_cloudflared.log"
taskkill /f /im cloudflared.exe >nul 2>&1
if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1

echo   - Dang lam nong DNS cho Cloudflare Tunnel (ho tro mang 4G / Hotspot)...
powershell -NoProfile -Command "foreach ($h in @('region1.v2.argotunnel.com','region2.v2.argotunnel.com','api.trycloudflare.com','api.cloudflare.com')) { Resolve-DnsName $h -Server 1.1.1.1 -ErrorAction SilentlyContinue | Out-Null; Resolve-DnsName $h -ErrorAction SilentlyContinue | Out-Null }"

:LAUNCH_CLOUDFLARED_PROC
start "BOXORA - CLOUDFLARE TUNNEL" /min "!CLOUDFLARED_EXE!" tunnel --url http://localhost:8080 --protocol http2 --edge-ip-version 4 --logfile "%TUNNEL_LOG%" --no-autoupdate

echo   - Dang lay URL HTTPS tu Cloudflare Tunnel...
set "TUNNEL_URL="
set /a TUNNEL_WAIT=0

:WAIT_TUNNEL_LOOP
timeout /t 2 /nobreak >nul
for /f "delims=" %%U in ('powershell -NoProfile -Command "if (Test-Path '%TUNNEL_LOG%') { $c = Get-Content '%TUNNEL_LOG%' -Raw -ErrorAction SilentlyContinue; if ($c -match 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com') { $matches[0] } }"') do (
    set "TUNNEL_URL=%%U"
)
if defined TUNNEL_URL goto :TUNNEL_FOUND

REM Neu cloudflared bi thoat som do timeout DNS mang Hotspot, tu dong khoi dong lai ngay
powershell -NoProfile -Command "if (Get-Process cloudflared -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto :CONTINUE_TUNNEL_WAIT

echo     ... DNS mang dang phan hoi cham, dang thu ket noi lai Cloudflare Tunnel...
if exist "%TUNNEL_LOG%" del /f /q "%TUNNEL_LOG%" >nul 2>&1
powershell -NoProfile -Command "foreach ($h in @('region1.v2.argotunnel.com','region2.v2.argotunnel.com','api.trycloudflare.com')) { Resolve-DnsName $h -Server 8.8.8.8 -ErrorAction SilentlyContinue | Out-Null; Resolve-DnsName $h -ErrorAction SilentlyContinue | Out-Null }"
start "BOXORA - CLOUDFLARE TUNNEL" /min "!CLOUDFLARED_EXE!" tunnel --url http://localhost:8080 --protocol http2 --edge-ip-version 4 --logfile "%TUNNEL_LOG%" --no-autoupdate

:CONTINUE_TUNNEL_WAIT
set /a TUNNEL_WAIT+=1
if !TUNNEL_WAIT! lss 25 goto :WAIT_TUNNEL_LOOP

echo   [LOI] Khong lay duoc URL tu Cloudflare Tunnel sau 50 giay!
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
echo [4/5] Dang cap nhat cau hinh Frontend, Build va Deploy len Cloudflare Pages...
echo VITE_API_BASE_URL=!TUNNEL_URL!> "%~dp0FE\boxora-web\.env"
echo VITE_GOOGLE_CLIENT_ID=564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com>> "%~dp0FE\boxora-web\.env"

pushd "%~dp0FE\boxora-web"
echo   - Dang chay npm run build...
call npm run build
set "BUILD_EXIT=!errorlevel!"

REM Khoi phuc .env ve localhost ngay sau khi build xong de khong anh huong start_local.bat
echo VITE_API_BASE_URL=http://localhost:8080> "%~dp0FE\boxora-web\.env"
echo VITE_GOOGLE_CLIENT_ID=564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com>> "%~dp0FE\boxora-web\.env"

if "!BUILD_EXIT!"=="0" goto :DEPLOY_PAGES

echo   [LOI] Build Frontend that bai!
popd
pause
exit /b 1

:DEPLOY_PAGES
echo   - Dang deploy len Cloudflare Pages (boxora-storage)...
call npx --yes wrangler pages deploy dist --project-name boxora-storage --branch=main --commit-dirty=true
if not errorlevel 1 goto :DEPLOY_DONE

echo   [CANH BAO] Deploy Cloudflare Pages gap loi - co the chua login wrangler.
echo   Ban van co the dung link: https://boxora-storage.pages.dev?api=!TUNNEL_URL!

:DEPLOY_DONE
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
echo   trong suot qua trinh Demo!
echo ==============================================================================
echo.
echo Dang mo trinh duyet...
start "" "!FINAL_URL!"
pause
