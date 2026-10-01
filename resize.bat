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

rem sharp processes images on Node's libuv threadpool (default 4 threads) —
rem raise it to the core count so batch mode can use the whole CPU
if not defined UV_THREADPOOL_SIZE set "UV_THREADPOOL_SIZE=%NUMBER_OF_PROCESSORS%"

%NODE_EXE% "%~dp0src\entry.mjs" %*
echo.
pause
