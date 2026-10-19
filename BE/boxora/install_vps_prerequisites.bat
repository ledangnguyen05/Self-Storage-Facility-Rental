@echo off
setlocal EnableDelayedExpansion
title BOXORA - VPS Windows Prerequisites Installer (JDK 17, PostgreSQL, NSSM)
chcp 65001 >nul

echo ==============================================================================
echo       BOXORA BACKEND - TOOL & PREREQUISITES INSTALLER CHO WINDOWS VPS
echo ==============================================================================
echo.

:: 1. Kiem tra quyen Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Ban phai chay file .bat nay voi quyen Run as Administrator!
    echo Vui long chuot phai vao file va chon "Run as administrator".
    pause
    exit /b 1
)

echo [INFO] Quyen Administrator hop le. Bat dau kiem tra va cai dat...
echo.

:: 2. Kiem tra / Cai dat JDK 17 (Eclipse Temurin)
echo ------------------------------------------------------------------------------
echo [1/3] Kiem tra Java JDK 17...
where java >nul 2>&1
if %errorlevel% equ 0 (
    java -version
    echo [OK] Java da ton tai tren he thong.
) else (
    echo [INSTALL] Dang cai dat Eclipse Temurin JDK 17 LTS...
    winget install --id EclipseAdoptium.Temurin.17.JDK -e --source winget --accept-source-agreements --accept-package-agreements
    echo [INFO] Da cai dat JDK 17.
)

:: 3. Kiem tra / Cai dat PostgreSQL
echo ------------------------------------------------------------------------------
echo [2/3] Kiem tra PostgreSQL...
where psql >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] PostgreSQL da duoc cai dat.
) else (
    echo [INSTALL] Dang cai dat PostgreSQL thong qua winget...
    winget install --id PostgreSQL.PostgreSQL -e --source winget --accept-source-agreements --accept-package-agreements
    echo [NOTE] Sau khi cai dat PostgreSQL, hay nho mat khau ban da dat cho user postgres.
)

:: 4. Kiem tra / Cai dat NSSM (Service Manager)
echo ------------------------------------------------------------------------------
echo [3/3] Kiem tra & Cai dat NSSM (Quan ly Service Windows)...
if exist "C:\nssm\win64\nssm.exe" (
    echo [OK] NSSM da ton tai tai C:\nssm\win64\nssm.exe
) else (
    echo [DOWNLOAD] Dang tai NSSM...
    if not exist "C:\nssm" mkdir "C:\nssm"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'C:\nssm\nssm.zip'"
    if exist "C:\nssm\nssm.zip" (
        echo [EXTRACT] Dang giai nen NSSM...
        powershell -Command "Expand-Archive -Path 'C:\nssm\nssm.zip' -DestinationPath 'C:\nssm' -Force"
        xcopy /s /y /q "C:\nssm\nssm-2.24\*" "C:\nssm\" >nul 2>&1
        del "C:\nssm\nssm.zip"
        echo [OK] NSSM da duoc thiet lap tai C:\nssm\win64\nssm.exe
    ) else (
        echo [WARN] Khong the tai tu dong NSSM.
    )
)

echo.
echo ==============================================================================
echo   DA HOAN TAT CAI DAT CAC PHAN MEM CO BAN CHO VPS WINDOWS!
echo   Vui long khoi dong lai Command Prompt / PowerShell de nhan du PATH va JAVA_HOME.
echo ==============================================================================
echo.
pause
