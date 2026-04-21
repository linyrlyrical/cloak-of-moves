@echo off
echo ============================================
echo   Cloak of Moves AI Training v2
echo ============================================
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.8+
    pause
    exit /b 1
)

REM Check dependencies
echo [1/3] Checking dependencies...
pip show torch >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements.txt
)

REM Run training
echo.
echo [2/3] Starting training (BC pretrain + PPO)...
echo.
python train_ppo.py --bc_episodes 500 --ppo_iterations 100 %*

echo.
echo [3/3] Training complete!
echo.
echo Next steps:
echo   1. Export ONNX: python export_onnx.py checkpoints\model_best.pt
echo   2. Copy model.onnx to server directory
echo   3. Test: node server/test_neural_ai.mjs
echo.
pause