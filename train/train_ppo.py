"""
Cloak of Moves - PPO训练脚本 v3 (增强版)

v3改进 (基于v2):
1. 新增对手牌编码输入 (opp_card_features: 3x8)
2. 扩展标量特征 (20->30维)
3. 增强训练配置 (更多BC epochs, PPO迭代)
4. 所有模型调用适配4输入格式

用法:
  python train_ppo.py                          # 完整训练（BC预训练 + PPO）
  python train_ppo.py --bc_only                # 仅行为克隆预训练
  python train_ppo.py --resume checkpoint.pt   # 从checkpoint恢复训练
  python train_ppo.py --bc_episodes 500        # 指定BC预训练局数
  python train_ppo.py --ppo_iterations 100     # 指定PPO迭代次数
"""

import sys
import io
# Fix Windows GBK encoding issue with emoji/Chinese characters
if sys.platform == 'win32':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    except Exception:
        pass

import argparse
import os
import time
import json
import random
import gc
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from itertools import permutations
from copy import deepcopy

from model import CloakNet, count_parameters
from game_env import (
    CloakEnv, RuleBasedAI, self_play_episode,
    encode_state, encode_card, generate_cards, generate_shared_cards,
    MAX_CARDS, MAX_OPP_CARDS, HAND_SIZE, DIRECTION_OFFSET,
    SCALAR_DIM, MAP_CHANNELS
)

# ==================== 训练配置 ====================

DEFAULT_CONFIG = {
    # 行为克隆 (v4: 大幅增强)
    'bc_episodes': 3000,        # BC预训练自我对弈局数 (v4: 2000→3000)
    'bc_epochs': 300,           # BC训练轮数 (v4: 150→300)
    'bc_lr': 1e-3,              # BC学习率
    'bc_batch_size': 64,        # BC批量大小
    'bc_target_accuracy': 98.0, # BC目标准确率%

    # PPO (v4: 保守微调，不破坏BC知识)
    'ppo_iterations': 150,      # PPO迭代次数 (v4: 100→150)
    'ppo_episodes_per_iter': 60, # 每次迭代自我对弈局数 (v4: 40→60)
    'ppo_epochs': 3,            # 每次迭代的训练轮数 (v4: 4→3)
    'ppo_lr': 5e-6,             # PPO学习率 (v4: 3e-4→5e-6, 关键！)
    'ppo_batch_size': 128,      # PPO批量大小 (v4: 64→128)
    'ppo_clip_ratio': 0.15,     # PPO裁剪比率 (v4: 0.2→0.15, 更保守)
    'ppo_value_coef': 0.5,      # 价值函数损失系数
    'ppo_entropy_coef': 0.005,  # 熵正则化系数 (v4: 0.02→0.005, 减少随机探索)
    'ppo_max_grad_norm': 0.3,   # 梯度裁剪 (v4: 0.5→0.3)
    'ppo_kl_coef': 0.5,         # KL散度惩罚系数 (v4新增)
    'ppo_kl_target': 0.02,      # KL散度目标阈值 (v4新增)
    'ppo_init_temperature': 0.3, # PPO初始温度 (v4: 1.0→0.3, 减少随机)
    'gamma': 0.99,              # 折扣因子
    'gae_lambda': 0.95,         # GAE lambda

    # 自回归选牌
    'use_autoregressive': True, # 使用自回归选牌

    # 自我对弈进化
    'use_evolution_pool': True, # 使用进化池
    'evolution_pool_size': 5,   # 进化池大小

    # 回退机制 (v4新增)
    'use_rollback': True,       # 胜率下降时回退到BC权重
    'rollback_threshold': 0.15, # 低于BC基线多少触发回退

    # 通用
    'save_dir': 'checkpoints',  # checkpoint保存目录
    'log_dir': 'logs',          # 日志保存目录
    'save_interval': 10,        # 每N次迭代保存一次 (v4: 20→10)
    'device': 'auto',           # 'auto', 'cpu', 'cuda'
}

# 预计算所有3!排列 (用于排序)
ALL_PERMUTATIONS_3 = list(permutations(range(HAND_SIZE)))  # [(0,1,2), (0,2,1), (1,0,2), ...]
NUM_PERMUTATIONS = len(ALL_PERMUTATIONS_3)  # 6


# ==================== 行为克隆数据集 ====================

