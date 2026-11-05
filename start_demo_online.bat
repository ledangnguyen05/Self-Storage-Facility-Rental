@echo off
chcp 65001 >nul
title BOXORA - DEMO ONLINE LAUNCHER (CLOUDFLARE)
color 0B
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_demo_online.ps1"
pause
