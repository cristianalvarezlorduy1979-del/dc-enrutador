@echo off
title Desplegar a Firebase Hosting & Cloud Firestore
cd /d "%~dp0"

echo ========================================================
echo        SUBIENDO ACTUALIZACIONES A FIREBASE
echo ========================================================
echo.

firebase deploy --only hosting,firestore:rules --project enrutador-pro-col

echo.
echo ========================================================
echo   Sitio web publicado en: https://enrutador-pro-col.web.app
echo ========================================================
echo.
pause