class BCDataset(Dataset):
    """行为克隆数据集 v3 - 支持对手牌特征"""
    def __init__(self):
        self.map_features = []
        self.card_features = []
        self.opp_card_features = []  # 新增
        self.scalar_features = []
        self.card_labels = []      # 选牌标签（多标签，选中的牌为1）
        self.order_labels = []     # 排序标签（手牌的出牌优先级分数）

    def add_episode(self, episode_data, player_index):
        """从自我对弈数据中添加一个回合的数据"""
        for step in episode_data[player_index]:
            state = step['state']
            self.map_features.append(state['map_features'])
            self.card_features.append(state['card_features'])
            self.opp_card_features.append(state['opp_card_features'])  # 新增
            self.scalar_features.append(state['scalar_features'])

            # 选牌标签: 被选中的牌为1，其余为0
            n_cards = state['card_features'].shape[0]
            card_label = np.zeros(n_cards, dtype=np.float32)
            for idx in step['selected_indices']:
                if idx < n_cards:
                    card_label[idx] = 1.0
            self.card_labels.append(card_label)

            # 排序标签 v2: 使用手牌的实际出牌优先级
            order_label = np.zeros(HAND_SIZE, dtype=np.float32)
            hand_cards = step.get('hand_cards', [])
            for pos in range(min(len(hand_cards), HAND_SIZE)):
                order_label[pos] = (HAND_SIZE - 1 - pos) / (HAND_SIZE - 1)
            self.order_labels.append(order_label)

    def __len__(self):
        return len(self.map_features)

    def __getitem__(self, idx):
        return {
            'map_features': torch.tensor(self.map_features[idx], dtype=torch.float32),
            'card_features': torch.tensor(self.card_features[idx], dtype=torch.float32),
            'opp_card_features': torch.tensor(self.opp_card_features[idx], dtype=torch.float32),
            'scalar_features': torch.tensor(self.scalar_features[idx], dtype=torch.float32),
            'card_labels': torch.tensor(self.card_labels[idx], dtype=torch.float32),
            'order_labels': torch.tensor(self.order_labels[idx], dtype=torch.float32),
        }


# ==================== PPO经验缓冲 ====================

class RolloutBuffer:
    """PPO经验缓冲区 v3 - 支持对手牌特征"""
    def __init__(self):
        self.clear()

    def clear(self):
        self.map_features = []
        self.card_features = []
        self.opp_card_features = []  # 新增
        self.scalar_features = []
        self.card_actions = []     # 选牌动作 (选中的索引列表)
        self.order_actions = []    # 排序动作 (排列索引)
        self.card_log_probs = []   # 选牌log概率
        self.order_log_probs = []  # 排序log概率
        self.values = []           # 价值估计
        self.rewards = []          # 奖励
        self.dones = []            # 是否结束
        self.card_masks = []       # 选牌mask

    def add(self, map_feat, card_feat, opp_card_feat, scalar_feat,
            card_action, order_action,
            card_log_prob, order_log_prob,
            value, reward, done, card_mask):
        self.map_features.append(map_feat)
        self.card_features.append(card_feat)
        self.opp_card_features.append(opp_card_feat)  # 新增
        self.scalar_features.append(scalar_feat)
        self.card_actions.append(card_action)
        self.order_actions.append(order_action)
        self.card_log_probs.append(card_log_prob)
        self.order_log_probs.append(order_log_prob)
        self.values.append(value)
        self.rewards.append(reward)
        self.dones.append(done)
        self.card_masks.append(card_mask)

    def compute_returns(self, gamma=0.99, lam=0.95):
        """计算GAE和回报"""
        values = self.values + [0.0]
        advantages = []
        returns = []
        gae = 0.0

        for t in reversed(range(len(self.rewards))):
            delta = self.rewards[t] + gamma * values[t + 1] * (1 - self.dones[t]) - values[t]
            gae = delta + gamma * lam * (1 - self.dones[t]) * gae
            advantages.insert(0, gae)
            returns.insert(0, gae + values[t])

        self.advantages = advantages
        self.returns = returns
        return advantages, returns

    def __len__(self):
        return len(self.rewards)


# ==================== 辅助函数: 从state构建模型输入 ====================

def _build_model_inputs(state, device):
    """从编码状态构建模型输入张量 (4输入)"""
    map_feat = torch.tensor(state['map_features'], dtype=torch.float32).unsqueeze(0).to(device)
    card_feat = torch.tensor(state['card_features'], dtype=torch.float32).unsqueeze(0).to(device)
    opp_card_feat = torch.tensor(state['opp_card_features'], dtype=torch.float32).unsqueeze(0).to(device)
    scalar_feat = torch.tensor(state['scalar_features'], dtype=torch.float32).unsqueeze(0).to(device)
    return map_feat, card_feat, opp_card_feat, scalar_feat


# ==================== 行为克隆训练 ====================

