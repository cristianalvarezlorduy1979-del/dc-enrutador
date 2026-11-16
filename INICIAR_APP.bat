@echo off
title Enrutador Pro - Servidor de Logistica y Conductores
cd /d "%~dp0"

echo ========================================================
echo        INICIANDO SISTEMA DE ENRUTADOR Y LOGISTICA
echo ========================================================
echo.
echo Iniciando servidor en puerto 3000...
echo.

start http://localhost:3000

node backend/server.js

pause
