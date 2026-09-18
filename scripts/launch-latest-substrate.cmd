@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-latest-substrate.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo SUBSTRATE launcher exited with code %EXITCODE%.
  pause
)
exit /b %EXITCODE%