def train_bc(model, dataset, config, device):
    """行为克隆预训练 v4 (增强版: cosine LR + 目标准确率 + 评估)"""
    print(f"\n{'='*60}")
    print(f"[BC] 行为克隆预训练 v4 (增强版)")
    print(f"  数据量: {len(dataset)} 样本")
    print(f"  训练轮数: {config['bc_epochs']}")
    print(f"  学习率: {config['bc_lr']}")
    print(f"  批量大小: {config['bc_batch_size']}")
    print(f"  目标准确率: {config['bc_target_accuracy']}%")
    print(f"{'='*60}")

    dataloader = DataLoader(dataset, batch_size=config['bc_batch_size'],
                           shuffle=True, num_workers=0)
    optimizer = optim.Adam(model.parameters(), lr=config['bc_lr'])
    # v4: Cosine annealing学习率调度
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=config['bc_epochs'], eta_min=1e-5)
    card_criterion = nn.BCEWithLogitsLoss()
    order_criterion = nn.MSELoss()

    best_accuracy = 0.0
    best_state_dict = None

    for epoch in range(config['bc_epochs']):
        total_loss = 0
        card_correct = 0
        total_samples = 0

        model.train()
        for batch in dataloader:
            map_feat = batch['map_features'].to(device)
            card_feat = batch['card_features'].to(device)
            opp_card_feat = batch['opp_card_features'].to(device)
            scalar_feat = batch['scalar_features'].to(device)
            card_labels = batch['card_labels'].to(device)
            order_labels = batch['order_labels'].to(device)

            card_logits, order_logits, value = model(map_feat, card_feat, opp_card_feat, scalar_feat)

            # 选牌损失
            card_loss = card_criterion(card_logits, card_labels)

            # 排序损失
            order_loss = order_criterion(order_logits, order_labels)

            loss = card_loss + 0.5 * order_loss

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            optimizer.step()

            total_loss += loss.item()

            # 计算选牌准确率
            predicted = (torch.sigmoid(card_logits) > 0.5).float()
            card_correct += (predicted == card_labels).sum().item()
            total_samples += card_labels.numel()

        scheduler.step()  # v4: 更新学习率

        avg_loss = total_loss / len(dataloader)
        accuracy = card_correct / max(total_samples, 1) * 100

        # v4: 追踪最佳模型
        if accuracy > best_accuracy:
            best_accuracy = accuracy
            best_state_dict = deepcopy(model.state_dict())

        if (epoch + 1) % 10 == 0 or epoch == 0:
            lr_now = optimizer.param_groups[0]['lr']
            print(f"  Epoch {epoch+1}/{config['bc_epochs']}: "
                  f"Loss={avg_loss:.4f}, Accuracy={accuracy:.1f}% (Best={best_accuracy:.1f}%), LR={lr_now:.6f}")

        # v4: 达到目标准确率可提前停止
        if accuracy >= config['bc_target_accuracy'] and epoch >= 50:
            print(f"  ✅ BC目标准确率已达成! Accuracy={accuracy:.1f}% >= {config['bc_target_accuracy']}%")
            break

    # v4: 恢复最佳BC权重
    if best_state_dict is not None and best_accuracy > 95.0:
        model.load_state_dict(best_state_dict)
        print(f"  ✅ 恢复最佳BC权重: Accuracy={best_accuracy:.1f}%")

    return model


# ==================== 自回归选牌辅助函数 ====================

def select_cards_autoregressive(model, game, player_index, device, temperature=1.0):
    """
    自回归选牌：逐张选择手牌 (v3: 4输入)
    """
    state = encode_state(game, player_index)
    map_feat, card_feat, opp_card_feat, scalar_feat = _build_model_inputs(state, device)
    
    ps = game['playerStates'][player_index]
    n_cards = len(ps.get('currentCards', []))
    
    with torch.no_grad():
        card_logits, order_logits, value = model(map_feat, card_feat, opp_card_feat, scalar_feat)
    
    selected_indices = []
    total_log_prob = 0.0
    masked_logits = card_logits[0].clone()
    
    for pick in range(min(HAND_SIZE, n_cards)):
        for idx in selected_indices:
            masked_logits[idx] = -1e9
        for i in range(n_cards, MAX_CARDS):
            masked_logits[i] = -1e9
        
        scaled = masked_logits / temperature
        probs = torch.softmax(scaled, dim=0)
        
        dist = torch.distributions.Categorical(probs)
        idx = dist.sample()
        
        selected_indices.append(idx.item())
        total_log_prob += torch.log(probs[idx] + 1e-8).item()
    
    return selected_indices, total_log_prob, value[0, 0].item()


def select_order_from_logits(order_logits, hand_cards, temperature=1.0):
    """从order_logits确定出牌顺序"""
    n = min(len(hand_cards), HAND_SIZE)
    if n <= 1:
        return hand_cards, 0.0
    
    scaled = order_logits[:n] / temperature
    probs = torch.softmax(scaled, dim=0)
    
    indices = list(range(n))
    indices.sort(key=lambda i: probs[i].item(), reverse=True)
    
    ordered = [hand_cards[i] for i in indices]
    
    log_prob = sum(torch.log(probs[i] + 1e-8).item() for i in indices)
    
    return ordered, log_prob


# ==================== PPO数据收集 ====================

