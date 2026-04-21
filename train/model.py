"""
CloakNet v3 - 增强版深度神经网络（ResNet + Self-Attention + Cross-Attention + 多头输出）
用于 Cloak of Moves 游戏的AI决策

v3改进 (基于v2):
  地图编码器: 10→12通道 (新增传送门配对+威胁地图)
  标量编码器: 30→55维 (新增25维全局特征: 技能详情/传送门/对手状态/牌池推算等)
  奖励塑形: 大幅增强 (伤害/位置/HP优势/胜负)

架构:
  地图编码器: ResNet-4Block (12→64通道, 4个残差块)
  己方卡牌编码器: MLP + Multi-Head Self-Attention (4头)
  对手牌编码器: MLP + Multi-Head Self-Attention (4头)
  交叉注意力: 己方牌Query ↔ 对手牌Key/Value
  标量编码器: 5层MLP (55→64)
  融合层: 4层MLP
  策略头: 选牌(8 logits) + 排序(3 logits)
  价值头: 1 value
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


class ResBlock(nn.Module):
    """残差块: Conv→BN→ReLU→Conv→BN + Skip Connection"""
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x):
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual
        out = F.relu(out)
        return out


class MapEncoder(nn.Module):
    """地图编码器: Conv + 4个ResBlock + Global AvgPool"""
    def __init__(self, in_channels=10, hidden_channels=64, num_blocks=4):
        super().__init__()
        self.conv_in = nn.Conv2d(in_channels, hidden_channels, 3, padding=1)
        self.bn_in = nn.BatchNorm2d(hidden_channels)
        self.res_blocks = nn.ModuleList([
            ResBlock(hidden_channels) for _ in range(num_blocks)
        ])
        self.pool = nn.AdaptiveAvgPool2d(1)

    def forward(self, x):
        """x: (B, 12, 11, 11) → (B, 64)"""
        x = F.relu(self.bn_in(self.conv_in(x)))
        for block in self.res_blocks:
            x = block(x)
        x = self.pool(x).squeeze(-1).squeeze(-1)
        return x


class CardEncoder(nn.Module):
    """己方卡牌编码器: MLP + Multi-Head Self-Attention"""
    def __init__(self, card_dim=8, hidden_dim=128, num_heads=4, max_cards=8):
        super().__init__()
        self.max_cards = max_cards
        # 每张牌的MLP: 8→64→128→128→64 (4层)
        self.card_mlp = nn.Sequential(
            nn.Linear(card_dim, 64),
            nn.ReLU(),
            nn.Linear(64, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 64)
        )
        # Self-Attention: 让牌之间交互信息
        self.attention = nn.MultiheadAttention(
            embed_dim=64, num_heads=num_heads,
            dropout=0.1, batch_first=True
        )
        self.norm = nn.LayerNorm(64)

    def forward(self, x):
        """x: (B, 8, 8) → (B, 8, 64) per-card features"""
        features = self.card_mlp(x)  # (B, 8, 64)
        attn_out, _ = self.attention(features, features, features)
        features = self.norm(features + attn_out)
        return features


class OpponentCardEncoder(nn.Module):
    """对手牌编码器: MLP + Multi-Head Self-Attention (独立参数)"""
    def __init__(self, card_dim=8, hidden_dim=64, num_heads=2, max_opp_cards=3):
        super().__init__()
        self.max_opp_cards = max_opp_cards
        # 对手牌MLP: 8→32→64→64→64 (4层，较窄因为信息更少)
        self.card_mlp = nn.Sequential(
            nn.Linear(card_dim, 32),
            nn.ReLU(),
            nn.Linear(32, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 64)
        )
        # Self-Attention: 对手牌之间交互
        self.attention = nn.MultiheadAttention(
            embed_dim=64, num_heads=num_heads,
            dropout=0.1, batch_first=True
        )
        self.norm = nn.LayerNorm(64)

    def forward(self, x):
        """x: (B, 3, 8) → (B, 3, 64) per-card features"""
        features = self.card_mlp(x)  # (B, 3, 64)
        attn_out, _ = self.attention(features, features, features)
        features = self.norm(features + attn_out)
        return features


class CrossAttention(nn.Module):
    """
    交叉注意力: 己方牌(Query) ↔ 对手牌(Key/Value)
    让模型学会"对手有这张牌时，我该怎么调整"
    """
    def __init__(self, embed_dim=64, num_heads=4, dropout=0.1):
        super().__init__()
        self.cross_attn = nn.MultiheadAttention(
            embed_dim=embed_dim, num_heads=num_heads,
            dropout=dropout, batch_first=True
        )
        self.norm = nn.LayerNorm(embed_dim)
        # 门控机制：控制交叉注意力的影响程度
        self.gate = nn.Sequential(
            nn.Linear(embed_dim * 2, embed_dim),
            nn.Sigmoid()
        )

    def forward(self, my_cards, opp_cards):
        """
        my_cards:  (B, 8, 64) 己方牌特征
        opp_cards: (B, 3, 64) 对手牌特征
        
        Returns: (B, 8, 64) 增强后的己方牌特征
        """
        # 交叉注意力: 己方牌问对手牌
        attn_out, attn_weights = self.cross_attn(
            query=my_cards,
            key=opp_cards,
            value=opp_cards
        )
        
        # 门控残差连接
        gate_input = torch.cat([my_cards, attn_out], dim=-1)
        gate_values = self.gate(gate_input)
        enhanced = self.norm(my_cards + gate_values * attn_out)
        
        return enhanced


class ScalarEncoder(nn.Module):
    """标量编码器: 5层MLP with LayerNorm + Dropout (55维输入)"""
    def __init__(self, scalar_dim=55, hidden_dims=None):
        super().__init__()
        if hidden_dims is None:
            hidden_dims = [64, 128, 256, 128, 64]
        layers = []
        prev_dim = scalar_dim
        for h in hidden_dims:
            layers.extend([
                nn.Linear(prev_dim, h),
                nn.LayerNorm(h),
                nn.ReLU(),
                nn.Dropout(0.1)
            ])
            prev_dim = h
        self.mlp = nn.Sequential(*layers)

    def forward(self, x):
        """x: (B, 55) → (B, 64)"""
        return self.mlp(x)


class CloakNet(nn.Module):
    """
    完整的Cloak of Moves决策网络 v3
    
    输入:
      map_input:       (B, 12, 11, 11)  地图12通道特征 (v3: +传送门配对+威胁地图)
      card_input:      (B, 8, 8)        8张牌×8维特征
      opp_card_input:  (B, 3, 8)        3张对手牌×8维特征
      scalar_input:    (B, 55)          55维标量特征 (v3: 原30维+25维新增)
    
    输出:
      card_logits:  (B, 8)  每张牌的选择logit
      order_logits: (B, 3)  手牌出牌优先级logit
      value:        (B, 1)  局面价值评估
    """
    def __init__(self, map_channels=12, card_dim=8, opp_card_dim=8,
                 scalar_dim=55, max_cards=8, max_opp_cards=3,
                 hidden_channels=64, num_res_blocks=4, num_order=3):
        super().__init__()
        self.max_cards = max_cards
        self.max_opp_cards = max_opp_cards

        # 编码器
        self.map_encoder = MapEncoder(map_channels, hidden_channels, num_res_blocks)
        self.card_encoder = CardEncoder(card_dim, 128, 4, max_cards)
        self.opp_card_encoder = OpponentCardEncoder(opp_card_dim, 64, 2, max_opp_cards)
        self.scalar_encoder = ScalarEncoder(scalar_dim)

        # 交叉注意力: 己方牌 ↔ 对手牌
        self.cross_attention = CrossAttention(embed_dim=64, num_heads=4)

        # 融合层: map(64) + card_pooled(64) + opp_card_pooled(64) + scalar(64) = 256 → 64
        fusion_dim = hidden_channels + 64 + 64 + 64
        self.fusion = nn.Sequential(
            nn.Linear(fusion_dim, 512), nn.LayerNorm(512), nn.ReLU(), nn.Dropout(0.1),
            nn.Linear(512, 256), nn.LayerNorm(256), nn.ReLU(), nn.Dropout(0.1),
            nn.Linear(256, 128), nn.LayerNorm(128), nn.ReLU(), nn.Dropout(0.1),
            nn.Linear(128, 64), nn.LayerNorm(64), nn.ReLU()
        )

        # 选牌头: 全局上下文(64) + 每张牌特征(64) → 128 → logit
        self.card_head = nn.Sequential(
            nn.Linear(64 + 64, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 1)
        )

        # 排序头: 全局上下文 → 3个位置logit
        self.order_head = nn.Sequential(
            nn.Linear(64, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, num_order)
        )

        # 价值头: 全局上下文 → 1
        self.value_head = nn.Sequential(
            nn.Linear(64, 128), nn.ReLU(),
            nn.Linear(128, 64), nn.ReLU(),
            nn.Linear(64, 1)
        )

        # 初始化权重
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.orthogonal_(m.weight, gain=math.sqrt(2))
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Conv2d):
                nn.init.orthogonal_(m.weight, gain=math.sqrt(2))
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, map_input, card_input, opp_card_input, scalar_input):
        """
        前向传播

        Args:
            map_input:       (B, 12, 11, 11)
            card_input:      (B, 8, 8)
            opp_card_input:  (B, 3, 8)
            scalar_input:    (B, 55)

        Returns:
            card_logits:  (B, 8)
            order_logits: (B, 3)
            value:        (B, 1)
        """
        B = map_input.size(0)

        # 编码
        map_feat = self.map_encoder(map_input)                    # (B, 64)
        card_feat = self.card_encoder(card_input)                 # (B, 8, 64)
        opp_card_feat = self.opp_card_encoder(opp_card_input)     # (B, 3, 64)
        scalar_feat = self.scalar_encoder(scalar_input)           # (B, 64)

        # 交叉注意力: 己方牌 ↔ 对手牌
        card_feat_enhanced = self.cross_attention(card_feat, opp_card_feat)  # (B, 8, 64)

        # 融合: 对卡牌做全局池化后拼接
        card_pooled = card_feat_enhanced.mean(dim=1)              # (B, 64)
        opp_card_pooled = opp_card_feat.mean(dim=1)               # (B, 64)
        fused = torch.cat([map_feat, card_pooled, opp_card_pooled, scalar_feat], dim=-1)  # (B, 256)
        global_feat = self.fusion(fused)                          # (B, 64)

        # 选牌: 全局上下文 + 增强后的每张牌特征 → 每张牌的logit
        global_expanded = global_feat.unsqueeze(1).expand(-1, self.max_cards, -1)  # (B, 8, 64)
        card_input_feat = torch.cat([global_expanded, card_feat_enhanced], dim=-1)  # (B, 8, 128)
        card_logits = self.card_head(card_input_feat).squeeze(-1)                   # (B, 8)

        # 排序 + 价值
        order_logits = self.order_head(global_feat)  # (B, 3)
        value = self.value_head(global_feat)          # (B, 1)

        return card_logits, order_logits, value


def count_parameters(model):
    """统计模型参数量"""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return total, trainable


if __name__ == '__main__':
    # 测试模型
    model = CloakNet()
    total, trainable = count_parameters(model)
    print(f"模型总参数量: {total:,}")
    print(f"可训练参数量: {trainable:,}")

    # 测试前向传播
    B = 4
    map_input = torch.randn(B, 12, 11, 11)
    card_input = torch.randn(B, 8, 8)
    opp_card_input = torch.randn(B, 3, 8)
    scalar_input = torch.randn(B, 55)

    card_logits, order_logits, value = model(map_input, card_input, opp_card_input, scalar_input)
    print(f"\n输出形状:")
    print(f"  card_logits:  {card_logits.shape}")   # (4, 8)
    print(f"  order_logits: {order_logits.shape}")  # (4, 3)
    print(f"  value:        {value.shape}")          # (4, 1)
    print("\n[OK] CloakNet v3 model test passed!")
