param(
    [switch]$NoBrowser,
    [switch]$NoPause
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

# Vo hieu hoa QuickEdit Mode tren cua so Launcher de tranh bi dung khi click chuot
try {
    $consoleSig = '[DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int h); [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out uint m); [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, uint m);'
    $winConsole = Add-Type -MemberDefinition $consoleSig -Name "Win32ConsoleMode" -Namespace "BoxoraLauncher" -PassThru -ErrorAction SilentlyContinue
    if ($winConsole) {
        $stdIn = $winConsole::GetStdHandle(-10)
        $mode = [uint32]0
        if ($winConsole::GetConsoleMode($stdIn, [ref]$mode)) {
            [void]$winConsole::SetConsoleMode($stdIn, ($mode -band (-bnot 0x0040)) -bor 0x0080)
        }
    }
} catch {}

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "        BOXORA SELF-STORAGE - DEMO ONLINE LAUNCHER (ALL-IN-ONE)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Script nay se tu dong thuc hien 5 buoc:"
Write-Host "  [1/5] Khoi dong PostgreSQL Database (Port 5432)"
Write-Host "  [2/5] Khoi dong & Kiem tra HTTP Backend Spring Boot (Port 8080)"
Write-Host "  [3/5] Mo Cloudflare Quick Tunnel da tuong thich moi mang Wi-Fi / 4G"
Write-Host "  [4/5] Build Frontend & Deploy len Cloudflare Pages (boxora-storage.pages.dev)"
Write-Host "  [5/5] Mo trinh duyet + Che do Auto-Heal tu phuc hoi khi doi Wi-Fi"
Write-Host ""
Write-Host "------------------------------------------------------------------------------"

# --- HELPER: KHOI DONG TIEN TRINH DOC LAP (KHONG BI TAT THEO CUA SO CHA) ---
function Start-DetachedProcess {
    param(
        [string]$CommandLine,
        [string]$WorkingDirectory = $RootDir,
        [uint16]$ShowWindow = 7 # 7 = SW_SHOWMINNOACTIVE (Thu nho tren taskbar, khong chiem focus)
    )
    try {
        $startup = New-CimInstance -ClassName Win32_ProcessStartup -Property @{ ShowWindow = [uint16]$ShowWindow } -ClientOnly
        $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
            CommandLine = $CommandLine
            CurrentDirectory = $WorkingDirectory
            ProcessStartupInformation = $startup
        } -ErrorAction Stop
        if ($result.ReturnValue -eq 0 -and $result.ProcessId) {
            return [int]$result.ProcessId
        }
    } catch {}

    # Fallback neu WMI bi han che
    $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c $CommandLine" -WorkingDirectory $WorkingDirectory -WindowStyle Minimized -PassThru
    if ($proc) { return $proc.Id }
    return 0
}

# --- HELPER: KIEM TRA BACKEND THUC SU PHAN HOI HTTP 200 ---
function Test-BackendHttpReady {
    try {
        $code = & curl.exe -4 -s -m 3 -o NUL -w "%{http_code}" "http://127.0.0.1:8080/api/v1/facilities" 2>$null
        if ($code -eq "200") {
            return $true
        }
    } catch {}
    return $false
}

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
function Ensure-PostgreSQLRunning {
    $pgUp = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
    if ($pgUp) {
        return $true
    }
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
    return ($null -ne (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue))
}

Write-Host ""
Write-Host "[1/5] Kiem tra PostgreSQL Database (Port 5432)..." -ForegroundColor Yellow
if (Ensure-PostgreSQLRunning) {
    Write-Host "  - PostgreSQL dang hoat dong tot tren Port 5432." -ForegroundColor Green
} else {
    Write-Host "  [CANH BAO] Khong the tu dong bat PostgreSQL tren Port 5432. Hay dam bao PostgreSQL da bat!" -ForegroundColor Red
}

# ==============================================================================
# [2/5] KIEM TRA & KHOI DONG BACKEND SPRING BOOT (PORT 8080)
# ==============================================================================
$beDir = Join-Path $RootDir "BE\boxora"
$jarPath = Join-Path $beDir "target\boxora-backend-0.0.1-SNAPSHOT.jar"
$srcDir = Join-Path $beDir "src"

