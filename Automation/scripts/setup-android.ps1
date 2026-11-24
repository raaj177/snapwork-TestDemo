<#
.SYNOPSIS
  Reads the app package, launch activity and label from an APK with `aapt dump badging` (Android SDK build-tools)
  and prints them. With -Write, writes APP_PACKAGE / APP_ACTIVITY / APP_PATH into .env (never .env.example).
  Installs nothing; never touches a device.
.EXAMPLE
  .\scripts\setup-android.ps1 -Apk apps\android\app-release.apk
  .\scripts\setup-android.ps1 -Apk apps\android\app-release.apk -Write
#>
param([string]$Apk, [switch]$Write, [switch]$DryRun, [switch]$Help)
if ($Help -or -not $Apk) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path $Apk)) { Write-Error "APK not found: $Apk"; exit 2 }
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
$aapt = Get-ChildItem -Path (Join-Path $sdk 'build-tools') -Filter 'aapt.exe' -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $aapt) { Write-Error 'aapt not found in <ANDROID_HOME>\build-tools: install Android SDK build-tools'; exit 3 }
$badging = & $aapt.FullName dump badging $Apk
$package = ([regex]::Match(($badging -join "`n"), "package: name='([^']+)'")).Groups[1].Value
$activity = ([regex]::Match(($badging -join "`n"), "launchable-activity: name='([^']+)'")).Groups[1].Value
$label = ([regex]::Match(($badging -join "`n"), "application-label:'([^']*)'")).Groups[1].Value
Write-Host "APP_PACKAGE  = $package   (aapt dump badging: package: name)"
Write-Host "APP_ACTIVITY = $activity   (aapt dump badging: launchable-activity: name)"
Write-Host "Display name = $label   (aapt dump badging: application-label)"
if ($DryRun -or -not $Write) { exit 0 }
$envFile = Join-Path $root '.env'
$lines = if (Test-Path $envFile) { Get-Content $envFile } else { Get-Content (Join-Path $root '.env.example') }
$set = @{ APP_PACKAGE = $package; APP_ACTIVITY = $activity; APP_PATH = (Resolve-Path $Apk).Path }
$out = foreach ($l in $lines) {
    if ($l -match '^([A-Z_]+)=' -and $set.ContainsKey($Matches[1])) { "$($Matches[1])=$($set[$Matches[1]])" } else { $l }
}
Set-Content -Path $envFile -Value $out -Encoding utf8
Write-Host 'Written to .env (Git-ignored).'
