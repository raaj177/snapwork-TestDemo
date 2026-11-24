<#
.SYNOPSIS
  Stops only the Appium process started by start-appium.ps1 (PID in logs\appium.pid). Never stops other processes.
.EXAMPLE
  .\scripts\stop-appium.ps1
#>
param([switch]$DryRun, [switch]$Help)
if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'logs\appium.pid'
if (-not (Test-Path $pidFile)) { Write-Host 'No Appium started by start-appium.ps1 (logs\appium.pid missing).'; exit 0 }
$appiumPid = [int](Get-Content $pidFile)
$proc = Get-Process -Id $appiumPid -ErrorAction SilentlyContinue
if (-not $proc) { Write-Host "Process $appiumPid is not running."; Remove-Item $pidFile; exit 0 }
if ($DryRun) { Write-Host "Would stop PID $appiumPid ($($proc.ProcessName))"; exit 0 }
Stop-Process -Id $appiumPid
Remove-Item $pidFile
Write-Host "Stopped Appium (PID $appiumPid)."
