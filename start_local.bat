@echo off
setlocal EnableDelayedExpansion
title BOXORA - KHOI DONG BACKEND VA FRONTEND LOCAL
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo              BOXORA - KHOI DONG BACKEND VA FRONTEND TAI LOCAL
echo ==============================================================================
echo.
echo Quy trinh tu dong:
echo   1. Kiem tra va khoi dong Database PostgreSQL (Port 5432)
echo   2. Kiem tra va khoi dong Backend Spring Boot (Port 8080)
echo   3. Cau hinh moi truong Frontend ket noi Local Backend (http://localhost:8080)
echo   4. Khoi dong Frontend React + Vite Dev Server (Port 5173)
echo   5. Tu dong mo trinh duyet truy cap http://localhost:5173
echo.

:: -----------------------------------------------------------------------------
:: BUOC 1: KIEM TRA POSTGRESQL (PORT 5432)
:: -----------------------------------------------------------------------------
echo [1/4] Kiem tra Database PostgreSQL (Port 5432)...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet; if (-not $t) { exit 1 }"
if %errorlevel% neq 0 (
    echo [WARNING] PostgreSQL chua bat! Dang thu khoi dong Service PostgreSQL...
    powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service"
    ping 127.0.0.1 -n 3 >nul
) else (
    echo [OK] PostgreSQL dang hoat dong tot tren Port 5432.
)

:: -----------------------------------------------------------------------------
:: BUOC 2: KHOI DONG BACKEND SPRING BOOT (PORT 8080)
:: -----------------------------------------------------------------------------
echo.
echo [2/4] Kiem tra Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Backend Spring Boot da dang chay tren Port 8080!
    goto CHECK_FRONTEND
)

echo   - Tim kiem JDK tren he thong...
set "FOUND_JDK="
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe" (
    set "FOUND_JDK=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
) else (
    for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-21*" "C:\Program Files\Eclipse Adoptium\jdk-17*" "C:\Program Files\Java\jdk-21*" "C:\Program Files\Java\jdk-17*") do (
        if exist "%%~D\bin\java.exe" set "FOUND_JDK=%%~D"
    )
)

if defined FOUND_JDK (
    echo   - Su dung JDK: !FOUND_JDK!
    set "JAVA_HOME=!FOUND_JDK!"
    set "PATH=!FOUND_JDK!\bin;!PATH!"
)

echo   - Dang bat Backend trong cua so rieng...
if exist "%~dp0BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar" (
    start "BOXORA - BACKEND SPRING BOOT (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "title BOXORA - BACKEND (PORT 8080) && java -jar target\boxora-backend-0.0.1-SNAPSHOT.jar"
) else (
    start "BOXORA - BACKEND SPRING BOOT (PORT 8080)" /d "%~dp0BE\boxora" cmd /k "title BOXORA - BACKEND (PORT 8080) && java -jar target\boxora-backend-0.0.1-SNAPSHOT.jar"
)

echo   - Dang cho Backend san sang tren Port 8080...
set /a RETRY_COUNT=0
:CHECK_BACKEND_LOOP
ping 127.0.0.1 -n 3 >nul
set /a RETRY_COUNT+=1
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 8080 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Backend Spring Boot da san sang tren Port 8080!
    goto CHECK_FRONTEND
)
if !RETRY_COUNT! GEQ 30 (
    echo [WARNING] Backend mat nhieu thoi gian hon du kien de khoi dong, tiep tuc bat Frontend...
    goto CHECK_FRONTEND
)
echo     ...dang cho Backend khoi dong (lan !RETRY_COUNT!/30)
goto CHECK_BACKEND_LOOP

:: -----------------------------------------------------------------------------
:: BUOC 3: CAU HINH VA KHOI DONG FRONTEND (PORT 5173)
:: -----------------------------------------------------------------------------
:CHECK_FRONTEND
echo.
echo [3/4] Chuan bi moi truong Frontend Local...

:: Dam bao file .env trong FE tro ve localhost:8080 khi chay local
(
    echo VITE_API_BASE_URL=http://localhost:8080
    echo VITE_GOOGLE_CLIENT_ID=564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com
) > "%~dp0FE\boxora-web\.env"
echo [OK] Da cau hinh VITE_API_BASE_URL va VITE_GOOGLE_CLIENT_ID cho Frontend.

echo.
echo [4/4] Khoi dong Frontend Vite Dev Server...
powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [OK] Frontend da dang chay tren Port 5173!
) else (
    echo   - Dang bat Vite Dev Server trong cua so rieng...
    start "BOXORA - FRONTEND VITE (PORT 5173)" /d "%~dp0FE\boxora-web" cmd /k "title BOXORA - FRONTEND (PORT 5173) && npm run dev"
    
    echo   - Dang cho Frontend san sang tren Port 5173...
    set /a FE_RETRY=0
    :CHECK_FE_LOOP
    ping 127.0.0.1 -n 3 >nul
    set /a FE_RETRY+=1
    powershell -NoProfile -Command "$t = Test-NetConnection -ComputerName 127.0.0.1 -Port 5173 -InformationLevel Quiet; if ($t) { exit 0 } else { exit 1 }"
    if %errorlevel% equ 0 (
        echo [OK] Frontend da san sang tren Port 5173!
        goto LAUNCH_BROWSER
    )
    if !FE_RETRY! GEQ 15 goto LAUNCH_BROWSER
    goto CHECK_FE_LOOP
)

:: -----------------------------------------------------------------------------
:: BUOC 4: MO TRINH DUYET
:: -----------------------------------------------------------------------------
:LAUNCH_BROWSER
echo.
echo ==============================================================================
echo              HE THONG BOXORA LOCAL DA KHOI DONG THANH CONG!
echo ==============================================================================
echo.
echo   * Frontend Web UI : http://localhost:5173
echo   * Backend REST API: http://localhost:8080/api/v1
echo   * Swagger API Docs: http://localhost:8080/swagger-ui.html
echo.
echo Dang tu dong mo trinh duyet...
start http://localhost:5173
echo.
echo [NOTE] De tat he thong, ban chi can dong cac cua so Backend va Frontend.
echo.
pause
