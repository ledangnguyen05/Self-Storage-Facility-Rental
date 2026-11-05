param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "             BOXORA - KHOI DONG LOCAL (BACKEND + FRONTEND)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# --- PHAT HIEN JDK 21/17 CHO BACKEND ---
$jdkCandidates = @(
    "C:\Program Files\Eclipse Adoptium\jdk-21.0.8.9-hotspot"
)
$jdkWildcards = @(
    "C:\Program Files\Eclipse Adoptium\jdk-21*",
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Java\jdk-21*",
    "C:\Program Files\Java\jdk-17*",
    "C:\Program Files\Microsoft\jdk-21*",
    "C:\Program Files\Microsoft\jdk-17*"
)
foreach ($w in $jdkWildcards) {
    Get-ChildItem -Path $w -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $jdkCandidates += $_.FullName
    }
}
$detectedJdk = $null
foreach ($candidate in $jdkCandidates) {
    if (Test-Path (Join-Path $candidate "bin\java.exe")) {
        $detectedJdk = $candidate
        break
    }
}
if ($detectedJdk) {
    $env:JAVA_HOME = $detectedJdk
    $env:PATH = "$detectedJdk\bin;$env:PATH"
    Write-Host "[OK] JDK phat hien: $detectedJdk" -ForegroundColor Green
} else {
    Write-Host "[OK] Su dung Java co san trong PATH he thong."
}
Write-Host ""

# [1/4] PostgreSQL (5432)
Write-Host "[1/4] Kiem tra Database PostgreSQL (Port 5432)..." -ForegroundColor Yellow
if (-not (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue)) {
    Write-Host "  - Dang thu khoi dong Windows Service PostgreSQL..."
    Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}
if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "[OK] PostgreSQL dang hoat dong tren Port 5432." -ForegroundColor Green
} else {
    Write-Host "[ERROR] Khong the khoi dong PostgreSQL! Vui long bat PostgreSQL thu cong." -ForegroundColor Red
    exit 1
}
Write-Host ""

# [2/4] Backend Spring Boot (8080)
Write-Host "[2/4] Kiem tra Backend Spring Boot (Port 8080)..." -ForegroundColor Yellow
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Backend Spring Boot da dang chay tren Port 8080." -ForegroundColor Green
} else {
    $beDir = Join-Path $RootDir "BE\boxora"
    $jarPath = Join-Path $beDir "target\boxora-backend-0.0.1-SNAPSHOT.jar"
    $srcDir = Join-Path $beDir "src"
    $useExistingJar = $false

    if (Test-Path $jarPath) {
        $jarTime = (Get-Item $jarPath).LastWriteTime
        $newerFile = Get-ChildItem -Path $srcDir -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.LastWriteTime -gt $jarTime } |
            Select-Object -First 1
        if (-not $newerFile) {
            $useExistingJar = $true
        }
    }

    if ($useExistingJar) {
        Write-Host "  - Tim thay JAR moi nhat, khoi dong truc tiep..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList '/k "title BOXORA - BACKEND (8080) && call setup_and_run_backend.bat 2"' -WorkingDirectory $beDir | Out-Null
    } else {
        Write-Host "  - Chua co file JAR hoac source code moi hon JAR, dang build va chay Backend..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList '/k "title BOXORA - BACKEND (8080) && call setup_and_run_backend.bat 1"' -WorkingDirectory $beDir | Out-Null
    }

    Write-Host "  - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)..."
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 3
        if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
            break
        }
        Write-Host "    ... lan $i/30 - dang cho Backend khoi dong..." -ForegroundColor DarkGray
    }

    if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "[OK] Backend Spring Boot da san sang tren Port 8080!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Backend mat nhieu thoi gian hon du kien - tiep tuc khoi dong Frontend..." -ForegroundColor Yellow
    }
}
Write-Host ""

# [3/4] Ghi .env Frontend -> localhost:8080
Write-Host "[3/4] Cau hinh moi truong Frontend (ket noi Local Backend)..." -ForegroundColor Yellow
$feDir = Join-Path $RootDir "FE\boxora-web"
$feEnvFile = Join-Path $feDir ".env"
$googleClientId = "564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com"
$localEnvContent = "VITE_API_BASE_URL=http://localhost:8080`r`nVITE_GOOGLE_CLIENT_ID=$googleClientId`r`n"
[System.IO.File]::WriteAllText($feEnvFile, $localEnvContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "[OK] Da ghi .env: VITE_API_BASE_URL=http://localhost:8080" -ForegroundColor Green
Write-Host ""

# [4/4] Khoi dong Frontend Vite Dev Server (Port 5173)
Write-Host "[4/4] Khoi dong Frontend Vite Dev Server (Port 5173)..." -ForegroundColor Yellow
if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "[OK] Frontend Vite Dev Server da dang chay tren Port 5173." -ForegroundColor Green
} else {
    Write-Host "  - Dang khoi dong Vite Dev Server trong cua so rieng..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList '/k "title BOXORA - FRONTEND VITE (5173) && npm run dev"' -WorkingDirectory $feDir | Out-Null

    Write-Host "  - Dang cho Frontend san sang tren Port 5173 (toi da 45 giay)..."
    for ($i = 1; $i -le 15; $i++) {
        Start-Sleep -Seconds 3
        if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
            break
        }
        Write-Host "    ... lan $i/15 - dang cho Vite khoi dong..." -ForegroundColor DarkGray
    }

    if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "[OK] Frontend Vite da san sang tren Port 5173!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Frontend chua san sang - van mo trinh duyet..." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "             BOXORA LOCAL DA SAN SANG!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [FRONTEND]  http://localhost:5173"
Write-Host "  [BACKEND ]  http://localhost:8080"
Write-Host "  [SWAGGER ]  http://localhost:8080/swagger-ui.html"
Write-Host "  [API Docs]  http://localhost:8080/api/v1"
Write-Host ""
Write-Host "  Tai khoan dang nhap:"
Write-Host "    Admin   : admin1@gmail.com / 123456"
Write-Host "    Manager : manager@gmail.com / 123456"
Write-Host ""
Write-Host "  [NOTE] De tat he thong, dong cac cua so Backend va Frontend."
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "Dang mo trinh duyet tai http://localhost:5173 ..."
    Start-Process "http://localhost:5173" | Out-Null
}

exit 0

