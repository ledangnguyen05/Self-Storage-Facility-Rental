@echo off
setlocal EnableDelayedExpansion
title BOXORA - DEMO ONLINE (BACKEND + CLOUDFLARE TUNNEL + DEPLOY PAGES)
chcp 65001 >nul

cd /d "%~dp0"

:: ==============================================================================
::   BOXORA - 1-CLICK DEMO ONLINE
::   1. Khoi dong PostgreSQL (5432)
::   2. Khoi dong Backend Spring Boot (8080)
::   3. Mo Cloudflare Tunnel (HTTPS public URL)
::   4. Build + Deploy Frontend len Cloudflare Pages voi URL tunnel
::   5. Mo trinh duyet
:: ==============================================================================

echo ==============================================================================
echo       BOXORA - 1-CLICK DEMO ONLINE (CLOUDFLARE TUNNEL + PAGES DEPLOY)
echo ==============================================================================
echo.

:: ==============================================================================
:: BUOC 0: TIM KIEM JDK PHU HOP (17 hoac 21)
:: ==============================================================================
set "FOUND_JDK="
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe" (
    set "FOUND_JDK=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
) else (
    for /d %%D in (
        "C:\Program Files\Eclipse Adoptium\jdk-21*"
        "C:\Program Files\Eclipse Adoptium\jdk-17*"
        "C:\Program Files\Java\jdk-21*"
        "C:\Program Files\Java\jdk-17*"
        "C:\Program Files\Microsoft\jdk-21*"
        "C:\Program Files\Microsoft\jdk-17*"
    ) do (
        if exist "%%~D\bin\java.exe" set "FOUND_JDK=%%~D"
    )
)
if defined FOUND_JDK (
    set "JAVA_HOME=!FOUND_JDK!"
    set "PATH=!FOUND_JDK!\bin;!PATH!"
    echo [OK] JDK phat hien: !FOUND_JDK!
) else (
    echo [OK] Su dung Java co san trong PATH he thong.
)
echo.

:: ==============================================================================
:: BUOC 1: KIEM TRA VA KHOI DONG POSTGRESQL (PORT 5432)
:: ==============================================================================
echo [1/5] Kiem tra Database PostgreSQL (Port 5432)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua chay! Dang thu khoi dong Windows Service PostgreSQL...
    powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue"
    ping 127.0.0.1 -n 5 >nul
    powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
    if !errorlevel! neq 0 (
        echo [ERROR] Khong the khoi dong PostgreSQL! Vui long bat PostgreSQL thu cong.
        pause
        exit /b 1
    )
)
echo [OK] PostgreSQL dang hoat dong tren Port 5432.
echo.

:: ==============================================================================
:: BUOC 2: KIEM TRA VA KHOI DONG BACKEND SPRING BOOT (PORT 8080)
:: ==============================================================================
echo [2/5] Kiem tra Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Backend Spring Boot da dang chay tren Port 8080.
    goto PROCEED_TUNNEL
)

:: Kiem tra file JAR
set "JAR_FILE=%~dp0BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar"
if exist "!JAR_FILE!" (
    echo   - Tim thay JAR, khoi dong truc tiep...
    start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "title BOXORA BACKEND (8080) && \"!JAVA_HOME!\bin\java.exe\" -Dfile.encoding=UTF-8 -Xms512m -Xmx1536m -jar target\boxora-backend-0.0.1-SNAPSHOT.jar"
) else (
    echo   - Chua co JAR, dang build va chay Backend...
    start "BOXORA - BACKEND (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "title BOXORA BACKEND (8080) && call setup_and_run_backend.bat 1"
)

echo   - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)...
set /a RETRY_COUNT=0
:CHECK_BACKEND_PORT
ping 127.0.0.1 -n 3 >nul
set /a RETRY_COUNT+=1
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto BACKEND_READY
if !RETRY_COUNT! GEQ 30 (
    echo [WARNING] Backend chua san sang sau 90 giay - van tiep tuc mo tunnel...
    goto PROCEED_TUNNEL
)
echo     ... lan !RETRY_COUNT!/30 - dang cho Backend khoi dong...
goto CHECK_BACKEND_PORT

:BACKEND_READY
echo [OK] Backend Spring Boot da san sang tren Port 8080!

:PROCEED_TUNNEL
echo.

:: ==============================================================================
:: BUOC 3: MO CLOUDFLARE TUNNEL CHO BACKEND (PORT 8080)
:: ==============================================================================
echo [3/5] Khoi dong Cloudflare Tunnel cho Backend...

:: Kiem tra / tai cloudflared
set "CLOUDFLARED=C:\tools\cloudflared.exe"
if not exist "!CLOUDFLARED!" (
    echo [DOWNLOAD] Dang tai cloudflared.exe ve C:\tools...
    if not exist "C:\tools" mkdir "C:\tools"
    powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'C:\tools\cloudflared.exe' -UseBasicParsing"
    if !errorlevel! neq 0 (
        echo [ERROR] Khong tai duoc cloudflared.exe. Kiem tra ket noi Internet.
        pause
        exit /b 1
    )
)