function Test-BackendSourceNewerThanJar {
    if (-not (Test-Path $jarPath)) { return $true }
    $jarTime = (Get-Item $jarPath).LastWriteTime
    $newerFile = Get-ChildItem -Path $srcDir -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -gt $jarTime } |
        Select-Object -First 1
    return ($null -ne $newerFile)
}

function Start-BoxoraBackendService {
    $useExistingJar = -not (Test-BackendSourceNewerThanJar)

    $modeArg = if ($useExistingJar) { "2" } else { "1" }
    if ($useExistingJar) {
        Write-Host "  - Tim thay JAR moi nhat, khoi dong Backend doc lap (IPv4 + Private Network CORS)..." -ForegroundColor Cyan
    } else {
        Write-Host "  - Source code co thay doi hoac chua co JAR, dang dong goi va khoi dong Backend..." -ForegroundColor Cyan
    }

    $cmdLine = "cmd.exe /k `"title BOXORA - BACKEND (PORT 8080) && call setup_and_run_backend.bat $modeArg`""
    [void](Start-DetachedProcess -CommandLine $cmdLine -WorkingDirectory $beDir -ShowWindow 7)
}

Write-Host ""
Write-Host "[2/5] Kiem tra Backend Spring Boot (Port 8080)..." -ForegroundColor Yellow

# Dung cac tien trinh watchdog start_demo_online.ps1 cu (neu co) de tranh xung dot khi khoi dong lai
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'start_demo_online\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$bePortOpen = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
$needsRebuild = Test-BackendSourceNewerThanJar
if ($bePortOpen -and -not $needsRebuild) {
    Write-Host "  - Phat hien Port 8080 dang mo, dang kiem tra phan hoi HTTP API..."
    $httpOk = $false
    for ($k = 1; $k -le 5; $k++) {
        if (Test-BackendHttpReady) {
            $httpOk = $true
            break
        }
        Start-Sleep -Seconds 2
    }
    if ($httpOk) {
        Write-Host "  - Backend dang chay va phan hoi HTTP 200 OK tren Port 8080!" -ForegroundColor Green
    } else {
        Write-Host "  - Tien trinh tren Port 8080 bi treo, dang lam moi lai Backend..." -ForegroundColor Yellow
        $bePortOpen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
        Start-BoxoraBackendService
    }
} else {
    if ($bePortOpen) {
        Write-Host "  - Phat hien cap nhat source code Backend moi, dang dong goi va khoi dong lai Backend..." -ForegroundColor Cyan
        Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -match 'setup_and_run_backend' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        $bePortOpen | ForEach-Object {
            Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 2
    }
    Start-BoxoraBackendService
}

if (-not (Test-BackendHttpReady)) {
    Write-Host "  - Dang cho Backend san sang phuc vu HTTP tren Port 8080 (toi da 90 giay)..."
    $beReady = $false
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 3
        if (Test-BackendHttpReady) {
            $beReady = $true
            break
        }
        Write-Host "    ... lan $i/30 - dang cho Backend khoi dong..." -ForegroundColor DarkGray
    }

    if ($beReady) {
        Write-Host "  - Backend da san sang 100% (HTTP 200 OK) tren Port 8080!" -ForegroundColor Green
    } else {
        Write-Host "  [CANH BAO] Backend chua phan hoi HTTP 200 sau 90s. Kiem tra cua so BOXORA BACKEND!" -ForegroundColor Red
    }
}

# ==============================================================================
# [3/5] MO CLOUDFLARE QUICK TUNNEL TUONG THICH MOI MANG WI-FI / HOTSPOT
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
    & curl.exe -4 -L -s -o $targetCf "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    if (Test-Path $targetCf) {
        $cfExe = $targetCf
    }
}

$tunnelLog = Join-Path $env:TEMP "boxora_cloudflared.log"

function Get-SmartDnsResolvers {
    $workingDns = @()
    foreach ($pubDns in @("1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4")) {
        try {
            $r = Resolve-DnsName "api.trycloudflare.com" -Server $pubDns -QuickTimeout -ErrorAction Stop
            if ($r) {
                $workingDns += "${pubDns}:53"
            }
        } catch {}
        if ($workingDns.Count -ge 2) { break }
    }

    # Lay them DNS IPv4 cua card mang Wi-Fi/Ethernet dang ket noi (ho tro mang truong hoc/cong ty chan port 53 ra ngoai)
    try {
        $upAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
        foreach ($adapter in $upAdapters) {
            $dnsAddrs = (Get-DnsClientServerAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses
            foreach ($addr in $dnsAddrs) {
                if ($addr -and $addr -notmatch "^127\." -and ($workingDns -notcontains "${addr}:53")) {
                    $workingDns += "${addr}:53"
                }
            }
        }
    } catch {}

    return ($workingDns -join ",")
}

function Start-CloudflareQuickTunnel {
    if (-not $cfExe -or -not (Test-Path $cfExe)) {
        return $null
    }

    Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    $dnsResolvers = Get-SmartDnsResolvers
    if ($dnsResolvers) {
        $env:TUNNEL_DNS_RESOLVER_ADDRS = $dnsResolvers
        Write-Host "  - Cau hinh DNS toi uu cho mang Wi-Fi hien tai: $dnsResolvers" -ForegroundColor DarkCyan
    } else {
        Remove-Item Env:\TUNNEL_DNS_RESOLVER_ADDRS -ErrorAction SilentlyContinue
    }

    foreach ($h in @("api.trycloudflare.com", "region1.v2.argotunnel.com", "region2.v2.argotunnel.com", "api.cloudflare.com")) {
        Resolve-DnsName $h -Server 1.1.1.1 -QuickTimeout -ErrorAction SilentlyContinue | Out-Null
        Resolve-DnsName $h -QuickTimeout -ErrorAction SilentlyContinue | Out-Null
    }

    $protocols = @("http2", "auto", "http2")
    $resolvedUrl = $null

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue
        $proto = $protocols[$attempt - 1]
        $cfCmdLine = "cmd.exe /c `"set TUNNEL_DNS_RESOLVER_ADDRS=$dnsResolvers&& `"$cfExe`" tunnel --url http://127.0.0.1:8080 --protocol $proto --edge-ip-version 4 --no-prechecks --logfile `"$tunnelLog`" --no-autoupdate`""
        [void](Start-DetachedProcess -CommandLine $cfCmdLine -WorkingDirectory $RootDir -ShowWindow 7)

        $candidateUrl = $null
        $registered = $false

        for ($w = 1; $w -le 20; $w++) {
            Start-Sleep -Seconds 2
            if (Test-Path $tunnelLog) {
                $logContent = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
                if (-not $candidateUrl -and ($logContent -match "https://[a-zA-Z0-9\-]+\.trycloudflare\.com")) {
                    $candidateUrl = $matches[0].Trim()
                }
                if ($candidateUrl -and ($logContent -match "Registered tunnel connection")) {
                    $registered = $true
                    break
                }
            }
            if (-not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
                break
            }
        }

        if ($candidateUrl -and $registered) {
            $domain = $candidateUrl -replace "^https://", ""
            # Cho DNS propagate tren Cloudflare va xoa negative cache cua Windows DNS Client
            for ($d = 1; $d -le 5; $d++) {
                & ipconfig.exe /flushdns >$null 2>&1
                Resolve-DnsName $domain -Server 1.1.1.1 -QuickTimeout -ErrorAction SilentlyContinue | Out-Null
                Resolve-DnsName $domain -QuickTimeout -ErrorAction SilentlyContinue | Out-Null
                $code = & curl.exe -4 -s -m 4 -o NUL -w "%{http_code}" "$candidateUrl/api/v1/facilities" 2>$null
                if ($code -eq "200") {
                    $resolvedUrl = $candidateUrl
                    break
                }
                Start-Sleep -Seconds 1
            }
            if (-not $resolvedUrl) {
                # Van chap nhan URL neu tunnel da Registered (trinh duyet hoac localhost failover se xu ly)
                & ipconfig.exe /flushdns >$null 2>&1
                $resolvedUrl = $candidateUrl
            }
            break
        }

        if ($attempt -lt 3) {
            Write-Host "    ... Mang Wi-Fi phan hoi cham, dang thu ket noi lai Cloudflare Tunnel (lan $($attempt + 1)/3)..." -ForegroundColor Yellow
            Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }

    return $resolvedUrl
}

$tunnelUrl = Start-CloudflareQuickTunnel

if (-not $tunnelUrl) {
    Write-Host "  [CANH BAO] Mang Wi-Fi hien tai chan Cloudflare Tunnel hoac mat ket noi Internet." -ForegroundColor Yellow
    Write-Host "  -> Tu dong chuyen sang che do Direct Localhost (http://localhost:8080) - van hoat dong 100% tren may nay!" -ForegroundColor Green
    $tunnelUrl = "http://localhost:8080"
} else {
    Write-Host "  - Da tao va xac thuc Tunnel thanh cong!" -ForegroundColor Green
    Write-Host "  - Backend HTTPS URL: $tunnelUrl" -ForegroundColor Cyan
}

# ==============================================================================
# [4/5] BUILD FRONTEND VOI URL TUNNEL & DEPLOY CLOUDFLARE PAGES
# ==============================================================================
Write-Host ""
Write-Host "[4/5] Dang cap nhat cau hinh Frontend, Build va Deploy len Cloudflare Pages..." -ForegroundColor Yellow

$feDir = Join-Path $RootDir "FE\boxora-web"
$feEnvFile = Join-Path $feDir ".env"
$feApiConfigFile = Join-Path $feDir "public\api-config.json"
$googleClientId = "564968487479-aooibm2esqg9bic2iuu1a729ci4qfo3q.apps.googleusercontent.com"
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$serverInstanceId = ""
try {
    $stateResp = Invoke-RestMethod -Uri "http://127.0.0.1:8080/api/v1/shared-state" -Method Get -TimeoutSec 5 -ErrorAction Stop
    if ($stateResp -and $stateResp.serverInstanceId) {
        $serverInstanceId = [string]$stateResp.serverInstanceId
        Write-Host "  - Host Database Instance ID: $serverInstanceId" -ForegroundColor DarkGray
    }
} catch {}

$onlineEnvContent = "VITE_API_BASE_URL=$tunnelUrl`r`nVITE_GOOGLE_CLIENT_ID=$googleClientId`r`n"
$localEnvContent  = "VITE_API_BASE_URL=http://localhost:8080`r`nVITE_GOOGLE_CLIENT_ID=$googleClientId`r`n"
$apiConfigJson    = "{`r`n  `"apiBaseUrl`": `"$tunnelUrl`",`r`n  `"fallbackLocalUrl`": `"http://localhost:8080`",`r`n  `"serverInstanceId`": `"$serverInstanceId`",`r`n  `"updatedAt`": `"$([DateTime]::UtcNow.ToString('o'))`"`r`n}`r`n"

$buildExitCode = 1
try {
    [System.IO.File]::WriteAllText($feEnvFile, $onlineEnvContent, $utf8NoBom)
    [System.IO.File]::WriteAllText($feApiConfigFile, $apiConfigJson, $utf8NoBom)
    Push-Location $feDir
    Write-Host "  - Dang chay npm run build..."
    & cmd.exe /c "npm run build"
    $buildExitCode = $LASTEXITCODE
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    # Khoi phuc .env ve localhost va xoa file tam de khong anh huong git hoac start_local.bat
    [System.IO.File]::WriteAllText($feEnvFile, $localEnvContent, $utf8NoBom)
    Remove-Item $feApiConfigFile -Force -ErrorAction SilentlyContinue
}

if ($buildExitCode -eq 0) {
    Push-Location $feDir
    try {
        Write-Host "  - Dang deploy len Cloudflare Pages (boxora-storage)..."
        & cmd.exe /c "npx --yes wrangler pages deploy dist --project-name boxora-storage --branch=main --commit-dirty=true"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [CANH BAO] Deploy Cloudflare Pages gap loi tren mang Wi-Fi nay." -ForegroundColor Yellow
            Write-Host "  Ban van dung duoc ngay link: https://boxora-storage.pages.dev?api=$tunnelUrl" -ForegroundColor Cyan
        }
    } finally {
        Pop-Location -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "  [CANH BAO] Build Frontend gap loi, su dung ban build hien co voi tham so ?api=$tunnelUrl" -ForegroundColor Yellow
}

# ==============================================================================
# [5/5] HOAN TAT, MO TRINH DUYET & AUTO-HEAL WATCHDOG KHI DOI WI-FI
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
Write-Host "  - Backend Local (Direct) : http://localhost:8080 (Tu dong uu tien tren may nay)" -ForegroundColor Green
Write-Host "  - Backend Tunnel (HTTPS) : $tunnelUrl" -ForegroundColor Cyan
Write-Host "  - Frontend Online        : https://boxora-storage.pages.dev"
Write-Host "  - Link Demo Day Du       : $finalUrl" -ForegroundColor Yellow
Write-Host "    (Da tu dong COPY link nay vao Clipboard - chi can Ctrl+V de gui!)" -ForegroundColor Green
Write-Host ""
Write-Host "  [TINH NANG CHONG LOI WI-FI]:" -ForegroundColor Cyan
Write-Host "  - Tren may tinh nay: Trinh duyet tu dong ket noi truc tiep Backend Local"
Write-Host "    (http://localhost:8080) nen DOI MANG WI-FI NAO CUNG HOAT DONG 100%!"
Write-Host "  - Tren thiet bi khac: Ket noi qua Cloudflare Tunnel ($tunnelUrl)."
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
    Write-Host "Dang mo trinh duyet..."
    Start-Process $finalUrl | Out-Null
}

