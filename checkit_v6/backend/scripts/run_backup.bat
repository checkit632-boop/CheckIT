@echo off
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" scripts\backup.js > backup_log.txt 2>&1
