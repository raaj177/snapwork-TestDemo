<#
.SYNOPSIS
  Captures the UI hierarchy and a screenshot of the CURRENT screen (Android, adb) into
  evidence\android\<Screen>\<State>.xml|.png and replaces .env test-account values with {{NAME}} in the dump.
  Read-only on the device: no taps, no install, no unlock.
.EXAMPLE
  .\scripts\capture-evidence.ps1 -Screen Login -State initial
#>
param([string]$Screen, [string]$State = 'initial', [switch]$DryRun, [switch]$Help)
if ($Help -or -not $Screen) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
$safe = ($Screen -replace '[^A-Za-z0-9_-]', '_'); $stateSafe = ($State -replace '[^A-Za-z0-9_-]', '_')
$dir = Join-Path $root "evidence\android\$safe"
$udid = $env:DEVICE_UDID
$sel = if ($udid) { @('-s', $udid) } else { @() }
if ($DryRun) { Write-Host "Would write $dir\$stateSafe.xml and $stateSafe.png"; exit 0 }
New-Item -ItemType Directory -Force $dir | Out-Null
& adb @sel shell uiautomator dump /sdcard/window_dump.xml | Out-Null
& adb @sel pull /sdcard/window_dump.xml (Join-Path $dir "$stateSafe.xml") | Out-Null
& adb @sel shell rm /sdcard/window_dump.xml | Out-Null
# screencap to the device, then pull: a PowerShell 5.1 '>' redirect re-encodes binary output and corrupts the PNG.
& adb @sel shell screencap -p /sdcard/evidence_screen.png | Out-Null
& adb @sel pull /sdcard/evidence_screen.png (Join-Path $dir "$stateSafe.png") | Out-Null
& adb @sel shell rm /sdcard/evidence_screen.png | Out-Null
$xmlFile = Join-Path $dir "$stateSafe.xml"
if ((Test-Path $xmlFile) -and (Test-Path (Join-Path $root '.env'))) {
    # The dump is UTF-8 without a BOM; Windows PowerShell 5.1 would read it as ANSI and double-encode non-ASCII text.
    $xml = Get-Content $xmlFile -Raw -Encoding UTF8
    foreach ($line in Get-Content (Join-Path $root '.env')) {
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*(USER|PASS|PIN|OTP|CUSTOMER|MOBILE|ACCOUNT)[A-Z0-9_]*)\s*=\s*(.+)$' -and $Matches[3].Length -ge 3) {
            $xml = $xml.Replace($Matches[3], "{{$($Matches[1])}}")
        }
    }
    Set-Content -Path $xmlFile -Value $xml -Encoding utf8
}
Write-Host "Evidence written to evidence\android\$safe\ ($stateSafe.xml, $stateSafe.png). Add the locators to locators.md."
