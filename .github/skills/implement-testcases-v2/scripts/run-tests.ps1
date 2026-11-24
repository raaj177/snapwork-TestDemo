<#
.SYNOPSIS
  One command for an Android test run: choose rows, build the suite, run on the device, write the workbook.

.DESCRIPTION
  Replaces the execute-testcases flow with scripts (no AI needed unless -AiNotes is used):
    1. preflight   Python + openpyxl, Node.js + npm, node_modules installed, project type-checks and lints
                   (npm run typecheck, npm run lint); for a real run also: adb device online, DEVICE_UDID in .env
                   (or the environment) is that device, Appium reachable
    1b. prepare    the canonical output workbook of the chosen input workbook exists and matches it: created from
                   the input workbook on the first run (with -Previous: results of unchanged rows carried over from
                   the previous version's output workbook); stops if the input workbook changed under the same name
    2. select      rows for the run type, from the canonical output workbook (scripts/testrun)
    3. suite       generated JSON suites (suites/<Workbook>/android/<folder>/<Story>.json) for exactly those rows
    4. run         stale UiAutomator2 port freed -> Appium start (when needed) -> wdio run config/wdio.android.conf.ts
                   --spec <story spec> --mochaOpts.grep "(?:^|\s)(?:<ID1>|<ID2>):" -> Appium stop (only if this script started it);
                   a [ROW DONE] line with the row's time is printed as each testcase ends,
                   and a [ROW RETRY] line for each failed attempt that is rerun
    5. update      results CSV -> workbook by testcase ID (refuses if any selected row has no result)
    6. refresh     suites/<Workbook>/android/passed/ (rows now Pass) and .../failed/ (rows now Fail or Skip)
                   rebuilt from the saved workbook for every story; a folder with no such row is emptied

.PARAMETER Type
  first = rows never run (Not Executed) | pass = regression (rows currently Pass)
  fail  = rows currently Fail or Skip    | full = every in-scope row that has an it()

.PARAMETER Story
  One or more story IDs, separated by commas: -Story US003 or -Story US001,US003. Default: every story.
  (With powershell -File, values separated by spaces are not passed as a list; use commas.)

.PARAMETER Ids
  Only these testcase IDs, separated by commas (TC_US001_006,TC_US001_009). Still filtered by -Type: use -Type
  full to run an ID whatever its status.

.PARAMETER Workbook
  Input workbook name (or a unique part of it). Required when testcase/Testcases holds more than one input
  workbook (for example V1 and V2): the script never picks one by itself.

.PARAMETER Previous
  Workbook update only: the previous version's output workbook (file name in Output Testcases, for example
  "Android-LoginAuthenticationV1.xlsx"). When the new version's output workbook does not exist yet, it is created from
  the new input workbook and the results of unchanged rows are carried over from this file, so -Type first runs only
  new and changed rows. Give the new version's own output file name to rebuild it after its input workbook was
  replaced under the same name. Ignored when the output workbook already exists and matches its input.

.PARAMETER AiNotes
  Add a one-line AI note (claude CLI) to Fail rows. Off by default.

.PARAMETER HandoffRepairs
  Add "NEEDS REVIEW" element/timeout failures to the handoff "Repairs needed" table.

.PARAMETER SkipCompile
  Skip npm run typecheck and npm run lint.

.PARAMETER NoAppium
  Do not start Appium. It must already answer at APPIUM_HOST:APPIUM_PORT, or be started by the wdio config itself
  (@wdio/appium-service).

.PARAMETER DryRun
  Preflight, select and build the suite, print the wdio command, run nothing.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type fail -Story US003
  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type pass -DryRun
  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type fail -Story US001 -Ids TC_US001_006
  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type first -Story US001,US002,US003 -Workbook "LoginV1.xlsx"
  powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 -Type first -Workbook "LoginV2" -Previous "Android-LoginV1.xlsx"
#>
# PositionalBinding off: a stray value (for example a second story after a space) is an error, never
# silently taken as -Ids or -Workbook.
[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Mandatory)][ValidateSet('first', 'pass', 'fail', 'full')][string]$Type,
    [string[]]$Story,
    [string[]]$Ids,
    [string]$Workbook,
    [string]$Previous,
    [switch]$AiNotes,
    [switch]$HandoffRepairs,
    [switch]$SkipCompile,
    [switch]$NoUpdate,
    [switch]$NoAppium,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$py = Join-Path $PSScriptRoot 'testrun/testrun.py'
