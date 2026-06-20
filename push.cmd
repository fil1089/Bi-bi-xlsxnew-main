@echo off
REM Обёртка для запуска push.sh через Git Bash из PowerShell/cmd или двойным кликом.
REM Использование:  push.cmd "сообщение коммита"   либо просто  push.cmd

setlocal
set BASH="%ProgramFiles%\Git\bin\bash.exe"
if not exist %BASH% set BASH="%ProgramFiles(x86)%\Git\bin\bash.exe"

%BASH% "%~dp0push.sh" %*
endlocal