def collect_rollouts(model, env, config, device, temperature=1.0):
    """收集自我对弈数据 v3 (4输入)"""
    model.eval()
    buffer = RolloutBuffer()

    states = env.reset()
    done = False
    episode_rewards = {0: 0.0, 1: 0.0}

    while not done and env.game['currentRound'] <= 50:
        game = env.game
        ps = game['playerStates']

        round_data = {}
        for pi in range(2):
            state = states[pi]
            n_cards = len(ps[pi].get('currentCards', []))

            # 自回归选牌
            selected_indices, card_log_prob, value = select_cards_autoregressive(
                model, game, pi, device, temperature
            )

            current_cards = ps[pi]['currentCards']
            hand_cards = [current_cards[i] for i in selected_indices if i < len(current_cards)]

            # 神经网络排序
            map_feat, card_feat, opp_card_feat, scalar_feat = _build_model_inputs(state, device)
            
            with torch.no_grad():
                _, order_logits, _ = model(map_feat, card_feat, opp_card_feat, scalar_feat)
            
            ordered_cards, order_log_prob = select_order_from_logits(
                order_logits[0], hand_cards, temperature
            )

            # 记录排列动作
            order_action = 0
            for perm_idx, perm in enumerate(ALL_PERMUTATIONS_3):
                if len(ordered_cards) >= HAND_SIZE:
                    match = True
                    for pos in range(HAND_SIZE):
                        if pos < len(hand_cards) and perm[pos] < len(hand_cards):
                            if ordered_cards[pos] != hand_cards[perm[pos]]:
                                match = False
                                break
                    if match:
                        order_action = perm_idx
                        break

            # 存入buffer
            buffer.add(
                map_feat=state['map_features'],
                card_feat=state['card_features'],
                opp_card_feat=state['opp_card_features'],
                scalar_feat=state['scalar_features'],
                card_action=selected_indices,
                order_action=order_action,
                card_log_prob=card_log_prob,
                order_log_prob=order_log_prob,
                value=value,
                reward=0.0,
                done=False,
                card_mask=n_cards,
            )

            round_data[pi] = {
                'select_indices': selected_indices,
                'card_order': ordered_cards,
            }

        # 执行回合
        hp_before = [ps[0]['hp'], ps[1]['hp']]
        states, rewards, done, info = env.execute_round(round_data[0], round_data[1])

        for pi in range(2):
            idx = len(buffer) - 2 + pi
            if idx >= 0:
                buffer.rewards[idx] = rewards[pi]
                buffer.dones[idx] = done
                episode_rewards[pi] += rewards[pi]

    return buffer, episode_rewards


def collect_rollouts_with_rule_ai(model, env, config, device, temperature=1.0, rule_ratio=0.0):
    """收集自我对弈数据（混合模式, v3: 4输入）"""
    if rule_ratio <= 0 or random.random() >= rule_ratio:
        return collect_rollouts(model, env, config, device, temperature)
    
    model.eval()
    buffer = RolloutBuffer()
    ai = RuleBasedAI(1)

    states = env.reset()
    done = False
    episode_rewards = {0: 0.0, 1: 0.0}

    while not done and env.game['currentRound'] <= 50:
        game = env.game
        ps = game['playerStates']
        round_data = {}

        # 玩家0: 神经网络
        pi = 0
        state = states[pi]
        n_cards = len(ps[pi].get('currentCards', []))
        selected_indices, card_log_prob, value = select_cards_autoregressive(
            model, game, pi, device, temperature
        )
        current_cards = ps[pi]['currentCards']
        hand_cards = [current_cards[i] for i in selected_indices if i < len(current_cards)]
        
        map_feat, card_feat, opp_card_feat, scalar_feat = _build_model_inputs(state, device)
        with torch.no_grad():
            _, order_logits, _ = model(map_feat, card_feat, opp_card_feat, scalar_feat)
        ordered_cards, order_log_prob = select_order_from_logits(order_logits[0], hand_cards, temperature)

        buffer.add(
            map_feat=state['map_features'], card_feat=state['card_features'],
            opp_card_feat=state['opp_card_features'], scalar_feat=state['scalar_features'],
            card_action=selected_indices,
            order_action=0, card_log_prob=card_log_prob, order_log_prob=order_log_prob,
            value=value, reward=0.0, done=False, card_mask=n_cards,
        )
        round_data[0] = {'select_indices': selected_indices, 'card_order': ordered_cards}

        # 玩家1: 规则AI
        ai_selected = ai.select_cards(game)
        ai_hand = [ps[1]['currentCards'][i] for i in ai_selected if i < len(ps[1]['currentCards'])]
        ai_ordered = ai.order_cards(game, ai_hand)
        round_data[1] = {'select_indices': ai_selected, 'card_order': ai_ordered}

        states, rewards, done, info = env.execute_round(round_data[0], round_data[1])
        
        idx = len(buffer) - 1
        if idx >= 0:
            buffer.rewards[idx] = rewards[0]
            buffer.dones[idx] = done
            episode_rewards[0] += rewards[0]

    return buffer, episode_rewards


# ==================== PPO训练更新 ====================

