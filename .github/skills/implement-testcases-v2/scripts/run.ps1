<#
.SYNOPSIS
  Short form of scripts/run-tests.ps1: run stories by type, then build and open the Allure report.
  Started by run.cmd in the project root, so ".\run" works even where PowerShell scripts are disabled.
  It lives in scripts/ because PowerShell would pick a run.ps1 in the root over run.cmd.

.DESCRIPTION
  .\run <stories> -Type <type> [-Ids <IDs>] [-Workbook <name>] [-Previous <output workbook>] [-Retries <0-5>] [-DryRun] [-NoReport]
        [-AiNotes] [-HandoffRepairs] [-NoUpdate]

  Stories are plain words (US001 US002 or US001,US002); none = every story.

.PARAMETER Type
  first = rows never run (Not Executed) | pass = rows now Pass (regression)
  fail  = rows now Fail or Skip         | full = every in-scope row (default)

.PARAMETER Ids
  Only these testcase IDs (TC_US002_006,TC_US002_007). Still filtered by -Type; use -Type full to force.

.PARAMETER Workbook
  Input workbook (or a unique part of its name); needed only when testcase/Testcases holds more than one.

.PARAMETER Previous
  Workbook update: the previous version's output workbook, whose unchanged rows' results are carried over.

.PARAMETER Retries
  Reruns of a failed test for this run only (TEST_RETRIES, default 2 = 3 attempts). -Retries 0 is fastest when the
  failures are already known: each failing row then costs one attempt instead of three.

.PARAMETER DryRun
  Show which rows would run; run nothing.

.PARAMETER NoReport
  Do not build or open the Allure report.

.PARAMETER AiNotes
  Add a one-line AI note to Fail rows.

.PARAMETER HandoffRepairs
  Add "NEEDS REVIEW" element/timeout failures to the handoff "Repairs needed" table.

.PARAMETER NoUpdate
  Run the tests but leave the workbook alone.

.EXAMPLE
  .\run US001 -Type full
  .\run US001 US002 -Type fail
  .\run -Type pass
  .\run US002 -Type full -Ids TC_US002_006
  .\run US001 US002 -Type first -DryRun
  .\run US001 US002 -Type full -Retries 0
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [Parameter(Position = 0, ValueFromRemainingArguments)][string[]]$Story,
    [ValidateSet('first', 'pass', 'fail', 'full')][string]$Type = 'full',
    [string[]]$Ids,
    [string]$Workbook,
    [string]$Previous,
    [ValidateRange(0, 5)][int]$Retries = -1,
    [switch]$DryRun,
    [switch]$NoReport,
    [switch]$AiNotes,
    [switch]$HandoffRepairs,
    [switch]$NoUpdate
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

# "US001,US002" arrives as "US001,US002" from cmd and as "US001 US002" from PowerShell: split on both.
$stories = @($Story | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })
foreach ($s in $stories) {
    if ($s -notmatch '^US\d+$') { Write-Host "'$s' is not a story ID (US001). Options need a dash: -Type full, -Ids ..., -DryRun. See: Get-Help .\scripts\run.ps1 -Full" -ForegroundColor Red; exit 2 }
}
$ids = @($Ids | ForEach-Object { $_ -split '[,\s]+' } | Where-Object { $_ })

$runArgs = @('-Type', $Type)
if ($stories) { $runArgs += @('-Story', (($stories | ForEach-Object { $_.ToUpper() }) -join ',')) }
if ($ids) { $runArgs += @('-Ids', ($ids -join ',')) }
if ($Workbook) { $runArgs += @('-Workbook', $Workbook) }
if ($Previous) { $runArgs += @('-Previous', $Previous) }
if ($DryRun) { $runArgs += '-DryRun' }
if ($AiNotes) { $runArgs += '-AiNotes' }
if ($HandoffRepairs) { $runArgs += '-HandoffRepairs' }
if ($NoUpdate) { $runArgs += '-NoUpdate' }

# The process environment wins over .env (config/env.ts), and run-tests.ps1 and wdio inherit it.
if ($PSBoundParameters.ContainsKey('Retries')) { $env:TEST_RETRIES = "$Retries" }

# Run metadata for the shareable report (scripts/report): every test of this run is labelled with it in Allure.
# Smoke runs go through npm run smoke:run, which sets EXECUTION_TYPE=smoke itself; this script only runs regression specs.
$startedAt = Get-Date
$env:EXECUTION_TYPE = 'regression'
$env:RUN_ID = 'regression-' + $startedAt.ToString('yyyyMMdd-HHmmss')

if (-not $DryRun) { Remove-Item -Recurse -Force allure-results, allure-report -ErrorAction SilentlyContinue }
& powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1 @runArgs
$runExit = $LASTEXITCODE

# Keep this run's raw results: allure-results/ is cleared by the next run, and npm run report:share builds
# latest-outcome snapshots from test-results/allure-archive/<RunId>/ (never edited after this point).
if (-not $DryRun -and (Test-Path allure-results) -and (Get-ChildItem allure-results -File -ErrorAction SilentlyContinue)) {
    $archive = Join-Path 'test-results/allure-archive' $env:RUN_ID
    New-Item -ItemType Directory -Force $archive | Out-Null
    Copy-Item -Recurse -Force allure-results (Join-Path $archive 'allure-results')
    $runInfo = [ordered]@{
        runId         = $env:RUN_ID
        executionType = 'regression'
        source        = 'scripts/run.ps1'
        runType       = $Type
        stories       = @($stories | ForEach-Object { $_.ToUpper() })
        ids           = @($ids)
        workbook      = $Workbook
        platform      = 'android'
        environment   = $env:TEST_ENV
        startedAt     = $startedAt.ToString('o')
        finishedAt    = (Get-Date).ToString('o')
        timeZone      = [TimeZoneInfo]::Local.Id
        exitCode      = $runExit
    }
    $runInfo | ConvertTo-Json | Set-Content -Encoding utf8 (Join-Path $archive 'run.json')
    Write-Host "Raw results archived in $archive"
}

# A failed test still leaves Allure results worth reading, so the report is built whatever the run's exit code.
if (-not $NoReport -and -not $DryRun -and (Test-Path allure-results)) {
    & npm.cmd run --silent report
    if ($LASTEXITCODE -eq 0) { & npm.cmd run --silent report:open }
}
exit $runExit
