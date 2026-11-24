<#
.SYNOPSIS
  Removes generated run output only (allure-results, allure-report, logs, screenshots, test-results\junit,
  test-results\automation-results). Never removes source, .env, workbooks, handoff files or evidence.
.EXAMPLE
  .\scripts\cleanup.ps1 -DryRun
#>
param([switch]$DryRun, [switch]$Help)
if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if ($DryRun) { node scripts/clean.mjs --dry-run } else { node scripts/clean.mjs }
exit $LASTEXITCODE