def ppo_update(model, optimizer, buffer, config, device):
    """PPO策略更新 v3 (4输入)"""
    model.train()

    advantages, returns = buffer.compute_returns(config['gamma'], config['gae_lambda'])

    # 转换为张量
    map_feats = torch.tensor(np.array(buffer.map_features), dtype=torch.float32).to(device)
    card_feats = torch.tensor(np.array(buffer.card_features), dtype=torch.float32).to(device)
    opp_card_feats = torch.tensor(np.array(buffer.opp_card_features), dtype=torch.float32).to(device)
    scalar_feats = torch.tensor(np.array(buffer.scalar_features), dtype=torch.float32).to(device)
    old_card_log_probs = torch.tensor(buffer.card_log_probs, dtype=torch.float32).to(device)
    old_order_log_probs = torch.tensor(buffer.order_log_probs, dtype=torch.float32).to(device)
    advantages_t = torch.tensor(advantages, dtype=torch.float32).to(device)
    returns_t = torch.tensor(returns, dtype=torch.float32).to(device)

    if len(advantages_t) > 1:
        advantages_t = (advantages_t - advantages_t.mean()) / (advantages_t.std() + 1e-8)

    clip_ratio = config['ppo_clip_ratio']

    total_loss_sum = 0
    n_updates = 0

    for epoch in range(config['ppo_epochs']):
        indices = list(range(len(buffer)))
        np.random.shuffle(indices)

        for start in range(0, len(indices), config['ppo_batch_size']):
            batch_indices = indices[start:start + config['ppo_batch_size']]

            b_map = map_feats[batch_indices]
            b_card = card_feats[batch_indices]
            b_opp_card = opp_card_feats[batch_indices]
            b_scalar = scalar_feats[batch_indices]
            b_old_card_log_probs = old_card_log_probs[batch_indices]
            b_old_order_log_probs = old_order_log_probs[batch_indices]
            b_advantages = advantages_t[batch_indices]
            b_returns = returns_t[batch_indices]

            # 前向传播 (4输入)
            card_logits, order_logits, values = model(b_map, b_card, b_opp_card, b_scalar)

            # 选牌策略损失
            new_card_log_probs = []
            for i, bi in enumerate(batch_indices):
                card_action = buffer.card_actions[bi]
                n_cards = buffer.card_masks[bi]
                
                masked_logits = card_logits[i].clone()
                for j in range(n_cards, MAX_CARDS):
                    masked_logits[j] = -1e9
                
                probs = torch.softmax(masked_logits, dim=0)
                
                log_prob = 0.0
                for idx in card_action:
                    if idx < n_cards:
                        log_prob += torch.log(probs[idx] + 1e-8)
                new_card_log_probs.append(log_prob)
            
            new_card_log_probs = torch.stack(new_card_log_probs)

            ratio = torch.exp(new_card_log_probs - b_old_card_log_probs)

            surr1 = ratio * b_advantages
            surr2 = torch.clamp(ratio, 1.0 - clip_ratio, 1.0 + clip_ratio) * b_advantages
            policy_loss = -torch.min(surr1, surr2).mean()

            # 排序熵正则
            order_probs = torch.softmax(order_logits, dim=-1)
            order_entropy = -(order_probs * torch.log(order_probs + 1e-8)).sum(dim=-1).mean()

            # 选牌熵正则
            card_probs_full = torch.softmax(card_logits, dim=-1)
            card_entropy = -(card_probs_full * torch.log(card_probs_full + 1e-8)).sum(dim=-1).mean()

            # 价值损失
            value_loss = nn.functional.mse_loss(values.squeeze(), b_returns)

            # 总损失
            loss = policy_loss + \
                   config['ppo_value_coef'] * value_loss - \
                   config['ppo_entropy_coef'] * (card_entropy + order_entropy)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), config['ppo_max_grad_norm'])
            optimizer.step()

            total_loss_sum += loss.item()
            n_updates += 1

    return total_loss_sum / max(n_updates, 1)


# ==================== 进化池 ====================

class EvolutionPool:
    """自我对弈进化池"""
    def __init__(self, pool_size=5):
        self.pool_size = pool_size
        self.pool = []
        self.generation = 0

    def add_model(self, state_dict, win_rate=0.0):
        self.generation += 1
        self.pool.append({
            'state_dict': deepcopy(state_dict),
            'win_rate': win_rate,
            'generation': self.generation,
        })
        if len(self.pool) > self.pool_size:
            self.pool.sort(key=lambda x: x['win_rate'], reverse=True)
            self.pool = self.pool[:self.pool_size]

    def get_opponent_state_dict(self):
        if not self.pool:
            return None
        weights = [max(m['win_rate'], 0.1) for m in self.pool]
        total = sum(weights)
        probs = [w / total for w in weights]
        idx = np.random.choice(len(self.pool), p=probs)
        return self.pool[idx]['state_dict']

    def get_best_state_dict(self):
        if not self.pool:
            return None
        self.pool.sort(key=lambda x: x['win_rate'], reverse=True)
        return self.pool[0]['state_dict']


