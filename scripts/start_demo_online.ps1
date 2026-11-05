param(
    [switch]$NoBrowser,
    [switch]$NoPause
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "        BOXORA SELF-STORAGE - DEMO ONLINE LAUNCHER (ALL-IN-ONE)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Script nay se tu dong thuc hien 5 buoc:"
Write-Host "  [1/5] Khoi dong PostgreSQL Database (Port 5432)"
Write-Host "  [2/5] Khoi dong Backend Spring Boot (Port 8080)"
Write-Host "  [3/5] Mo Cloudflare Quick Tunnel cho Backend (Port 8080 -> HTTPS)"
Write-Host "  [4/5] Build Frontend & Deploy len Cloudflare Pages (boxora-storage.pages.dev)"
Write-Host "  [5/5] Mo trinh duyet voi URL Online da ket noi san Backend"
Write-Host ""
Write-Host "------------------------------------------------------------------------------"

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
    Write-Host "[INFO] Su dung JDK: $detectedJdk" -ForegroundColor Green
}

# ==============================================================================
# [1/5] KIEM TRA & KHOI DONG POSTGRESQL (PORT 5432)
# ==============================================================================
Write-Host ""
Write-Host "[1/5] Kiem tra PostgreSQL Database (Port 5432)..." -ForegroundColor Yellow
$pgUp = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if ($pgUp) {
    Write-Host "  - PostgreSQL da dang chay tren Port 5432." -ForegroundColor Green
} else {
    Write-Host "  - PostgreSQL chua chay. Dang thu khoi dong Windows Service hoac Docker..."
    Get-Service *postgres* -ErrorAction SilentlyContinue | Start-Service -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $pgUp = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
    if (-not $pgUp) {
        $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
        if ($dockerCmd) {
            $composeFile = Join-Path $RootDir "docker-compose.yml"
            & docker compose -f $composeFile up -d postgres 2>&1 | Out-Null
            Start-Sleep -Seconds 3
        }
    }
    $pgUp = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
    if ($pgUp) {
        Write-Host "  - Da khoi dong PostgreSQL thanh cong!" -ForegroundColor Green
    } else {
        Write-Host "  [CANH BAO] Khong the tu dong bat PostgreSQL tren Port 5432. Hay dam bao PostgreSQL da bat!" -ForegroundColor Red
    }
}

# ==============================================================================
# [2/5] KIEM TRA & KHOI DONG BACKEND SPRING BOOT (PORT 8080)
# ==============================================================================
Write-Host ""
Write-Host "[2/5] Kiem tra Backend Spring Boot (Port 8080)..." -ForegroundColor Yellow
$beUp = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($beUp) {
    Write-Host "  - Backend da dang chay tren Port 8080! Bo qua buoc khoi dong lai." -ForegroundColor Green
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
        Start-Process -FilePath "cmd.exe" -ArgumentList '/k "title BOXORA - BACKEND (PORT 8080) && call setup_and_run_backend.bat 2"' -WorkingDirectory $beDir | Out-Null
    } else {
        Write-Host "  - Chua co file JAR hoac source code moi hon JAR, dang build va khoi dong Backend qua Maven..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList '/k "title BOXORA - BACKEND (PORT 8080) && call setup_and_run_backend.bat 1"' -WorkingDirectory $beDir | Out-Null
    }

    Write-Host "  - Dang cho Backend khoi dong tren Port 8080 (toi da 90 giay)..."
    $beReady = $false
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 3
        if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
            $beReady = $true
            break
        }
        Write-Host "    ... lan $i/30 - dang cho Backend khoi dong..." -ForegroundColor DarkGray
    }

    if ($beReady) {
        Write-Host "  - Backend da san sang tren Port 8080!" -ForegroundColor Green
    } else {
        Write-Host "  [CANH BAO] Backend chua mo Port 8080 sau 90s. Kiem tra cua so BOXORA BACKEND!" -ForegroundColor Red
    }
}

# ==============================================================================
# [3/5] MO CLOUDFLARE QUICK TUNNEL & TU DONG LAY URL HTTPS
# ==============================================================================
Write-Host ""
Write-Host "[3/5] Dang mo Cloudflare Quick Tunnel cho Backend (Port 8080)..." -ForegroundColor Yellow

$cfExe = $null
$cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($cfCmd) {
    $cfExe = $cfCmd.Source
}
if (-not $cfExe) {
    $cfPaths = @(
        "$env:LOCALAPPDATA\cloudflared\cloudflared.exe",
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe"
    )
    foreach ($p in $cfPaths) {
        if (Test-Path $p) {
            $cfExe = $p
            break
        }
    }
}

if (-not $cfExe) {
    Write-Host "  - Chua co 'cloudflared' tren may, dang tu dong tai cloudflared.exe..." -ForegroundColor Cyan
    $cfDir = "$env:LOCALAPPDATA\cloudflared"
    if (-not (Test-Path $cfDir)) {
        New-Item -ItemType Directory -Path $cfDir -Force | Out-Null
    }
    $targetCf = Join-Path $cfDir "cloudflared.exe"
    & curl.exe -L -s -o $targetCf "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    if (Test-Path $targetCf) {
        $cfExe = $targetCf
    }
}

if (-not $cfExe -or -not (Test-Path $cfExe)) {
    Write-Host "[LOI] Khong the tai 'cloudflared.exe'! Vui long kiem tra ket noi mang." -ForegroundColor Red
    exit 1
}

$tunnelLog = Join-Path $env:TEMP "boxora_cloudflared.log"
$env:TUNNEL_DNS_RESOLVER_ADDRS = "1.1.1.1:53,8.8.8.8:53"

Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500
Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue

