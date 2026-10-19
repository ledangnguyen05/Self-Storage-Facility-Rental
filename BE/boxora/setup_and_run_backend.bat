@echo off
setlocal EnableDelayedExpansion
title BOXORA - Backend Build and Run Runner
chcp 65001 >nul

cd /d "%~dp0"

echo ==============================================================================
echo                 BOXORA SPRING BOOT - BACKEND BUILD AND RUN
echo ==============================================================================
echo.

:: 1. Tu dong tim kiem JDK 17 tro len (Uu tien Adoptium JDK 21 / JDK 17)
set "FOUND_JDK="

:: Kiem tra cac duong dan JDK pho bien
if exist "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot\bin\javac.exe" (
    set "FOUND_JDK=C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
) else (
    for /d %%D in ("C:\Program Files\Eclipse Adoptium\jdk-17*" "C:\Program Files\Eclipse Adoptium\jdk-21*" "C:\Program Files\Java\jdk-17*" "C:\Program Files\Java\jdk-21*" "C:\Program Files\Microsoft\jdk-17*" "C:\Program Files\Microsoft\jdk-21*") do (
        if exist "%%~D\bin\javac.exe" (
            set "FOUND_JDK=%%~D"
        )
    )
)

if defined FOUND_JDK (
    echo [INFO] Tu dong phat hien JDK phu hop: !FOUND_JDK!
    set "JAVA_HOME=!FOUND_JDK!"
    set "PATH=!FOUND_JDK!\bin;!PATH!"
) else (
    :: Neu khong tim thay thu muc chuan, kiem tra lenh java hien tai
    where java >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Khong tim thay Java JDK 17 tren may!
        echo Vui long cai dat JDK 17 bang file install_vps_prerequisites.bat.
        echo.
        pause
        exit /b 1
    )
)

:: Kiem tra phien ban Java
echo [INFO] Phien ban Java su dung:
java -version
echo.

:: 2. Kiem tra file .env
if not exist ".env" (
    echo [WARNING] Chua tim thay file .env trong BE/boxora!
    echo [ACTION] Dang tu dong sao chep tu .env.example sang .env...
    copy ".env.example" ".env" >nul
    echo [NOTE] Da tao file .env. Vui long kiem tra va dien mat khau DB_PASSWORD neu can!
    echo.
)

:: 3. Menu lua chon che do chay
if not "%~1"=="" (
    set "CHOICE=%~1"
) else (
    echo ------------------------------------------------------------------------------
    echo Chon mot trong cac che do sau:
    echo   [1] Build file JAR moi va Chay truc tiep tren Console (Xem log ngay)
    echo   [2] Chi Chay file JAR hien co (Khong build lai - Khoi dong cuc nhanh)
    echo   [3] Cai dat Backend thanh Windows Service 24/7 (Chay ngam qua NSSM)
    echo   [4] Khoi dong lai (Restart) Windows Service BoxoraBackend
    echo   [5] Dung (Stop) Windows Service BoxoraBackend
    echo ------------------------------------------------------------------------------
    set /p CHOICE="Nhap lua chon [1-5] (Mac dinh la 1): "
)
if "!CHOICE!"=="" set CHOICE=1

if "!CHOICE!"=="1" goto BUILD_AND_RUN
if "!CHOICE!"=="2" goto RUN_JAR
if "!CHOICE!"=="3" goto INSTALL_SERVICE
if "!CHOICE!"=="4" goto RESTART_SERVICE
if "!CHOICE!"=="5" goto STOP_SERVICE

:BUILD_AND_RUN
echo.
echo [1/2] Dang dong goi Backend bang Maven Wrapper (bo qua test de build nhanh)...
call .\mvnw.cmd clean package -DskipTests
if !errorlevel! neq 0 (
    echo [ERROR] Build that bai! Vui long kiem tra log loi o tren.
    echo.
    pause
    exit /b !errorlevel!
)
echo [OK] Build thanh cong file JAR!
goto RUN_JAR

:RUN_JAR
echo.
echo [2/2] Dang khoi dong Boxora Backend (Port 8080)...
set "JAR_FILE=target\boxora-backend-0.0.1-SNAPSHOT.jar"
if not exist "!JAR_FILE!" (
    echo [ERROR] Khong tim thay file !JAR_FILE!. Vui long chon tuy chon [1] de build truoc!
    echo.
    pause
    exit /b 1
)

set "JAVA_EXE=java"
if defined FOUND_JDK (
    if exist "!FOUND_JDK!\bin\java.exe" set "JAVA_EXE=!FOUND_JDK!\bin\java.exe"
)

echo [RUNNING] "!JAVA_EXE!" -Xms512m -Xmx1536m -jar !JAR_FILE!
echo ------------------------------------------------------------------------------
echo Nhan Ctrl + C de dung ung dung.
echo ------------------------------------------------------------------------------
"!JAVA_EXE!" -Xms512m -Xmx1536m -jar "!JAR_FILE!"
if !errorlevel! neq 0 (
    echo [INFO] Ung dung da dung lai voi ma loi: !errorlevel!
)
pause
exit /b 0

:INSTALL_SERVICE
echo.
echo Dang cai dat Boxora Backend thanh Windows Service qua NSSM...
set "NSSM_PATH=C:\nssm\win64\nssm.exe"
if not exist "!NSSM_PATH!" (
    echo [ERROR] Khong tim thay !NSSM_PATH!. Vui long chay file install_vps_prerequisites.bat de cai NSSM!
    echo.
    pause
    exit /b 1
)

if not exist "target\boxora-backend-0.0.1-SNAPSHOT.jar" (
    echo [INFO] Dang build file JAR truoc khi tao service...
    call .\mvnw.cmd clean package -DskipTests
)

set "JAVA_BIN=java.exe"
if defined JAVA_HOME (
    set "JAVA_BIN=!JAVA_HOME!\bin\java.exe"
)

echo [INFO] Su dung Java tai: !JAVA_BIN!
echo [INFO] Thu muc lam viec: %cd%

"!NSSM_PATH!" stop BoxoraBackend >nul 2>&1
"!NSSM_PATH!" remove BoxoraBackend confirm >nul 2>&1

"!NSSM_PATH!" install BoxoraBackend "!JAVA_BIN!" "-Xms512m -Xmx1536m -jar target\boxora-backend-0.0.1-SNAPSHOT.jar"
"!NSSM_PATH!" set BoxoraBackend AppDirectory "%cd%"
"!NSSM_PATH!" set BoxoraBackend Start SERVICE_AUTO_START
"!NSSM_PATH!" start BoxoraBackend

echo.
echo [OK] Da cai dat va khoi dong Windows Service BoxoraBackend thanh cong!
echo Backend se tu dong chay ngam 24/7 va tu bat moi khi reboot VPS.
echo Kiem tra trang thai tai: services.msc hoac http://localhost:8080/swagger-ui.html
echo.
pause
exit /b 0

:RESTART_SERVICE
echo.
echo Dang khoi dong lai BoxoraBackend Windows Service...
if exist "C:\nssm\win64\nssm.exe" (
    C:\nssm\win64\nssm.exe restart BoxoraBackend
) else (
    net stop BoxoraBackend
    net start BoxoraBackend
)
echo [OK] Da gui tin hieu restart service!
echo.
pause
exit /b 0

:STOP_SERVICE
echo.
echo Dang dung BoxoraBackend Windows Service...
if exist "C:\nssm\win64\nssm.exe" (
    C:\nssm\win64\nssm.exe stop BoxoraBackend
) else (
    net stop BoxoraBackend
)
echo [OK] Da dung service!
echo.
pause
exit /b 0