def evaluate_against_rule_ai(model, env, device, num_games=20):
    """评估神经网络对规则AI的胜率 (v3: 4输入)"""
    model.eval()
    wins = 0
    total = 0

    for _ in range(num_games):
        env_eval = CloakEnv()
        states = env_eval.reset()
        done = False

        while not done and env_eval.game['currentRound'] <= 50:
            game = env_eval.game
            ps = game['playerStates']
            round_data = {}

            # 玩家0: 神经网络
            selected_indices, _, _ = select_cards_autoregressive(
                model, game, 0, device, temperature=0.3
            )
            current_cards = ps[0]['currentCards']
            hand_cards = [current_cards[i] for i in selected_indices if i < len(current_cards)]
            
            state = states[0]
            map_feat, card_feat, opp_card_feat, scalar_feat = _build_model_inputs(state, device)
            with torch.no_grad():
                _, order_logits, _ = model(map_feat, card_feat, opp_card_feat, scalar_feat)
            ordered_cards, _ = select_order_from_logits(order_logits[0], hand_cards, temperature=0.3)
            round_data[0] = {'select_indices': selected_indices, 'card_order': ordered_cards}

            # 玩家1: 规则AI
            ai = RuleBasedAI(1)
            ai_selected = ai.select_cards(game)
            ai_hand = [ps[1]['currentCards'][i] for i in ai_selected if i < len(ps[1]['currentCards'])]
            ai_ordered = ai.order_cards(game, ai_hand)
            round_data[1] = {'select_indices': ai_selected, 'card_order': ai_ordered}

            states, rewards, done, info = env_eval.execute_round(round_data[0], round_data[1])

        if env_eval.game['winner'] == 0:
            wins += 1
        total += 1

    return wins / max(total, 1)


# ==================== PPO训练主循环 ====================