:: Dong tunnel cu (neu co)
taskkill /f /im cloudflared.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: Tao logfile sach
set "LOGFILE=%TEMP%\boxora_tunnel.log"
if exist "!LOGFILE!" del /f /q "!LOGFILE!" >nul 2>&1

:: Khoi dong tunnel - cloudflared ghi URL vao STDERR
:: Dung PowerShell start-process de redirect STDERR vao log file
powershell -NoProfile -Command "Start-Process -FilePath '!CLOUDFLARED!' -ArgumentList 'tunnel','--url','http://localhost:8080' -RedirectStandardError '!LOGFILE!' -NoNewWindow"

:: Cho va trich xuat tunnel URL tu log (toi da 30 giay)
echo   - Dang lay Public URL tu Cloudflare Tunnel (toi da 30 giay)...
set "BACKEND_TUNNEL_URL="
set /a TUNNEL_TRY=0

:CHECK_TUNNEL_LOG
ping 127.0.0.1 -n 2 >nul
set /a TUNNEL_TRY+=1
if exist "!LOGFILE!" (
    for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "try { $c = Get-Content -Path '!LOGFILE!' -Raw -ErrorAction SilentlyContinue; if ($c) { $m = [regex]::Match($c, 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com'); if ($m.Success) { Write-Output $m.Value } } } catch {}"`) do (
        if not "%%u"=="" (
            set "BACKEND_TUNNEL_URL=%%u"
            goto TUNNEL_SUCCESS
        )
    )
)
if !TUNNEL_TRY! LSS 15 goto CHECK_TUNNEL_LOG

:TUNNEL_SUCCESS
if "!BACKEND_TUNNEL_URL!"=="" (
    echo [WARNING] Khong lay duoc Tunnel URL. Dang dung localhost:8080 lam fallback.
    echo           Nguoi dung ben ngoai se khong truy cap duoc Backend!
    set "BACKEND_TUNNEL_URL=http://localhost:8080"
) else (
    echo [OK] Backend Tunnel HTTPS public: !BACKEND_TUNNEL_URL!
)
echo.

:: ==============================================================================
:: BUOC 4: BUILD VA DEPLOY FRONTEND LEN CLOUDFLARE PAGES
:: ==============================================================================
echo [4/5] Build va Deploy Frontend len Cloudflare Pages...
cd /d "%~dp0FE\boxora-web"

:: Ghi .env voi tunnel URL thuc
echo   - Ghi .env: VITE_API_BASE_URL=!BACKEND_TUNNEL_URL!
(
    echo VITE_API_BASE_URL=!BACKEND_TUNNEL_URL!
    echo VITE_GOOGLE_CLIENT_ID=564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com
) > .env

:: Build
echo   - Dang build Frontend (npm run build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build Frontend that bai! Kiem tra code va thu lai.
    cd /d "%~dp0"
    pause
    exit /b 1
)
echo [OK] Build Frontend thanh cong!

:: Deploy len Cloudflare Pages
echo   - Dang deploy len Cloudflare Pages (project: boxora-storage)...
call npx wrangler pages deploy dist --project-name=boxora-storage --branch=main --commit-dirty=true
if %errorlevel% neq 0 (
    echo [WARNING] Deploy gap loi. Co the can dang nhap Cloudflare hoac kiem tra ket noi.
    echo           Frontend local van hoat dong qua: http://localhost:5173
) else (
    echo [OK] Deploy len Cloudflare Pages thanh cong!
)

cd /d "%~dp0"
echo.

:: ==============================================================================
:: BUOC 5: HIEN THI KET QUA VA MO TRINH DUYET
:: ==============================================================================
set "FINAL_URL=https://boxora-storage.pages.dev?api=!BACKEND_TUNNEL_URL!"

echo ==============================================================================
echo [5/5] HE THONG BOXORA DEMO ONLINE DA SAN SANG!
echo ==============================================================================
echo.
echo  [FRONTEND]  https://boxora-storage.pages.dev
echo  [BACKEND ]  !BACKEND_TUNNEL_URL!
echo  [SWAGGER ]  !BACKEND_TUNNEL_URL!/swagger-ui.html
echo.
echo  Link chia se toan cau (co san tunnel):
echo    !FINAL_URL!
echo.
echo  Tai khoan dang nhap:
echo    Admin   : admin1@gmail.com / 123456
echo    Manager : manager@gmail.com / 123456
echo.
echo  [CHU Y] Giu cua so nay mo de duy tri Backend Tunnel online.
echo          Neu dong cua so nay, Cloudflare Tunnel se bi ngat!
echo ==============================================================================
echo.
echo  Dang mo trinh duyet...
start "" "!FINAL_URL!"
echo.

:MONITOR_LOOP
ping 127.0.0.1 -n 11 >nul
goto MONITOR_LOOP