$wdioConfig = 'config/wdio.android.conf.ts'
# powershell -File passes "-Story US001,US003" as one string: split every value on commas and spaces.
$Story = @($Story | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })
$Ids = @($Ids | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })
$common = @()
if ($Workbook) { $common += @('--workbook', $Workbook) }
if ($Story) { $common += @('--story') + $Story }
if ($Ids) { $common += @('--ids') + $Ids }

function Fail([string]$msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 2 }
function Step([string]$msg) { Write-Host "`n== $msg" -ForegroundColor Cyan }

# Configuration as config/env.ts resolves it: process environment first, then the local .env file, then the default.
$dotenv = @{}
$envFile = Join-Path $root '.env'
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and $line -notmatch '^\s*#') {
            $dotenv[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
        }
    }
}
function Config([string]$name, [string]$default = '') {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { return $value }
    if ($dotenv.ContainsKey($name) -and $dotenv[$name]) { return $dotenv[$name] }
    return $default
}
function AppiumAnswers([string]$url) {
    try { $null = Invoke-RestMethod -Uri $url -TimeoutSec 5; return $true } catch { return $false }
}

# 1. preflight ---------------------------------------------------------------
Step 'Preflight'
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Fail "python not found on PATH (needs Python 3 with openpyxl)." }
& python -c "import openpyxl" 2>$null
if ($LASTEXITCODE -ne 0) { Fail "openpyxl is missing. Run: pip install openpyxl" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "node not found on PATH (Node.js is needed for WebdriverIO)." }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Fail "npm not found on PATH." }
Write-Host "Node.js $(& node --version)"
$wdioPkg = Join-Path $root 'node_modules/@wdio/cli/package.json'
if (-not (Test-Path $wdioPkg)) { Fail "node_modules/@wdio/cli is missing: the project's packages are not installed (npm ci)." }
# Run the wdio CLI with node itself: npx/npm are .cmd files, and cmd.exe would read the '|' of the grep as a pipe.
$wdioBin = (Get-Content $wdioPkg -Raw | ConvertFrom-Json).bin
if ($wdioBin -isnot [string]) { $wdioBin = $wdioBin.wdio }
$wdioJs = Join-Path (Split-Path -Parent $wdioPkg) $wdioBin
if (-not (Test-Path $wdioJs)) { Fail "WebdriverIO CLI not found at $wdioJs." }
if (-not $DryRun) {
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { Fail "adb not found on PATH." }
    $online = @((& adb devices) | Where-Object { $_ -match "\tdevice$" } | ForEach-Object { ($_ -split "`t")[0] })
    if (-not $online) { Fail "No Android device in 'device' state (offline/unauthorized?). Run: adb devices" }
    $udid = Config 'DEVICE_UDID'
    if (-not $udid) { Fail "DEVICE_UDID is empty. Set it in the local .env to the ID shown by adb devices: $($online -join ', ')" }
    if ($online -notcontains $udid) { Fail "DEVICE_UDID '$udid' (.env) is not online. Online: $($online -join ', '). Fix the local .env." }
    Write-Host "Device online: $udid"
}
if (-not $SkipCompile) {
    & npm run --silent typecheck
    if ($LASTEXITCODE -ne 0) { Fail "Project does not type-check (npm run typecheck). Fix it with implement-testcases first." }
    & npm run --silent lint
    if ($LASTEXITCODE -ne 0) { Fail "Project does not lint (npm run lint). Fix it with implement-testcases first." }
    Write-Host "Type-checked and linted."
}

# 1b. output workbook ---------------------------------------------------------------
Step 'Prepare the output workbook'
$wbOnly = @()
if ($Workbook) { $wbOnly = @('--workbook', $Workbook) }
$prevArgs = @()
if ($Previous) { $prevArgs = @('--previous', $Previous) }
$prep = @('prepare') + $wbOnly + $prevArgs
if ($DryRun) { $prep += '--dry-run' }
& python $py @prep
if ($LASTEXITCODE -ne 0) { Fail "The output workbook is not ready (see the ERROR above). Nothing was run." }