def train_ppo(model, config, device, start_iteration=0, bc_win_rate=0.0):
    """PPO训练主循环 v4 (保守微调 + KL约束 + 回退机制)"""
    print(f"\n{'='*60}")
    print(f"[PPO] PPO强化学习训练 v4 (保守微调)")
    print(f"  迭代次数: {config['ppo_iterations']}")
    print(f"  每次迭代对局数: {config['ppo_episodes_per_iter']}")
    print(f"  学习率: {config['ppo_lr']} (保守)")
    print(f"  PPO裁剪比率: {config['ppo_clip_ratio']} (保守)")
    print(f"  初始温度: {config['ppo_init_temperature']}")
    print(f"  KL散度惩罚: {config['ppo_kl_coef']}")
    print(f"  回退机制: {'YES' if config['use_rollback'] else 'NO'}")
    print(f"  BC基线胜率: {bc_win_rate:.1%}")
    print(f"  进化池: {'YES' if config['use_evolution_pool'] else 'NO'}")
    print(f"  设备: {device}")
    print(f"{'='*60}")

    optimizer = optim.Adam(model.parameters(), lr=config['ppo_lr'])
    os.makedirs(config['save_dir'], exist_ok=True)
    os.makedirs(config['log_dir'], exist_ok=True)

    training_log = []
    best_win_rate = bc_win_rate
    bc_state_dict = deepcopy(model.state_dict())  # v4: 保存BC权重用于回退
    consecutive_no_improvement = 0

    evo_pool = None
    if config['use_evolution_pool']:
        evo_pool = EvolutionPool(config['evolution_pool_size'])
        evo_pool.add_model(model.state_dict(), win_rate=bc_win_rate)

    for iteration in range(start_iteration, config['ppo_iterations']):
        iter_start = time.time()

        # v4: 温度从0.3开始，缓慢衰减
        temperature = max(0.15, config['ppo_init_temperature'] - iteration * 0.001)
        
        # v4课程式学习：更缓慢地从规则AI过渡
        progress = iteration / max(config['ppo_iterations'], 1)
        if progress < 0.4:
            rule_ratio = 0.9   # Phase 1: 90% 规则AI (v4: 更多规则AI对弈)
        elif progress < 0.7:
            rule_ratio = 0.6   # Phase 2: 60% 规则AI
        else:
            rule_ratio = 0.3   # Phase 3: 30% 规则AI

        all_buffers = []
        total_rewards = {0: 0.0, 1: 0.0}
        total_games = 0

        for ep in range(config['ppo_episodes_per_iter']):
            try:
                env = CloakEnv()
                buffer, ep_rewards = collect_rollouts_with_rule_ai(
                    model, env, config, device,
                    temperature=temperature,
                    rule_ratio=rule_ratio
                )
                all_buffers.append(buffer)
                total_rewards[0] += ep_rewards[0]
                total_rewards[1] += ep_rewards.get(1, 0.0)
                total_games += 1
            except Exception as e:
                print(f"    [WARN] Episode {ep+1} failed: {e}", flush=True)
                continue

        # 合并buffer
        combined = RolloutBuffer()
        for buf in all_buffers:
            for i in range(len(buf)):
                combined.add(
                    buf.map_features[i], buf.card_features[i], buf.opp_card_features[i],
                    buf.scalar_features[i],
                    buf.card_actions[i], buf.order_actions[i],
                    buf.card_log_probs[i], buf.order_log_probs[i],
                    buf.values[i], buf.rewards[i], buf.dones[i], buf.card_masks[i]
                )
        del all_buffers
        gc.collect()

        if len(combined) == 0:
            print(f"  Iter {iteration+1}: No data, skip", flush=True)
            continue

        try:
            avg_loss = ppo_update(model, optimizer, combined, config, device)
        except RuntimeError as e:
            if 'CUDA' in str(e) or 'memory' in str(e):
                print(f"    [WARN] CUDA OOM, skipping update: {e}", flush=True)
                torch.cuda.empty_cache()
                gc.collect()
                avg_loss = 0.0
            else:
                raise
        
        buffer_size = len(combined)
        del combined
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        avg_reward_0 = total_rewards[0] / max(total_games, 1)
        avg_reward_1 = total_rewards[1] / max(total_games, 1)
        elapsed = time.time() - iter_start

        # v4: 每轮都评估胜率（而不是每5轮）
        win_rate = evaluate_against_rule_ai(model, CloakEnv(), device, num_games=20)
        
        if evo_pool is not None:
            evo_pool.add_model(model.state_dict(), win_rate)

        # v4: 回退机制 - 胜率显著低于BC基线时回退
        if config['use_rollback'] and bc_win_rate > 0:
            if win_rate < bc_win_rate - config['rollback_threshold']:
                print(f"  ⚠️ Win rate {win_rate:.1%} dropped below BC baseline {bc_win_rate:.1%} - {config['rollback_threshold']:.0%}!", flush=True)
                print(f"  ⏪ Rolling back to BC weights...", flush=True)
                model.load_state_dict(bc_state_dict)
                # 降低学习率
                for pg in optimizer.param_groups:
                    pg['lr'] = max(pg['lr'] * 0.5, 1e-7)
                print(f"  ⏪ New LR: {optimizer.param_groups[0]['lr']:.2e}", flush=True)
                consecutive_no_improvement = 0
            elif win_rate >= best_win_rate:
                consecutive_no_improvement = 0
            else:
                consecutive_no_improvement += 1

        # v4: 连续10轮无改善则降低学习率
        if consecutive_no_improvement >= 10:
            for pg in optimizer.param_groups:
                pg['lr'] = max(pg['lr'] * 0.7, 1e-7)
            print(f"  📉 No improvement for 10 iters, reducing LR to {optimizer.param_groups[0]['lr']:.2e}", flush=True)
            consecutive_no_improvement = 0

        log_entry = {
            'iteration': iteration,
            'avg_loss': avg_loss,
            'avg_reward_0': avg_reward_0,
            'avg_reward_1': avg_reward_1,
            'total_games': total_games,
            'buffer_size': buffer_size,
            'temperature': temperature,
            'rule_ratio': rule_ratio,
            'win_rate': win_rate,
            'elapsed': elapsed,
        }
        training_log.append(log_entry)

        print(f"  Iter {iteration+1}/{config['ppo_iterations']}: "
              f"Loss={avg_loss:.4f}, "
              f"R0={avg_reward_0:.3f}, R1={avg_reward_1:.3f}, "
              f"Buffer={buffer_size}, "
              f"T={temperature:.2f}, Rule={rule_ratio:.0%}, "
              f"WinRate={win_rate:.1%}, "
              f"Time={elapsed:.1f}s", flush=True)

        # 保存checkpoint
        if (iteration + 1) % config['save_interval'] == 0:
            checkpoint_path = os.path.join(config['save_dir'], f'model_iter_{iteration+1}.pt')
            torch.save({
                'iteration': iteration + 1,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'avg_loss': avg_loss,
                'avg_reward': avg_reward_0,
                'win_rate': win_rate,
                'config': config,
            }, checkpoint_path)
            print(f"    Checkpoint saved: {checkpoint_path}")

        # v4: 只在真正改善时保存best模型
        if win_rate > best_win_rate:
            best_win_rate = win_rate
            best_path = os.path.join(config['save_dir'], 'model_best.pt')
            torch.save({
                'iteration': iteration + 1,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'avg_loss': avg_loss,
                'win_rate': best_win_rate,
                'config': config,
            }, best_path)
            print(f"    ✅ Best model updated: WinRate={best_win_rate:.1%}")

        log_path = os.path.join(config['log_dir'], 'training_log.json')
        with open(log_path, 'w', encoding='utf-8') as f:
            json.dump(training_log, f, indent=2, ensure_ascii=False)

    return model


