@echo off
title Cloak of Moves v3 Training
echo ============================================================
echo   Cloak of Moves AI Training v3
echo   Started: %date% %time%
echo ============================================================
echo.

cd /d "d:\MyWorks\MyWorksInTHU\AICoding\Cloak of moves_test"

python train/train_ppo.py --bc_episodes 500 --ppo_iterations 60

echo.
echo ============================================================
echo   Training completed or stopped: %date% %time%
echo ============================================================
echo.
pause