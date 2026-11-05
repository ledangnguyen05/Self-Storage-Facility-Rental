@echo off
chcp 65001 >nul
title BOXORA - KHOI DONG LOCAL (BACKEND + FRONTEND)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_local.ps1"
pause
