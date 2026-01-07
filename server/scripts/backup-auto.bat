@echo off
REM Script para ejecutar backup diario automaticamente
REM Este archivo se ejecutara desde Windows Task Scheduler

cd /d "%~dp0.."
echo ================================================
echo BACKUP AUTOMATICO DIARIO - %DATE% %TIME%
echo ================================================
echo.

node scripts\backup-database.js

echo.
echo ================================================
echo Backup completado
echo ================================================
