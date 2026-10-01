@echo off
rem ============================================================
rem  Image Resizer - double-click launcher (interactive mode)
rem  Works with: 1) Node.js installed on PATH  2) portable
rem  bundle (runtime\node.exe next to this file)
rem ============================================================
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"

if not defined NODE_EXE (
  echo Node.js not found.
  echo   - Install from https://nodejs.org  and run this again, or
  echo   - extract the portable bundle from GitHub Releases and use its resize.bat
  echo.
  pause
  exit /b 1
)

%NODE_EXE% "%~dp0src\cli.js" %*
echo.
pause
