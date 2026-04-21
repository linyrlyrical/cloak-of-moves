@echo off
set PYTHONUNBUFFERED=1
chcp 65001 >nul 2>&1
title Cloak of Moves AI Training (GPU)
echo ============================================================
echo   Cloak of Moves AI Training v2
echo   GPU: RTX 5060 (CUDA 12.8)
echo ============================================================
echo.

C:\Users\13262\miniconda3\python.exe -u "%~dp0train_ppo.py" --bc_episodes 200 --ppo_iterations 50 --device cuda %*

echo.
echo ============================================================
echo   Training completed or stopped!
echo ============================================================
pause