Write-Host "  - Dang lam nong DNS va khoi dong Cloudflare Tunnel (DNS 1.1.1.1/8.8.8.8, HTTP/2 IPv4)..."
foreach ($h in @("api.trycloudflare.com", "region1.v2.argotunnel.com", "region2.v2.argotunnel.com", "api.cloudflare.com")) {
    Resolve-DnsName $h -Server 1.1.1.1 -ErrorAction SilentlyContinue | Out-Null
    Resolve-DnsName $h -Server 8.8.8.8 -ErrorAction SilentlyContinue | Out-Null
    Resolve-DnsName $h -ErrorAction SilentlyContinue | Out-Null
}

$tunnelUrl = $null
for ($attempt = 1; $attempt -le 3; $attempt++) {
    Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
    $cfArgs = "tunnel --url http://localhost:8080 --protocol http2 --edge-ip-version 4 --no-prechecks --logfile `"$tunnelLog`" --no-autoupdate"
    Start-Process -FilePath $cfExe -ArgumentList $cfArgs -WindowStyle Minimized | Out-Null

    $urlFoundTick = 0
    for ($w = 1; $w -le 18; $w++) {
        Start-Sleep -Seconds 2
        if (Test-Path $tunnelLog) {
            $logContent = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
            if ($logContent -match "https://[a-zA-Z0-9\-]+\.trycloudflare\.com") {
                $candidateUrl = $matches[0].Trim()
                if ($urlFoundTick -eq 0) {
                    $urlFoundTick = $w
                }
                if ($logContent -match "Registered tunnel connection" -or ($w - $urlFoundTick) -ge 2) {
                    $tunnelUrl = $candidateUrl
                    break
                }
            }
        }
        if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
            break
        }
    }

    if ($tunnelUrl) {
        break
    }

    if ($attempt -lt 3) {
        Write-Host "    ... DNS mang phan hoi cham, dang thu ket noi lai Cloudflare Tunnel (lan $($attempt + 1)/3)..." -ForegroundColor Yellow
        Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

if (-not $tunnelUrl) {
    Write-Host "  [LOI] Khong lay duoc URL tu Cloudflare Tunnel!" -ForegroundColor Red
    Write-Host "  Vui long kiem tra ket noi mang hoac file log: $tunnelLog" -ForegroundColor Red
    exit 1
}

Write-Host "  - Da tao Tunnel thanh cong!" -ForegroundColor Green
Write-Host "  - Backend HTTPS URL: $tunnelUrl" -ForegroundColor Cyan

# ==============================================================================
# [4/5] BUILD FRONTEND VOI URL TUNNEL & DEPLOY CLOUDFLARE PAGES
# ==============================================================================
Write-Host ""
Write-Host "[4/5] Dang cap nhat cau hinh Frontend, Build va Deploy len Cloudflare Pages..." -ForegroundColor Yellow

$feDir = Join-Path $RootDir "FE\boxora-web"
$feEnvFile = Join-Path $feDir ".env"
$googleClientId = "564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$onlineEnvContent = "VITE_API_BASE_URL=$tunnelUrl`r`nVITE_GOOGLE_CLIENT_ID=$googleClientId`r`n"
$localEnvContent  = "VITE_API_BASE_URL=http://localhost:8080`r`nVITE_GOOGLE_CLIENT_ID=$googleClientId`r`n"

$buildExitCode = 1
try {
    [System.IO.File]::WriteAllText($feEnvFile, $onlineEnvContent, $utf8NoBom)
    Push-Location $feDir
    Write-Host "  - Dang chay npm run build..."
    & cmd.exe /c "npm run build"
    $buildExitCode = $LASTEXITCODE
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    # Khoi phuc .env ve localhost ngay sau khi build xong de khong anh huong start_local.bat
    [System.IO.File]::WriteAllText($feEnvFile, $localEnvContent, $utf8NoBom)
}

if ($buildExitCode -ne 0) {
    Write-Host "  [LOI] Build Frontend that bai!" -ForegroundColor Red
    exit 1
}

Push-Location $feDir
try {
    Write-Host "  - Dang deploy len Cloudflare Pages (boxora-storage)..."
    & cmd.exe /c "npx --yes wrangler pages deploy dist --project-name boxora-storage --branch=main --commit-dirty=true"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [CANH BAO] Deploy Cloudflare Pages gap loi - co the chua login wrangler." -ForegroundColor Yellow
        Write-Host "  Ban van co the dung link: https://boxora-storage.pages.dev?api=$tunnelUrl" -ForegroundColor Cyan
    }
} finally {
    Pop-Location -ErrorAction SilentlyContinue
}

# ==============================================================================
# [5/5] HOAN TAT & MO TRINH DUYET
# ==============================================================================
$finalUrl = "https://boxora-storage.pages.dev?api=$tunnelUrl"
try {
    Set-Clipboard -Value $finalUrl -ErrorAction SilentlyContinue
} catch {}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "                     HE THONG DEMO ONLINE DA SAN SANG!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  - Backend Local     : http://localhost:8080"
Write-Host "  - Backend Tunnel    : $tunnelUrl" -ForegroundColor Cyan
Write-Host "  - Frontend Online   : https://boxora-storage.pages.dev"
Write-Host "  - Link Demo Day Du  : $finalUrl" -ForegroundColor Yellow
Write-Host "    (Da tu dong COPY link nay vao Clipboard - chi can Ctrl+V de gui!)" -ForegroundColor Green
Write-Host ""
Write-Host "  [LUU Y QUAN TRONG]:" -ForegroundColor Yellow
Write-Host "  KHONG DONG cua so 'BOXORA - BACKEND' va 'cloudflared'"
Write-Host "  trong suot qua trinh Demo!"
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "Dang mo trinh duyet..."
    Start-Process $finalUrl | Out-Null
}

exit 0

