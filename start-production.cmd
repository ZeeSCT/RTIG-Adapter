@echo off
cd /d "%~dp0"

if not exist logs mkdir logs

echo ======================================== >> logs\production.log
echo Starting Next.js at %date% %time% >> logs\production.log

"C:\Program Files\nodejs\npm.cmd" run start -- -H 127.0.0.1 -p 3000 >> logs\production.log 2>&1