@echo off
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" scripts\reinicio.js > reinicio_log.txt 2>&1