# 2-3. select + suite -------------------------------------------------------------
Step "Select rows ($Type) and build the suite"
# A dry run wrote no output workbook, so selection works on what prepare would write.
$selPrev = if ($DryRun) { $prevArgs } else { @() }
& python $py suites --type $Type @common @selPrev
if ($LASTEXITCODE -eq 3) { Write-Host "Nothing selected; stopping."; exit 0 }
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$specs = @()
$runIds = @()
foreach ($file in Get-Content (Join-Path $root 'test-results/testrun/suite-files.txt') | Where-Object { $_.Trim() }) {
    $suite = Get-Content (Join-Path $root $file.Trim()) -Raw | ConvertFrom-Json
    if ($specs -notcontains $suite.spec) { $specs += $suite.spec }
    $runIds += @($suite.ids)
}
# Mocha matches --mochaOpts.grep against the FULL title: the describe() names, a space, then the it() title
# ("Customer ID and Password TC_US002_025: Switch tab"). So the ID must follow the start or whitespace, never
# only the start (^ alone matches nothing inside a describe). The ':' stops TC_US002_025 matching TC_US002_0250.
# IDs are validated before they go into the regex; the pattern is passed to node as one argument (no shell).
$badIds = @($runIds | Where-Object { $_ -notmatch '^TC_[A-Za-z0-9_]+$' })
if ($badIds) { Fail "Invalid testcase ID(s) in the suite, not put into the grep: $($badIds -join ', ')" }
$grep = '(?:^|\s)(?:' + (($runIds | Select-Object -Unique) -join '|') + '):'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tag = if ($Story) { ($Story -join '-').ToLower() } else { 'all' }
$csv = "test-results/automation-results/$Type-$tag-$stamp-results.csv"
$wdioArgs = @('run', $wdioConfig) + ($specs | ForEach-Object { @('--spec', $_) }) + @('--mochaOpts.grep', $grep)
$shown = "npx wdio run $wdioConfig " + (($specs | ForEach-Object { "--spec $_" }) -join ' ') + " --mochaOpts.grep `"$grep`""
if ($DryRun) {
    Write-Host "`nDry run. Command that would run (with PLATFORM=android and AUTOMATION_RESULTS_FILE=$csv):`n  $shown"
    exit 0
}

# 4. run --------------------------------------------------------------------------
Step 'Run on the device'
# A forward left on the UiAutomator2 port by a killed run makes the first session fail with "port is busy".
$systemPort = [int](Config 'UIAUTOMATOR2_SYSTEM_PORT' '8200')
& cmd /c "adb forward --remove tcp:$systemPort >nul 2>&1"

$appiumHost = Config 'APPIUM_HOST' '127.0.0.1'
$appiumPort = Config 'APPIUM_PORT' '4723'
$appiumUrl = "http://$($appiumHost):$appiumPort/status"
$local = $appiumHost -in @('127.0.0.1', 'localhost', '0.0.0.0', '::1')
# For a local Appium the wdio config may start it itself (@wdio/appium-service); then this script must not.
$configText = (@('config/wdio.shared.conf.ts', $wdioConfig) | Where-Object { Test-Path $_ } | ForEach-Object { Get-Content $_ -Raw }) -join "`n"
$serviceStartsAppium = $local -and ($configText -match "services\s*:[^\]]*['""]appium['""]")
$total = @(Get-Content (Join-Path $root 'test-results/testrun/selected-ids.txt') | Where-Object { $_.Trim() }).Count
$rowStart = @{}
$done = 0
$startedAppium = $false
$env:PLATFORM = 'android'
$env:AUTOMATION_RESULTS_FILE = $csv
# The run's terminal output, also kept in logs/console.log (npm run report copies it into allure-report/logger/).
$null = New-Item -ItemType Directory -Force (Join-Path $root 'logs')
$consoleLog = New-Object System.IO.StreamWriter((Join-Path $root 'logs/console.log'), $false, [System.Text.UTF8Encoding]::new($false))
$consoleLog.AutoFlush = $true
function Say([string]$line, [string]$colour = '') {
    if ($colour) { Write-Host $line -ForegroundColor $colour } else { Write-Host $line }
    $consoleLog.WriteLine($line)
}
try {
    if ($serviceStartsAppium) {
        if (AppiumAnswers $appiumUrl) { Fail "Appium already answers at $appiumUrl, but the wdio config starts its own (@wdio/appium-service) on that port. Stop it first (scripts/stop-appium.ps1)." }
        Write-Host "Appium is started by the wdio config (@wdio/appium-service)."
    }
    elseif (AppiumAnswers $appiumUrl) { Write-Host "Appium answers at $appiumUrl." }
    elseif ($NoAppium -or -not $local) { Fail "Appium is not reachable at $appiumUrl." }
    else {
        & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-appium.ps1')
        $startedAppium = $true
        $deadline = (Get-Date).AddSeconds(60)
        while (-not (AppiumAnswers $appiumUrl)) {
            if ((Get-Date) -gt $deadline) { Fail "Appium did not answer at $appiumUrl within 60 s after start-appium.ps1." }
            Start-Sleep -Seconds 2
        }
        Write-Host "Appium answers at $appiumUrl."
    }
    # Pass wdio output through, and print one [ROW DONE] line with the row's time as each testcase ends.
    & node $wdioJs @wdioArgs | ForEach-Object {
        $text = "$_"
        Say $text
        if ($text -match '\[TEST START\] (\S+)') {
            # A retried test starts again; keep the first start so the row time covers every attempt.
            if (-not $rowStart.ContainsKey($Matches[1])) { $rowStart[$Matches[1]] = Get-Date }
        }
        elseif ($text -match '\[TEST RETRY\] (\S+) .*\| attempt (\S+) failed \((.*)\); rerunning') {
            Say ("[ROW RETRY] {0} attempt {1} failed ({2}) at {3}" -f $Matches[1], $Matches[2], $Matches[3], (Get-Date -Format 'HH:mm:ss')) 'Yellow'
        }
        elseif ($text -match '\[TEST END\] (\S+) .*\| (PASS|FAIL|SKIP|BLOCKED)\s*$') {
            $done++
            $id = $Matches[1]
            $result = $Matches[2]
            $secs = if ($rowStart.ContainsKey($id)) { [math]::Round(((Get-Date) - $rowStart[$id]).TotalSeconds) } else { '?' }
            $colour = switch ($result) { 'PASS' { 'Green' } 'FAIL' { 'Red' } default { 'Yellow' } }
            Say ("[ROW DONE] {0}/{1} {2} {3} in {4} s at {5}" -f $done, $total, $id, $result, $secs, (Get-Date -Format 'HH:mm:ss')) $colour
        }
    }
    $wdioExit = $LASTEXITCODE
}
finally {
    $consoleLog.Dispose()
    if ($startedAppium) { & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop-appium.ps1') }
}
if (-not (Test-Path $csv)) { Fail "wdio produced no results file ($csv); wdio exit code $wdioExit. Nothing written to the workbook." }

# 5. workbook -----------------------------------------------------------------------
if ($NoUpdate) { Write-Host "`n-NoUpdate: results are in $csv; workbook not touched."; exit 0 }
Step 'Write results to the workbook'
$upd = @('update', '--csv', $csv, '--expect-file', 'test-results/testrun/selected-ids.txt') + $common
if ($Type -in 'first', 'full') { $upd += '--sync-blocked' }
if ($AiNotes) { $upd += '--ai-notes' }
if ($HandoffRepairs) { $upd += '--handoff-repairs' }
& python $py @upd
if ($LASTEXITCODE -ne 0) { Write-Host "Workbook NOT updated. Results kept in $csv" -ForegroundColor Yellow; exit $LASTEXITCODE }

# 6. refresh status suites ---------------------------------------------------------------
# Every story, whatever -Story/-Ids this run had: passed/ = rows now Pass, failed/ = rows now Fail or Skip.
$refreshFailed = @()
foreach ($t in 'pass', 'fail') {
    Step "Refresh $(if ($t -eq 'pass') { 'passed' } else { 'failed' })/ suites from the saved workbook"
    & python $py suites --type $t --refresh @wbOnly
    if ($LASTEXITCODE -ne 0) { $refreshFailed += $t }
}
if ($refreshFailed) {
    Write-Host "Workbook written, but the $($refreshFailed -join ' and ') suites were not refreshed (see the ERROR above)." -ForegroundColor Yellow
    exit 2
}
exit 0
