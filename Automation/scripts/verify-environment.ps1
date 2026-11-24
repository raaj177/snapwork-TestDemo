<#
.SYNOPSIS
  Checks Node.js, npm, Java, Android SDK/ADB, the project-local Appium and its drivers, Allure, and whether the
  configured Appium endpoint is reachable. Read-only: installs nothing.
.EXAMPLE
  .\scripts\verify-environment.ps1
  .\scripts\verify-environment.ps1 -DryRun
#>
param([switch]$DryRun, [switch]$Help)
$ErrorActionPreference = 'Continue'
if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Write-Check([string]$Name, [bool]$Ok, [string]$Detail, [string]$Hint) {
    $mark = if ($Ok) { 'OK  ' } else { 'FAIL' }
    Write-Host ("[{0}] {1}: {2}" -f $mark, $Name, $Detail)
    if (-not $Ok -and $Hint) { Write-Host "       hint: $Hint" }
}

function Get-DotEnv {
    $values = @{}
    if (Test-Path '.env') {
        foreach ($line in Get-Content '.env') {
            if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2] }
        }
    }
    return $values
}

Write-Host 'Resolved configuration (secrets hidden):'
$dot = Get-DotEnv
foreach ($k in 'PLATFORM', 'TEST_ENV', 'APPIUM_HOST', 'APPIUM_PORT', 'APP_PACKAGE', 'APP_ACTIVITY', 'BUNDLE_ID') {
    $v = [Environment]::GetEnvironmentVariable($k); $src = 'process env'
    if (-not $v) { $v = $dot[$k]; $src = '.env' }
    if (-not $v) { $v = '<empty>'; $src = 'default' }
    Write-Host ("  {0} = {1} ({2})" -f $k, $v, $src)
}
$udid = [Environment]::GetEnvironmentVariable('DEVICE_UDID'); if (-not $udid) { $udid = $dot['DEVICE_UDID'] }
Write-Host ("  DEVICE_UDID = {0}" -f $(if ($udid) { '****' + $udid.Substring([Math]::Max(0, $udid.Length - 4)) } else { '<empty>' }))
if ($DryRun) { Write-Host 'Dry run: no checks executed.'; exit 0 }

$node = (node --version) 2>$null; Write-Check 'Node.js' ([bool]$node) "$node" 'Install Node.js 24 LTS'
$npm = (npm --version) 2>$null; Write-Check 'npm' ([bool]$npm) "$npm" ''
$java = (java -version 2>&1 | Select-Object -First 1); Write-Check 'Java' ([bool]($java -match 'version')) "$java" 'Install JDK 17 and set JAVA_HOME'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
Write-Check 'ANDROID_HOME' ([bool]$sdk) "$sdk" 'Set ANDROID_HOME to the Android SDK folder'
$adb = (adb version 2>$null | Select-Object -First 1); Write-Check 'adb' ([bool]$adb) "$adb" 'Add <SDK>\platform-tools to PATH'
$appium = (npx --no-install appium --version 2>$null | Select-Object -Last 1); Write-Check 'Appium (project)' ([bool]$appium) "$appium" 'run npm install'
$drivers = (npx --no-install appium driver list --installed 2>&1) -join "`n"
Write-Check 'uiautomator2 driver' ($drivers -match 'uiautomator2') 'project dependency' 'run npm install'
Write-Check 'xcuitest driver' ($drivers -match 'xcuitest') 'project dependency (iOS runs need macOS)' 'run npm install'
$allure = (npx --no-install allure --version 2>$null | Select-Object -Last 1); Write-Check 'Allure (project)' ([bool]$allure) "$allure" 'run npm install (needs Java)'
$apHost = if ($dot['APPIUM_HOST']) { $dot['APPIUM_HOST'] } else { '127.0.0.1' }
$apPort = if ($dot['APPIUM_PORT']) { [int]$dot['APPIUM_PORT'] } else { 4723 }
$reachable = $false
try { $c = New-Object Net.Sockets.TcpClient; $c.Connect($apHost, $apPort); $reachable = $c.Connected; $c.Close() } catch { $reachable = $false }
Write-Host ("[INFO] Appium endpoint {0}:{1} reachable: {2} (not required: @wdio/appium-service starts a local Appium)" -f $apHost, $apPort, $reachable)
