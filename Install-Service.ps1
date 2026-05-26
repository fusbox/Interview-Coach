# Install Interview Coach AI as a Windows service using NSSM.
# Run this script as Administrator from the project root.
#
# Prerequisites:
#   1. Node.js LTS (64-bit) installed
#   2. nssm.exe copied into this project root
#   3. npm ci && npm run build completed successfully
#   4. .env configured for production (PORT defaults to 3002)

$startupDir = $PSScriptRoot
$nssmPath = Join-Path $startupDir "nssm.exe"
$serviceName = "AI_TA_InterviewCoach"
$displayName = "AI TA Interview Coach"
$nodePath = "C:\Program Files\nodejs\node.exe"
$scriptPath = "scripts\start-production.mjs"
$startupType = "Automatic"
$port = "3001"

function Test-ServiceExists {
    param ([string]$Name)

    try {
        Get-Service -Name $Name -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-Path $nssmPath)) {
    Write-Error "nssm.exe not found at '$nssmPath'. Copy nssm.exe into the project root and rerun."
    exit 1
}

if (-not (Test-Path $nodePath)) {
    Write-Error "Node.js not found at '$nodePath'. Install Node.js LTS or update `$nodePath in this script."
    exit 1
}

if (-not (Test-Path (Join-Path $startupDir ".next"))) {
    Write-Error "Production build not found. Run 'npm run build' in '$startupDir' before installing the service."
    exit 1
}

$logsDir = Join-Path $startupDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if (Test-ServiceExists -Name $serviceName) {
    Write-Output "Service '$serviceName' exists. Stopping and removing..."

    $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($service -and ($service.Status -eq 'Running' -or $service.Status -eq 'Paused')) {
        Stop-Service -Name $serviceName -Force
        Start-Sleep -Seconds 5
        Write-Output "Service '$serviceName' stopped."
    }

    & $nssmPath remove $serviceName confirm
    Start-Sleep -Seconds 3
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 3

    Write-Output "Service '$serviceName' removed successfully."
} else {
    Write-Output "Service '$serviceName' does not exist. Proceeding with installation."
}

Write-Output "Installing service..."
& $nssmPath install $serviceName $nodePath $scriptPath
Start-Sleep -Seconds 2

& $nssmPath set $serviceName DisplayName $displayName
& $nssmPath set $serviceName Description "Rangam Interview Coach AI - Next.js production service"
& $nssmPath set $serviceName AppDirectory $startupDir
& $nssmPath set $serviceName AppParameters $scriptPath
& $nssmPath set $serviceName AppStdout (Join-Path $logsDir "service.log")
& $nssmPath set $serviceName AppStderr (Join-Path $logsDir "service-error.log")
& $nssmPath set $serviceName AppRotateFiles 1
& $nssmPath set $serviceName AppEnvironmentExtra "NODE_ENV=production`nPORT=$port`nHOSTNAME=0.0.0.0"

Set-Service -Name $serviceName -StartupType $startupType -ErrorAction SilentlyContinue

Write-Output "Service '$serviceName' installed."
Write-Output "Startup directory: $startupDir"
Write-Output "Listening on port: $port"

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne 'Running') {
    Start-Service -Name $serviceName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
    Write-Output "Service '$serviceName' started."
} else {
    Write-Output "Service '$serviceName' is already running."
}

$service = Get-Service -Name $serviceName
Write-Output "Service '$serviceName' is currently $($service.Status)."
Write-Output "Verify at http://localhost:$port"
