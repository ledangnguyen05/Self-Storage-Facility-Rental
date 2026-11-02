@echo off
setlocal EnableDelayedExpansion
title BOXORA - KHOI DONG LOCAL (BACKEND + FRONTEND)
chcp 65001 >nul

cd /d "%~dp0"

:: ==============================================================================
::   BOXORA - KHOI DONG LOCAL
::   1. Kiem tra / Khoi dong PostgreSQL (5432)
::   2. Kiem tra / Khoi dong Backend Spring Boot (8080)
::   3. Ghi .env Frontend -> localhost:8080
::   4. Khoi dong Frontend Vite Dev Server (5173)
::   5. Mo trinh duyet http://localhost:5173
:: ==============================================================================

echo ==============================================================================
echo              BOXORA - KHOI DONG LOCAL (BACKEND + FRONTEND)
echo ==============================================================================
echo.

:: ==============================================================================
:: BUOC 0: TIM KIEM JDK PHU HOP (17 hoac 21)
:: ==============================================================================
set "FOUND_JDK="
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\java.exe" set "FOUND_JDK=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
if defined FOUND_JDK goto APPLY_JDK

for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-21*" "C:\Program Files\Eclipse Adoptium\jdk-17*" "C:\Program Files\Java\jdk-21*" "C:\Program Files\Java\jdk-17*" "C:\Program Files\Microsoft\jdk-21*" "C:\Program Files\Microsoft\jdk-17*") do (
    if exist "%%~D\bin\java.exe" set "FOUND_JDK=%%~D"
)
if not defined FOUND_JDK goto DEFAULT_JAVA

:APPLY_JDK
set "JAVA_HOME=!FOUND_JDK!"
set "PATH=!FOUND_JDK!\bin;!PATH!"
echo [OK] JDK phat hien: !FOUND_JDK!
goto JAVA_DONE

:DEFAULT_JAVA
echo [OK] Su dung Java co san trong PATH he thong.

:JAVA_DONE
echo.

:: ==============================================================================
:: BUOC 1: KIEM TRA VA KHOI DONG POSTGRESQL (PORT 5432)
:: ==============================================================================
echo [1/4] Kiem tra Database PostgreSQL (Port 5432)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto PG_READY

echo [WARNING] PostgreSQL chua chay! Dang thu khoi dong Windows Service PostgreSQL...
powershell -NoProfile -Command "Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue"
ping 127.0.0.1 -n 5 >nul
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto PG_READY

echo [ERROR] Khong the khoi dong PostgreSQL! Vui long bat PostgreSQL thu cong.
pause
exit /b 1

:PG_READY
echo [OK] PostgreSQL dang hoat dong tren Port 5432.
echo.

:: ==============================================================================
:: BUOC 2: KIEM TRA VA KHOI DONG BACKEND SPRING BOOT (PORT 8080)
:: ==============================================================================
echo [2/4] Kiem tra Backend Spring Boot (Port 8080)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto BACKEND_ALREADY_UP

set "JAR_FILE=%~dp0BE\boxora\target\boxora-backend-0.0.1-SNAPSHOT.jar"
if exist "!JAR_FILE!" goto START_BACKEND_JAR

echo   - Chua co file JAR, dang build va chay Backend (lan dau co the mat vai phut)...
start "BOXORA - BACKEND (8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 1"
goto WAIT_BACKEND

:START_BACKEND_JAR
echo   - Tim thay JAR, khoi dong truc tiep (khong build lai)...
start "BOXORA - BACKEND (8080)" /d "%~dp0BE\boxora" cmd /k "call setup_and_run_backend.bat 2"

:WAIT_BACKEND
echo   - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)...
set /a RETRY_COUNT=0

:CHECK_BACKEND_LOOP
ping 127.0.0.1 -n 3 >nul
set /a RETRY_COUNT+=1
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto BACKEND_READY_MSG
if !RETRY_COUNT! GEQ 30 goto BACKEND_TIMEOUT_MSG
echo     ... lan !RETRY_COUNT!/30 - dang cho Backend khoi dong...
goto CHECK_BACKEND_LOOP

:BACKEND_ALREADY_UP
echo [OK] Backend Spring Boot da dang chay tren Port 8080.
goto CHECK_FRONTEND

:BACKEND_READY_MSG
echo [OK] Backend Spring Boot da san sang tren Port 8080!
goto CHECK_FRONTEND

:BACKEND_TIMEOUT_MSG
echo [WARNING] Backend mat nhieu thoi gian hon du kien - tiep tuc khoi dong Frontend...
goto CHECK_FRONTEND

:: ==============================================================================
:: BUOC 3: CAU HINH FRONTEND (GHI .ENV -> LOCALHOST)
:: ==============================================================================
:CHECK_FRONTEND
echo.
echo [3/4] Cau hinh moi truong Frontend (ket noi Local Backend)...

echo VITE_API_BASE_URL=http://localhost:8080> "%~dp0FE\boxora-web\.env"
echo VITE_GOOGLE_CLIENT_ID=564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com>> "%~dp0FE\boxora-web\.env"
echo [OK] Da ghi .env: VITE_API_BASE_URL=http://localhost:8080
echo.

:: ==============================================================================
:: BUOC 4: KHOI DONG FRONTEND VITE DEV SERVER (PORT 5173)
:: ==============================================================================
echo [4/4] Khoi dong Frontend Vite Dev Server (Port 5173)...
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto FE_ALREADY_UP

echo   - Dang khoi dong Vite Dev Server trong cua so rieng...
start "BOXORA - FRONTEND VITE (5173)" /d "%~dp0FE\boxora-web" cmd /k "npm run dev"

echo   - Dang cho Frontend san sang tren Port 5173 (toi da 45 giay)...
set /a FE_RETRY=0

:CHECK_FE_LOOP
ping 127.0.0.1 -n 3 >nul
set /a FE_RETRY+=1
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 goto FE_READY_MSG
if !FE_RETRY! GEQ 15 goto FE_TIMEOUT_MSG
echo     ... lan !FE_RETRY!/15 - dang cho Vite khoi dong...
goto CHECK_FE_LOOP

:FE_ALREADY_UP
echo [OK] Frontend Vite Dev Server da dang chay tren Port 5173.
goto LAUNCH_BROWSER

:FE_READY_MSG
echo [OK] Frontend Vite da san sang tren Port 5173!
goto LAUNCH_BROWSER

:FE_TIMEOUT_MSG
echo [WARNING] Frontend chua san sang - van mo trinh duyet...
goto LAUNCH_BROWSER

:: ==============================================================================
:: MO TRINH DUYET VA HIEN THI THONG TIN
:: ==============================================================================
:LAUNCH_BROWSER
echo.
echo ==============================================================================
echo              BOXORA LOCAL DA SAN SANG!
echo ==============================================================================
echo.
echo  [FRONTEND]  http://localhost:5173
echo  [BACKEND ]  http://localhost:8080
echo  [SWAGGER ]  http://localhost:8080/swagger-ui.html
echo  [API Docs]  http://localhost:8080/api/v1
echo.
echo  Tai khoan dang nhap:
echo    Admin   : admin1@gmail.com / 123456
echo    Manager : manager@gmail.com / 123456
echo.
echo  [NOTE] De tat he thong, dong cac cua so Backend va Frontend.
echo ==============================================================================
echo.
echo  Dang mo trinh duyet tai http://localhost:5173 ...
start "" "http://localhost:5173"
echo.
echo  Giu cua so nay de theo doi. Nhan phim bat ky de dong.
echo.
pause