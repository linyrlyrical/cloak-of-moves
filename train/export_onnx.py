"""
Cloak of Moves - ONNX模型导出脚本 v3

将训练好的PyTorch模型导出为ONNX格式，供Node.js推理使用
v3: 支持4输入格式 (map, card, opp_card, scalar)

用法:
  python export_onnx.py                           # 使用默认路径
  python export_onnx.py checkpoints/model_best.pt  # 指定模型路径
  python export_onnx.py --output model.onnx        # 指定输出路径
"""

import sys
import io
if sys.platform == 'win32':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    except Exception:
        pass

import argparse
import os
import torch
import numpy as np
from model import CloakNet


def export_onnx(model_path, output_path=None, opset_version=18):
    """导出模型为ONNX格式 (v3: 4输入)"""
    if output_path is None:
        output_path = model_path.replace('.pt', '.onnx')
        if output_path == model_path:
            output_path = 'cloak_net.onnx'

    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    device = torch.device('cpu')
    model = CloakNet().to(device)

    if os.path.exists(model_path):
        checkpoint = torch.load(model_path, map_location=device, weights_only=False)
        if 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
        else:
            model.load_state_dict(checkpoint)
        print(f"Model loaded: {model_path}")
    else:
        print(f"Model not found: {model_path}")
        print(f"Using random initialization for export test...")

    model.eval()

    # 创建示例输入 (4个输入)
    batch_size = 1
    map_input = torch.randn(batch_size, 12, 11, 11, dtype=torch.float32)   # v3: 12 channels
    card_input = torch.randn(batch_size, 8, 8, dtype=torch.float32)
    opp_card_input = torch.randn(batch_size, 3, 8, dtype=torch.float32)
    scalar_input = torch.randn(batch_size, 55, dtype=torch.float32)        # v3: 55 dims

    # 验证前向传播
    with torch.no_grad():
        card_logits, order_logits, value = model(map_input, card_input, opp_card_input, scalar_input)
    print(f"Output verification:")
    print(f"  card_logits:  {card_logits.shape} -> {card_logits.detach().numpy().flatten()[:4]}...")
    print(f"  order_logits: {order_logits.shape} -> {order_logits.detach().numpy().flatten()}")
    print(f"  value:        {value.shape} -> {value.detach().numpy().flatten()}")

    # 导出ONNX
    print(f"\nExporting ONNX model (opset={opset_version})...")
    torch.onnx.export(
        model,
        (map_input, card_input, opp_card_input, scalar_input),
        output_path,
        opset_version=opset_version,
        input_names=['map_input', 'card_input', 'opp_card_input', 'scalar_input'],
        output_names=['card_logits', 'order_logits', 'value'],
        dynamic_axes={
            'map_input': {0: 'batch_size'},
            'card_input': {0: 'batch_size'},
            'opp_card_input': {0: 'batch_size'},
            'scalar_input': {0: 'batch_size'},
            'card_logits': {0: 'batch_size'},
            'order_logits': {0: 'batch_size'},
            'value': {0: 'batch_size'},
        },
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"ONNX model exported: {output_path}")

    # 验证ONNX模型
    try:
        import onnx
        onnx_model = onnx.load(output_path)
        onnx.checker.check_model(onnx_model)
        print(f"ONNX model validation passed")
    except ImportError:
        print(f"onnx library not installed, skipping validation")
    except Exception as e:
        print(f"ONNX model validation failed: {e}")

    # 用onnxruntime验证推理结果
    try:
        import onnxruntime as ort
        sess = ort.InferenceSession(output_path)
        ort_inputs = {
            'map_input': map_input.numpy(),
            'card_input': card_input.numpy(),
            'opp_card_input': opp_card_input.numpy(),
            'scalar_input': scalar_input.numpy(),
        }
        ort_outputs = sess.run(None, ort_inputs)

        print(f"\nONNX Runtime inference verification:")
        print(f"  card_logits:  shape={ort_outputs[0].shape}")
        print(f"  order_logits: shape={ort_outputs[1].shape}")
        print(f"  value:        shape={ort_outputs[2].shape}")

        card_diff = np.abs(card_logits.detach().numpy() - ort_outputs[0]).max()
        order_diff = np.abs(order_logits.detach().numpy() - ort_outputs[1]).max()
        value_diff = np.abs(value.detach().numpy() - ort_outputs[2]).max()
        print(f"\n  PyTorch vs ONNX diff:")
        print(f"    card_logits:  max_diff={card_diff:.6f}")
        print(f"    order_logits: max_diff={order_diff:.6f}")
        print(f"    value:        max_diff={value_diff:.6f}")

        if card_diff < 1e-4 and order_diff < 1e-4 and value_diff < 1e-4:
            print(f"  Results consistent!")
        else:
            print(f"  Results have some difference (may be acceptable)")

    except ImportError:
        print(f"onnxruntime not installed, skipping inference verification")
    except Exception as e:
        print(f"ONNX Runtime verification failed: {e}")

    file_size = os.path.getsize(output_path)
    print(f"\nModel file size: {file_size / 1024:.1f} KB")
    print(f"Output path: {os.path.abspath(output_path)}")

    return output_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Export ONNX model v3')
    parser.add_argument('model_path', type=str, nargs='?', default='checkpoints/model_best.pt',
                       help='PyTorch model path')
    parser.add_argument('--output', type=str, default=None, help='ONNX output path')
    parser.add_argument('--opset', type=int, default=18, help='ONNX opset version')
    args = parser.parse_args()

    export_onnx(args.model_path, args.output, args.opset)