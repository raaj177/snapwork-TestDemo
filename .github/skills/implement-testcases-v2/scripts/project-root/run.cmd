@echo off
rem Short run command that needs no execution-policy change: run US001 US002 -Type full
rem The script is in scripts\ so that PowerShell resolves ".\run" to this file, not to a blocked run.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run.ps1" %*
exit /b %ERRORLEVEL%
