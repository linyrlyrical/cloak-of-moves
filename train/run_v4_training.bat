@echo off
title Cloak of Moves v4 Training (Conservative PPO)
echo ============================================================
echo   Cloak of Moves AI Training v4
echo   Conservative PPO + Rollback + BC Baseline
echo   Started: %date% %time%
echo ============================================================
echo.

cd /d "d:\MyWorks\MyWorksInTHU\AICoding\Cloak of moves_test"

python train/train_ppo.py --bc_episodes 3000 --ppo_iterations 150

echo.
echo ============================================================
echo   Training completed or stopped: %date% %time%
echo ============================================================
echo.
pause