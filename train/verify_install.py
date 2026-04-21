"""验证AI训练环境安装"""
import sys
print(f"Python: {sys.version}")

import torch
print(f"PyTorch: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA device: {torch.cuda.get_device_name(0)}")
    print(f"CUDA version: {torch.version.cuda}")

import onnx
print(f"ONNX: {onnx.__version__}")

import onnxruntime
print(f"ONNXRuntime: {onnxruntime.__version__}")

import numpy
print(f"NumPy: {numpy.__version__}")

print("\n✅ 所有依赖安装成功!")