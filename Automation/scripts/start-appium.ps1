<#
.SYNOPSIS
  Starts the project-local Appium in the background (no visible window), logging to logs\appium.log, and records its
  PID in logs\appium.pid so stop-appium.ps1 stops only this process. Normally not needed: @wdio/appium-service
  starts Appium for local runs.
.EXAMPLE
  .\scripts\start-appium.ps1
  .\scripts\start-appium.ps1 -Port 4724 -DryRun
#>
param([int]$Port = 4723, [switch]$DryRun, [switch]$Help)
if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'logs'
$appium = Join-Path $root 'node_modules\appium\index.js'
if (-not (Test-Path $appium)) { Write-Error 'Appium is not installed: run npm install'; exit 2 }
$appiumArgs = @($appium, '--address', '127.0.0.1', '--port', "$Port", '--log', (Join-Path $logs 'appium.log'), '--relaxed-security')
if ($DryRun) { Write-Host "Would start: node $($appiumArgs -join ' ')"; exit 0 }
New-Item -ItemType Directory -Force $logs | Out-Null
$proc = Start-Process -FilePath 'node' -ArgumentList $appiumArgs -WindowStyle Hidden -PassThru -WorkingDirectory $root
Set-Content -Path (Join-Path $logs 'appium.pid') -Value $proc.Id
Write-Host "Appium started (PID $($proc.Id)) on 127.0.0.1:$Port; log: logs\appium.log"
