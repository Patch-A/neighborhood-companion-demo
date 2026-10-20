@echo off
setlocal
cd /d "%~dp0"
if not exist ".env.local" copy ".env.example" ".env.local" >nul
echo Edit FAMILY_AI_API_KEY locally. Never share this file or commit it.
echo Save the file, close this editor, then restart start.cmd.
notepad ".env.local"