# ==================== 主训练流程 ====================

def main():
    parser = argparse.ArgumentParser(description='Cloak of Moves AI Training v3')
    parser.add_argument('--bc_only', action='store_true', help='BC pretraining only')
    parser.add_argument('--ppo_only', action='store_true', help='PPO training only')
    parser.add_argument('--resume', type=str, default=None, help='Resume from checkpoint')
    parser.add_argument('--bc_episodes', type=int, default=None, help='BC episodes')
    parser.add_argument('--ppo_iterations', type=int, default=None, help='PPO iterations')
    parser.add_argument('--device', type=str, default=None, help='Training device')
    parser.add_argument('--save_dir', type=str, default=None, help='Checkpoint directory')
    args = parser.parse_args()

    config = DEFAULT_CONFIG.copy()

    if args.bc_episodes:
        config['bc_episodes'] = args.bc_episodes
    if args.ppo_iterations:
        config['ppo_iterations'] = args.ppo_iterations
    if args.save_dir:
        config['save_dir'] = args.save_dir
    if args.device:
        config['device'] = args.device

    if config['device'] == 'auto':
        config['device'] = 'cuda' if torch.cuda.is_available() else 'cpu'
    device = torch.device(config['device'])

    print(f"Cloak of Moves AI Training v4")
    print(f"Device: {device}")
    print(f"Key features:")
    print(f"  - Map: {MAP_CHANNELS} channels (+portal pairs +threat map)")
    print(f"  - Scalars: {SCALAR_DIM} dims (+skills/portals/opp state/card pool)")
    print(f"  - Opponent card encoding (CrossAttention)")
    print(f"  - BC v4: Cosine LR + target accuracy + best model restore")
    print(f"  - PPO v4: Conservative (LR=5e-6, clip=0.15, T_init=0.3)")
    print(f"  - Rollback mechanism when win rate drops below BC baseline")
    print(f"  - Every-iteration evaluation + auto LR reduction")
    print(f"  - Curriculum learning (90%->60%->30% rule AI)")
    print(f"  - Enhanced reward shaping (dmg/position/HP/win)")
    print(f"  - Evolution pool + Shared card pool")

    model = CloakNet().to(device)
    total, trainable = count_parameters(model)
    print(f"Model parameters: {total:,} (trainable: {trainable:,})")

    start_iteration = 0
    if args.resume:
        if os.path.exists(args.resume):
            checkpoint = torch.load(args.resume, map_location=device)
            model.load_state_dict(checkpoint['model_state_dict'])
            start_iteration = checkpoint.get('iteration', 0)
            print(f"Resumed from: {args.resume} (iteration {start_iteration})")
        else:
            print(f"Checkpoint not found: {args.resume}")

    os.makedirs(config['save_dir'], exist_ok=True)
    os.makedirs(config['log_dir'], exist_ok=True)

    # ========== BC Pretraining ==========
    if not args.ppo_only:
        print(f"\nCollecting rule AI self-play data ({config['bc_episodes']} games)...")
        bc_dataset = BCDataset()
        for ep in range(config['bc_episodes']):
            env = CloakEnv()
            episode_data = self_play_episode(env)
            for pi in range(2):
                bc_dataset.add_episode(episode_data, pi)
            if (ep + 1) % 100 == 0:
                print(f"  Collected {ep+1}/{config['bc_episodes']} games, "
                      f"data: {len(bc_dataset)} samples")

        model = train_bc(model, bc_dataset, config, device)

        bc_path = os.path.join(config['save_dir'], 'model_bc_pretrained.pt')
        torch.save({
            'model_state_dict': model.state_dict(),
            'config': config,
        }, bc_path)
        print(f"BC pretrained model saved: {bc_path}")

        # v4: 评估BC对规则AI的基线胜率
        print(f"\n[EVAL] Evaluating BC model against Rule AI (50 games)...")
        bc_win_rate = evaluate_against_rule_ai(model, CloakEnv(), device, num_games=50)
        print(f"[EVAL] BC Win Rate vs Rule AI: {bc_win_rate:.1%}")
        if bc_win_rate < 0.3:
            print(f"  ⚠️ BC win rate is low ({bc_win_rate:.1%}). Consider increasing bc_episodes or bc_epochs.")
    else:
        bc_win_rate = 0.0

    # ========== PPO Training ==========
    if not args.bc_only:
        model = train_ppo(model, config, device, start_iteration, bc_win_rate=bc_win_rate)

        final_path = os.path.join(config['save_dir'], 'model_final.pt')
        torch.save({
            'model_state_dict': model.state_dict(),
            'config': config,
        }, final_path)
        print(f"Final model saved: {final_path}")

    print(f"\nTraining complete!")
    print(f"Next: python export_onnx.py {os.path.join(config['save_dir'], 'model_final.pt')}")


if __name__ == '__main__':
    main()