if (-not $NoPause) {
    Write-Host ""
    Write-Host "[AUTO-HEAL WATCHDOG] Dang giam sat Backend & Tunnel 24/7 (Tu dong khoi dong lai neu bi tat hoac doi Wi-Fi)." -ForegroundColor Cyan
    Write-Host "Ban co the thu nho cua so nay. Nhan Ctrl + C neu muon dung giam sat." -ForegroundColor DarkGray
    while ($true) {
        Start-Sleep -Seconds 10
        if (-not (Ensure-PostgreSQLRunning)) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Dang tu dong bat lai PostgreSQL..." -ForegroundColor Yellow
        }
        if (-not (Test-BackendHttpReady)) {
            $portCheck = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
            $runnerActive = Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -match 'setup_and_run_backend' }
            if (-not $portCheck -and -not $runnerActive) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Phat hien Backend bi tat, dang tu dong khoi dong lai Backend..." -ForegroundColor Yellow
                Start-BoxoraBackendService
                Start-Sleep -Seconds 12
            }
        }
        if ($cfExe -and (Test-Path $cfExe) -and -not (Get-Process cloudflared -ErrorAction SilentlyContinue)) {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Phat hien Cloudflare Tunnel bi ngat do doi mang, dang ket noi lai..." -ForegroundColor Yellow
            $newUrl = Start-CloudflareQuickTunnel
            if ($newUrl) {
                $tunnelUrl = $newUrl
                $finalUrl = "https://boxora-storage.pages.dev?api=$tunnelUrl"
                try { Set-Clipboard -Value $finalUrl -ErrorAction SilentlyContinue } catch {}
                try {
                    $distApiConfig = Join-Path $feDir "dist\api-config.json"
                    if (Test-Path (Join-Path $feDir "dist")) {
                        $updatedConfig = "{`r`n  `"apiBaseUrl`": `"$tunnelUrl`",`r`n  `"fallbackLocalUrl`": `"http://localhost:8080`",`r`n  `"serverInstanceId`": `"$serverInstanceId`",`r`n  `"updatedAt`": `"$([DateTime]::UtcNow.ToString('o'))`"`r`n}`r`n"
                        [System.IO.File]::WriteAllText($distApiConfig, $updatedConfig, $utf8NoBom)
                        Push-Location $feDir
                        & cmd.exe /c "npx --yes wrangler pages deploy dist --project-name boxora-storage --branch=main --commit-dirty=true" 2>$null | Out-Null
                        Pop-Location -ErrorAction SilentlyContinue
                    }
                } catch {
                    Pop-Location -ErrorAction SilentlyContinue
                }
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Tunnel moi da san sang va dong bo len Cloudflare Pages: $finalUrl (Da copy vao Clipboard)" -ForegroundColor Green
            }
        }
    }
}

exit 0
