<#
.SYNOPSIS
  Generates allure-report\ from allure-results\ (works when tests failed) and adds logger\ and Screenshots\.
.EXAMPLE
  .\scripts\generate-allure-report.ps1
#>
param([switch]$DryRun, [switch]$Help)
if ($Help) { Get-Help $MyInvocation.MyCommand.Path -Detailed; exit 0 }
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if ($DryRun) { Write-Host 'Would run: npm run report'; exit 0 }
if (-not (Test-Path 'allure-results')) { Write-Host 'No allure-results\ yet: run tests first.'; exit 0 }
npm run report
exit $LASTEXITCODE
