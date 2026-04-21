"""
Cloak of Moves 游戏环境模拟器 (Python版)
忠实复刻 server/game/match.js 的游戏逻辑，用于神经网络训练

关键改进 (v2):
- 共享卡牌生成：与真实游戏一致，双方看到相同的卡牌池
- 冰原寒流概率修正：15%而非100%
- 完善被动技能实现
- 奖励塑形：接近对手、有效攻击、防御时机等
- 正确的火球/沙丘逻辑
"""

import numpy as np
import random
import math
from copy import deepcopy

# ==================== 常量定义 ====================

GAME_CONFIG = {
    'INITIAL_HP': 5,
    'MAP_SIZE': 7,
    'MAP_SIZE_OPTIONS': [5, 6, 7, 8, 9, 10, 11],
    'CARD_COUNT': 5,   # 每回合发牌数
    'HAND_SIZE': 3,    # 选牌数
}

CARD_TYPES = ['move', 'attack', 'defense', 'scout']
DIRECTIONS = ['up', 'down', 'left', 'right']
SCOUT_TYPES = ['row', 'col', 'around']

DIRECTION_OFFSET = {
    'up': {'x': 0, 'y': -1},
    'down': {'x': 0, 'y': 1},
    'left': {'x': -1, 'y': 0},
    'right': {'x': 1, 'y': 0},
}

CARD_WEIGHTS = {
    'move': 30,
    'attack': 25,
    'defense': 20,
    'scout': 25,
}

ATTACK_RANGES = [1, 1, 1, 2]  # 75% range=1, 25% range=2
SCOUT_WEIGHTS = {'row': 35, 'col': 35, 'around': 30}

# 地图主题
MAP_THEMES = {
    'forest': {
        'id': 'forest', 'nameCn': '森林',
        'obstacleTypes': ['tree', 'bush'],
        'grassEnabled': True, 'sandDuneEnabled': False,
        'portalEnabled': True, 'shapeEnabled': True,
        'shapeLayout': [
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
        ],
    },
    'desert': {
        'id': 'desert', 'nameCn': '沙漠',
        'obstacleTypes': ['rock', 'cactus'],
        'grassEnabled': False, 'sandDuneEnabled': True,
        'portalEnabled': True, 'shapeEnabled': True,
        'shapeLayout': [
            [0,0,0,1,0,0,0],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [0,0,0,1,0,0,0],
        ],
    },
    'ice': {
        'id': 'ice', 'nameCn': '冰原',
        'obstacleTypes': ['ice_rock', 'crystal'],
        'grassEnabled': False, 'sandDuneEnabled': False,
        'portalEnabled': True, 'shapeEnabled': True,
        'shapeLayout': [
            [0,0,1,1,1,0,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,1,0,1,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,0,1,1,1,0,0],
        ],
        'frostbiteChance': 0.15,  # 冰原寒流概率：15%
    },
    'volcano': {
        'id': 'volcano', 'nameCn': '火山',
        'obstacleTypes': ['lava_rock', 'magma'],
        'grassEnabled': False, 'sandDuneEnabled': False,
        'portalEnabled': True, 'shapeEnabled': True,
        'shapeLayout': [
            [1,0,0,1,0,0,1],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [1,0,0,1,0,0,1],
        ],
        'fireballChance': 0.2,  # 火球概率
    },
    'ruins': {
        'id': 'ruins', 'nameCn': '古城',
        'obstacleTypes': ['pillar', 'rubble'],
        'grassEnabled': False, 'sandDuneEnabled': False,
        'portalEnabled': True, 'shapeEnabled': True,
        'shapeLayout': [
            [1,1,0,0,0,1,1],
            [1,1,1,1,1,1,1],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [0,1,1,1,1,1,0],
            [1,1,1,1,1,1,1],
            [1,1,0,0,0,1,1],
        ],
    },
}

THEME_LIST = ['forest', 'desert', 'ice', 'volcano', 'ruins']

PORTAL_COLORS = [
    {'color': 'red', 'name': '红色'},
    {'color': 'yellow', 'name': '黄色'},
    {'color': 'blue', 'name': '蓝色'},
]

PROFESSIONS = ['mage', 'knight', 'reader', 'thief', 'archer']

CHARACTER_SKILLS = {
    'mage_male': {'id': 'mage_male', 'name': '男法师', 'profession': 'mage', 'gender': 'male',
                  'skillName': '天降陨石', 'skillType': 'active', 'cooldown': 3, 'bonusHp': 0},
    'mage_female': {'id': 'mage_female', 'name': '女法师', 'profession': 'mage', 'gender': 'female',
                    'skillName': '爆裂攻击', 'skillType': 'passive', 'cooldown': 0, 'bonusHp': 0,
                    'passiveEffect': 'explosive_attack'},
    'knight_male': {'id': 'knight_male', 'name': '男骑士', 'profession': 'knight', 'gender': 'male',
                    'skillName': '旋风斩', 'skillType': 'active', 'cooldown': 3, 'bonusHp': 0},
    'knight_female': {'id': 'knight_female', 'name': '女骑士', 'profession': 'knight', 'gender': 'female',
                      'skillName': '坚韧突刺', 'skillType': 'passive', 'cooldown': 0, 'bonusHp': 1,
                      'passiveEffect': 'tough_thrust'},
    'reader_male': {'id': 'reader_male', 'name': '男阅读者', 'profession': 'reader', 'gender': 'male',
                    'skillName': '回忆过去', 'skillType': 'active', 'cooldown': 5, 'bonusHp': 0},
    'reader_female': {'id': 'reader_female', 'name': '女阅读者', 'profession': 'reader', 'gender': 'female',
                      'skillName': '深度求索', 'skillType': 'passive', 'cooldown': 0, 'bonusHp': 0,
                      'passiveEffect': 'deep_seeker'},
    'thief_male': {'id': 'thief_male', 'name': '男盗贼', 'profession': 'thief', 'gender': 'male',
                   'skillName': '盗为己用', 'skillType': 'active', 'cooldown': 4, 'bonusHp': 0},
    'thief_female': {'id': 'thief_female', 'name': '女盗贼', 'profession': 'thief', 'gender': 'female',
                     'skillName': '隔墙有眼', 'skillType': 'passive', 'cooldown': 0, 'bonusHp': 0,
                     'passiveEffect': 'wall_has_eyes'},
    'archer_male': {'id': 'archer_male', 'name': '男弓箭手', 'profession': 'archer', 'gender': 'male',
                    'skillName': '百步穿杨', 'skillType': 'active', 'cooldown': 5, 'bonusHp': 0},
    'archer_female': {'id': 'archer_female', 'name': '女弓箭手', 'profession': 'archer', 'gender': 'female',
                      'skillName': '天降箭雨', 'skillType': 'passive', 'cooldown': 0, 'bonusHp': 0,
                      'passiveEffect': 'arrow_rain'},
}

# ==================== 状态编码 ====================

MAX_MAP_SIZE = 11
MAX_CARDS = 8
MAX_OPP_CARDS = 3  # 最多查看3张对手牌
HAND_SIZE = 3
SCALAR_DIM = 55    # v3: 30→55维标量特征
MAP_CHANNELS = 12  # v3: 10→12通道地图特征

CARD_TYPE_MAP = {'move': 0, 'attack': 1, 'defense': 2, 'scout': 3, 'skill': 4}
DIRECTION_MAP = {'up': 0, 'right': 1, 'down': 2, 'left': 3, None: 4}
SCOUT_TYPE_MAP = {'row': 0, 'col': 1, 'around': 2, None: 3}
THEME_ID_MAP = {tid: idx for idx, tid in enumerate(THEME_LIST)}
PROFESSION_ID_MAP = {pid: idx for idx, pid in enumerate(PROFESSIONS)}


def encode_card(card):
    """编码单张卡牌为8维向量"""
    features = np.zeros(8, dtype=np.float32)
    features[0] = CARD_TYPE_MAP.get(card.get('type'), 0)
    features[1] = DIRECTION_MAP.get(card.get('direction'), 4)
    features[2] = card.get('range', 0)
    features[3] = SCOUT_TYPE_MAP.get(card.get('scoutType'), 3)
    features[4] = 1.0 if card.get('isSkillCard') else 0.0
    features[5] = 1.0 if card.get('invalidated') else 0.0
    features[6] = 0  # card_key index (简化)
    features[7] = 1.0  # 存在标记
    return features


def encode_map_cell(x, y, game_map, player_states):
    """编码地图格子为10维向量（基础通道0-9）"""
    features = np.zeros(10, dtype=np.float32)

    # 有效位置
    if game_map.get('isShapeMap') and game_map.get('shapeLayout') is not None:
        layout = game_map['shapeLayout']
        if 0 <= y < len(layout) and 0 <= x < len(layout[y]):
            features[0] = 1.0 if layout[y][x] == 1 else 0.0
    else:
        if 0 <= x < game_map['width'] and 0 <= y < game_map['height']:
            features[0] = 1.0

    # 障碍物
    for o in game_map.get('obstacles', []):
        if o['x'] == x and o['y'] == y:
            if o.get('isBoundary'):
                features[9] = 1.0
            else:
                features[1] = 1.0
            break

    # 草丛
    if game_map.get('grass'):
        for g in game_map['grass']:
            if g['x'] == x and g['y'] == y:
                features[2] = 1.0
                break

    # 沙丘
    if game_map.get('sandDunes'):
        for s in game_map['sandDunes']:
            if s['x'] == x and s['y'] == y:
                features[3] = 1.0
                break

    # 传送门
    if game_map.get('portals'):
        for p in game_map['portals']:
            if (p['entry']['x'] == x and p['entry']['y'] == y) or \
               (p['exit']['x'] == x and p['exit']['y'] == y):
                features[4] = 1.0
                break

    # 玩家位置和血量
    for i in range(min(len(player_states), 2)):
        if player_states[i]['position']['x'] == x and player_states[i]['position']['y'] == y:
            features[5 + i] = 1.0
            features[7 + i] = player_states[i]['hp']

    return features


def _compute_threat_map(game, attacker_index, max_range=2):
    """
    计算攻击威胁地图：从攻击者位置出发，标记所有可能被攻击到的格子
    返回 (MAX_MAP_SIZE, MAX_MAP_SIZE) 的0/1数组
    """
    threat = np.zeros((MAX_MAP_SIZE, MAX_MAP_SIZE), dtype=np.float32)
    ps = game['playerStates']
    attacker = ps[attacker_index]
    game_map = game['map']
    opp = ps[1 - attacker_index]
    
    # 女骑士攻击+1
    skill = attacker.get('skill') or {}
    bonus_range = 1 if skill.get('passiveEffect') == 'tough_thrust' else 0
    
    for d in DIRECTIONS:
        offset = DIRECTION_OFFSET[d]
        for r in range(1, max_range + 1 + bonus_range):
            cx = attacker['position']['x'] + offset['x'] * r
            cy = attacker['position']['y'] + offset['y'] * r
            if cx < 0 or cx >= game_map['width'] or cy < 0 or cy >= game_map['height']:
                break
            if 0 <= cy < MAX_MAP_SIZE and 0 <= cx < MAX_MAP_SIZE:
                threat[cy, cx] = 1.0
            if any(o['x'] == cx and o['y'] == cy and not o.get('isBoundary')
                   for o in game_map['obstacles']):
                break
    return threat


def _compute_portal_pair_map(game_map):
    """
    计算传送门配对地图：同一对传送门用相同标记
    返回 (MAX_MAP_SIZE, MAX_MAP_SIZE) 的0~1数组
    """
    pair_map = np.zeros((MAX_MAP_SIZE, MAX_MAP_SIZE), dtype=np.float32)
    portals = game_map.get('portals', [])
    for idx, p in enumerate(portals):
        val = (idx + 1) / max(len(portals), 1)  # 归一化
        ex, ey = p['entry']['x'], p['entry']['y']
        ax, ay = p['exit']['x'], p['exit']['y']
        if 0 <= ey < MAX_MAP_SIZE and 0 <= ex < MAX_MAP_SIZE:
            pair_map[ey, ex] = val
        if 0 <= ay < MAX_MAP_SIZE and 0 <= ax < MAX_MAP_SIZE:
            pair_map[ay, ax] = val
    return pair_map


def _count_nearby_features(game_map, pos, radius=2):
    """计算附近（曼哈顿距离≤radius）的草丛和传送门数量"""
    grass_count = 0
    portal_count = 0
    for g in game_map.get('grass', []):
        if abs(g['x'] - pos['x']) + abs(g['y'] - pos['y']) <= radius:
            grass_count += 1
    for p in game_map.get('portals', []):
        if abs(p['entry']['x'] - pos['x']) + abs(p['entry']['y'] - pos['y']) <= radius:
            portal_count += 1
        if abs(p['exit']['x'] - pos['x']) + abs(p['exit']['y'] - pos['y']) <= radius:
            portal_count += 1
    return grass_count, portal_count


def _count_move_directions(game, player_index):
    """计算当前位置可移动方向数"""
    me = game['playerStates'][player_index]
    opp = game['playerStates'][1 - player_index]
    game_map = game['map']
    count = 0
    for d in DIRECTIONS:
        offset = DIRECTION_OFFSET[d]
        nx = me['position']['x'] + offset['x']
        ny = me['position']['y'] + offset['y']
        if 0 <= nx < game_map['width'] and 0 <= ny < game_map['height']:
            if not any(o['x'] == nx and o['y'] == ny and not o.get('isBoundary') for o in game_map['obstacles']):
                if not (opp['position']['x'] == nx and opp['position']['y'] == ny):
                    if not any(d2['x'] == nx and d2['y'] == ny for d2 in game_map.get('sandDunes', [])):
                        count += 1
    return count


def _evaluate_hand_combo(cards):
    """评估手牌组合价值（0~1）"""
    if not cards:
        return 0.0
    types = [c.get('type', '') for c in cards]
    has_move = 'move' in types
    has_attack = 'attack' in types
    has_defense = 'defense' in types
    has_scout = 'scout' in types
    
    value = 0.0
    # 移动+攻击组合（接近+攻击）
    if has_move and has_attack:
        value += 0.4
    # 攻击+防御组合（攻守兼备）
    if has_attack and has_defense:
        value += 0.3
    # 移动+防御组合（逃跑+防守）
    if has_move and has_defense:
        value += 0.2
    # 有攻击就加分
    if has_attack:
        value += 0.1
    
    return min(value, 1.0)


def _infer_opp_cards_from_shared(my_cards, shared_cards):
    """从共享牌池推算对手可能持有的牌类型分布"""
    # 统计我的牌中各类型数量
    my_type_counts = {t: 0 for t in CARD_TYPES}
    for c in my_cards:
        t = c.get('type', '')
        if t in my_type_counts:
            my_type_counts[t] += 1
    
    # 从共享牌池中减去我的牌，推算对手的可能分布
    shared_type_counts = {t: 0 for t in CARD_TYPES}
    for c in shared_cards:
        t = c.get('type', '')
        if t in shared_type_counts:
            shared_type_counts[t] += 1
    
    # 对手的牌 = 共享牌池 - 我的牌
    opp_type_counts = {}
    total_remaining = 0
    for t in CARD_TYPES:
        remaining = max(0, shared_type_counts[t] - my_type_counts[t])
        opp_type_counts[t] = remaining
        total_remaining += remaining
    
    # 归一化为概率分布
    result = np.zeros(4, dtype=np.float32)  # move/attack/defense/scout
    type_order = ['move', 'attack', 'defense', 'scout']
    if total_remaining > 0:
        for i, t in enumerate(type_order):
            result[i] = opp_type_counts.get(t, 0) / total_remaining
    else:
        result[:] = 0.25  # 均匀分布
    
    return result


def _can_attack_hit(game, player_index, direction, attack_range=1):
    """检查攻击能否命中对手（用于特征编码）"""
    ps = game['playerStates']
    me = ps[player_index]
    opp = ps[1 - player_index]
    offset = DIRECTION_OFFSET.get(direction)
    if not offset:
        return False
    # 女骑士攻击+1
    skill = me.get('skill') or {}
    if skill.get('passiveEffect') == 'tough_thrust':
        attack_range += 1
    for r in range(1, attack_range + 1):
        cx = me['position']['x'] + offset['x'] * r
        cy = me['position']['y'] + offset['y'] * r
        if cx < 0 or cx >= game['map']['width'] or cy < 0 or cy >= game['map']['height']:
            break
        if any(o['x'] == cx and o['y'] == cy and not o.get('isBoundary')
               for o in game['map']['obstacles']):
            break
        if opp['position']['x'] == cx and opp['position']['y'] == cy:
            return True
    return False


def _count_obstacles_between(game, pos1, pos2):
    """计算两点直线路径上的障碍物数量（简化：取主方向）"""
    dx = pos2['x'] - pos1['x']
    dy = pos2['y'] - pos1['y']
    count = 0
    obstacles = game['map']['obstacles']
    if abs(dx) >= abs(dy):
        step = 1 if dx > 0 else -1
        for x in range(pos1['x'], pos2['x'], step):
            mid_y = pos1['y'] + int(dy * (x - pos1['x']) / max(abs(dx), 1))
            if any(o['x'] == x and o['y'] == mid_y and not o.get('isBoundary') for o in obstacles):
                count += 1
    else:
        step = 1 if dy > 0 else -1
        for y in range(pos1['y'], pos2['y'], step):
            mid_x = pos1['x'] + int(dx * (y - pos1['y']) / max(abs(dy), 1))
            if any(o['x'] == mid_x and o['y'] == y and not o.get('isBoundary') for o in obstacles):
                count += 1
    return min(count, 5) / 5.0  # 归一化到0~1


def _nearest_portal_distance(game, pos):
    """计算到最近传送门入口的距离"""
    portals = game['map'].get('portals', [])
    if not portals:
        return 1.0  # 无传送门时返回1（归一化最大值）
    min_dist = min(
        abs(pos['x'] - p['entry']['x']) + abs(pos['y'] - p['entry']['y'])
        for p in portals
    )
    return min(min_dist, 10) / 10.0  # 归一化到0~1


def encode_state(game, player_index):
    """
    编码完整游戏状态为神经网络输入 (v2增强版)
    新增: 对手牌编码 + 扩展标量特征(30维)
    与 neural_ai_player.js 中的 encodeState() 完全一致
    """
    opp_index = 1 - player_index
    my_state = game['playerStates'][player_index]
    opp_state = game['playerStates'][opp_index]
    game_map = game['map']

    # 1. 地图编码 (12, 11, 11) — v3: 新增传送门配对+威胁地图
    map_features = np.zeros((MAP_CHANNELS, MAX_MAP_SIZE, MAX_MAP_SIZE), dtype=np.float32)
    for y in range(min(game_map['height'], MAX_MAP_SIZE)):
        for x in range(min(game_map['width'], MAX_MAP_SIZE)):
            cell = encode_map_cell(x, y, game_map, game['playerStates'])
            for c in range(10):
                map_features[c, y, x] = cell[c]
    # 通道10: 传送门配对标记
    map_features[10] = _compute_portal_pair_map(game_map)
    # 通道11: 对手攻击威胁地图
    map_features[11] = _compute_threat_map(game, opp_index)

    # 2. 己方卡牌编码 (8, 8)
    card_features = np.zeros((MAX_CARDS, 8), dtype=np.float32)
    current_cards = my_state.get('currentCards', [])
    for i in range(min(len(current_cards), MAX_CARDS)):
        card_features[i] = encode_card(current_cards[i])

    # 3. 对手可见牌编码 (3, 8) - 新增
    # 训练时模拟查看对手牌：30%概率随机揭示1-2张
    opp_card_features = np.zeros((MAX_OPP_CARDS, 8), dtype=np.float32)
    opp_hand = opp_state.get('handCards', [])
    opp_current = opp_state.get('currentCards', [])
    # 优先使用已查看的对手手牌，否则从当前牌中模拟
    seen_cards = game.get(f'oppCardsSeen_{player_index}', [])
    if seen_cards:
        for i in range(min(len(seen_cards), MAX_OPP_CARDS)):
            opp_card_features[i] = encode_card(seen_cards[i])
    elif opp_hand and random.random() < 0.3:
        # 训练时模拟查看：随机揭示1-2张
        n_reveal = min(random.randint(1, 2), len(opp_hand), MAX_OPP_CARDS)
        indices = random.sample(range(len(opp_hand)), n_reveal)
        for i, idx in enumerate(indices):
            opp_card_features[i] = encode_card(opp_hand[idx])
    elif opp_current and random.random() < 0.15:
        # 选牌前也能模拟看到一些
        n_reveal = min(1, len(opp_current), MAX_OPP_CARDS)
        idx = random.randint(0, len(opp_current) - 1)
        opp_card_features[0] = encode_card(opp_current[idx])

    # 4. 标量特征 (55) - v3: 原30维 + 25维新增
    scalar = np.zeros(SCALAR_DIM, dtype=np.float32)
    scalar[0] = game.get('currentRound', 1) / 20.0
    scalar[1] = 1.0 if game.get('isPlayer1Priority', True) else 0.0
    scalar[2] = 1.0 if player_index == (0 if game.get('isPlayer1Priority', True) else 1) else 0.0

    my_max_hp = GAME_CONFIG['INITIAL_HP'] + (my_state.get('skill', {}) or {}).get('bonusHp', 0)
    opp_max_hp = GAME_CONFIG['INITIAL_HP'] + (opp_state.get('skill', {}) or {}).get('bonusHp', 0)
    scalar[3] = my_state['hp'] / max(my_max_hp, 1)
    scalar[4] = opp_state['hp'] / max(opp_max_hp, 1)
    scalar[5] = 1.0 if my_state.get('isDefending') else 0.0
    scalar[6] = 1.0 if opp_state.get('isDefending') else 0.0
    scalar[7] = 1.0 if my_state.get('isHidden') else 0.0
    scalar[8] = 1.0 if game.get('frozenThisRound') else 0.0
    scalar[9] = 1.0 if game.get('skillSealed') else 0.0
    scalar[10] = (my_state.get('skillCooldown', 0)) / 5.0

    theme = game.get('theme')
    scalar[11] = (THEME_ID_MAP.get(theme['id'], 0) if theme else 0) / max(len(THEME_LIST), 1)
    scalar[12] = game_map['width'] / MAX_MAP_SIZE
    scalar[13] = game_map['height'] / MAX_MAP_SIZE
    scalar[14] = 1.0 if game_map.get('isSingleRow') else 0.0
    scalar[15] = 1.0 if game_map.get('isShapeMap') else 0.0
    scalar[16] = (opp_max_hp - opp_state['hp']) / max(opp_max_hp, 1)
    scalar[17] = (my_max_hp - my_state['hp']) / max(my_max_hp, 1)

    my_skill = my_state.get('skill') or {}
    opp_skill = opp_state.get('skill') or {}
    my_prof = my_skill.get('id', '').split('_')[0] if my_skill.get('id') else None
    opp_prof = opp_skill.get('id', '').split('_')[0] if opp_skill.get('id') else None
    scalar[18] = (PROFESSION_ID_MAP.get(my_prof, 0) if my_prof else 0) / max(len(PROFESSIONS), 1)
    scalar[19] = (PROFESSION_ID_MAP.get(opp_prof, 0) if opp_prof else 0) / max(len(PROFESSIONS), 1)

    # ===== 新增10维标量特征 (20-29) =====
    # 20: 与对手的曼哈顿距离（归一化）
    manhattan = abs(my_state['position']['x'] - opp_state['position']['x']) + \
                abs(my_state['position']['y'] - opp_state['position']['y'])
    scalar[20] = min(manhattan, 10) / 10.0

    # 21: 己方能否攻击到对手（检查4个方向）
    can_hit = any(_can_attack_hit(game, player_index, d) for d in DIRECTIONS)
    scalar[21] = 1.0 if can_hit else 0.0

    # 22: 对手能否攻击到己方
    opp_can_hit = any(_can_attack_hit(game, opp_index, d) for d in DIRECTIONS)
    scalar[22] = 1.0 if opp_can_hit else 0.0

    # 23: 己方与对手间障碍物数量
    scalar[23] = _count_obstacles_between(game, my_state['position'], opp_state['position'])

    # 24: 到最近传送门入口的距离
    scalar[24] = _nearest_portal_distance(game, my_state['position'])

    # 25-29: 对手手牌类型概率分布（基于已查看的牌）
    opp_seen = opp_card_features  # (3, 8)
    card_type_counts = np.zeros(5, dtype=np.float32)  # move/attack/defense/scout/skill
    total_seen = 0
    for i in range(MAX_OPP_CARDS):
        if opp_seen[i, 7] > 0:  # 存在标记
            card_type_counts[int(opp_seen[i, 0])] += 1
            total_seen += 1
    if total_seen > 0:
        card_type_counts /= total_seen
    else:
        card_type_counts[:] = 1.0 / 5  # 未知时均匀分布
    scalar[25] = card_type_counts[0]  # move
    scalar[26] = card_type_counts[1]  # attack
    scalar[27] = card_type_counts[2]  # defense
    scalar[28] = card_type_counts[3]  # scout
    scalar[29] = card_type_counts[4]  # skill

    # ===== v3新增25维标量特征 (30-54) =====
    # 30: 传送门对数
    portals = game_map.get('portals', [])
    scalar[30] = len(portals) / 3.0

    # 31: 到最近传送门对的距离（入口+出口）
    scalar[31] = _nearest_portal_distance(game, my_state['position'])

    # 32-35: 技能详情
    scalar[32] = 1.0 if my_skill.get('skillType') == 'active' else 0.0
    scalar[33] = 1.0 if my_skill.get('skillType') == 'passive' else 0.0
    scalar[34] = 1.0 if (my_skill.get('skillType') == 'active' and my_state.get('skillCooldown', 1) == 0) else 0.0
    passive_effect = my_skill.get('passiveEffect', '')
    effect_map = {'explosive_attack': 0.2, 'tough_thrust': 0.4, 'arrow_rain': 0.6,
                  'deep_seeker': 0.8, 'wall_has_eyes': 1.0}
    scalar[35] = effect_map.get(passive_effect, 0.0)

    # 36: 对手是否在草丛中
    scalar[36] = 1.0 if opp_state.get('isHidden') else 0.0

    # 37: 对手是否可见（非隐藏）
    scalar[37] = 1.0 if not opp_state.get('isHidden') else 0.0

    # 38-41: 对手上轮动作（简化：从HP变化和状态推断）
    # 由于环境中没有显式记录上轮动作，用当前状态推断
    scalar[38] = 1.0 if opp_state.get('isDefending') else 0.0  # 对手可能在防御
    scalar[39] = 1.0 if opp_state.get('isHidden') else 0.0     # 对手可能在草丛
    scalar[40] = 0.0  # reserved: 对手上轮是否移动（需历史记录）
    scalar[41] = 0.0  # reserved: 对手上轮是否攻击（需历史记录）

    # 42: 回合紧迫性
    scalar[42] = min(game.get('currentRound', 1) / 50.0, 1.0)

    # 43: HP优势
    scalar[43] = (my_state['hp'] - opp_state['hp']) / max(my_max_hp, 1)

    # 44: 手牌组合价值
    my_hand = my_state.get('handCards', []) or my_state.get('currentCards', [])
    scalar[44] = _evaluate_hand_combo(my_hand)

    # 45: 当前位置可移动方向数
    scalar[45] = _count_move_directions(game, player_index) / 4.0

    # 46: 威胁等级（对手能从几个方向打到我）
    threat_count = sum(1 for d in DIRECTIONS if _can_attack_hit(game, opp_index, d))
    scalar[46] = threat_count / 4.0

    # 47-48: 附近草丛/传送门数量
    nearby_grass, nearby_portal = _count_nearby_features(game_map, my_state['position'])
    scalar[47] = min(nearby_grass, 3) / 3.0
    scalar[48] = min(nearby_portal, 3) / 3.0

    # 49-52: 共享牌池推算对手牌类型分布
    opp_inferred = _infer_opp_cards_from_shared(my_state.get('currentCards', []),
                                                  game.get('_sharedCards', []))
    scalar[49] = opp_inferred[0]  # opp_move_prob
    scalar[50] = opp_inferred[1]  # opp_attack_prob
    scalar[51] = opp_inferred[2]  # opp_defense_prob
    scalar[52] = opp_inferred[3]  # opp_scout_prob

    # 53: 主题特效概率提醒
    theme_id = theme.get('id', '') if theme else ''
    theme_danger = 0.0
    if theme_id == 'ice':
        theme_danger = 0.15  # frostbite chance
    elif theme_id == 'volcano':
        theme_danger = 0.2   # fireball chance
    elif theme_id == 'ruins':
        theme_danger = 0.5   # skill sealed
    scalar[53] = theme_danger

    # 54: 对手技能信息
    opp_passive_effect = opp_skill.get('passiveEffect', '')
    scalar[54] = effect_map.get(opp_passive_effect, 0.0)

    return {
        'map_features': map_features,
        'card_features': card_features,
        'opp_card_features': opp_card_features,
        'scalar_features': scalar,
    }


# ==================== 卡牌生成 ====================

def generate_card(card_type=None):
    """生成一张随机卡牌"""
    if card_type is None:
        types = list(CARD_WEIGHTS.keys())
        weights = list(CARD_WEIGHTS.values())
        card_type = random.choices(types, weights=weights, k=1)[0]

    card = {'type': card_type}

    if card_type == 'move':
        card['direction'] = random.choice(DIRECTIONS)
        card['name'] = f"移动{card['direction']}"
    elif card_type == 'attack':
        card['direction'] = random.choice(DIRECTIONS)
        card['range'] = random.choice(ATTACK_RANGES)
        card['name'] = f"攻击{card['direction']}"
    elif card_type == 'defense':
        card['name'] = '防御'
    elif card_type == 'scout':
        card['scoutType'] = random.choices(
            list(SCOUT_WEIGHTS.keys()),
            weights=list(SCOUT_WEIGHTS.values()), k=1
        )[0]
        card['name'] = f"探查{card['scoutType']}"

    card['isSkillCard'] = False
    card['invalidated'] = False
    return card


def generate_shared_cards(count):
    """
    生成共享卡牌池（与真实游戏一致）
    双方从相同的卡牌池中选牌，但各自独立选择
    """
    return [generate_card() for _ in range(count)]


def generate_cards(count):
    """生成一组卡牌（独立生成，用于非共享模式）"""
    return [generate_card() for _ in range(count)]


# ==================== 地图生成 ====================

def generate_map(size=None, theme_id=None):
    """生成游戏地图"""
    if size is None:
        size = random.choice(GAME_CONFIG['MAP_SIZE_OPTIONS'])
    if theme_id is None:
        theme_id = random.choice(THEME_LIST)

    theme = MAP_THEMES[theme_id]
    game_map = {
        'width': size,
        'height': size,
        'obstacles': [],
        'portals': [],
        'grass': [],
        'sandDunes': [],
        'isShapeMap': False,
        'isSingleRow': False,
    }

    # 障碍物生成
    obstacle_count = max(2, int(size * size * 0.15))
    forbidden = {(0, 0), (size - 1, size - 1)}  # 玩家起始位置
    obstacles = []
    for _ in range(obstacle_count * 3):
        if len(obstacles) >= obstacle_count:
            break
        ox, oy = random.randint(0, size - 1), random.randint(0, size - 1)
        if (ox, oy) not in forbidden and not any(o['x'] == ox and o['y'] == oy for o in obstacles):
            obstacles.append({
                'x': ox, 'y': oy,
                'isBoundary': False,
                'type': random.choice(theme['obstacleTypes'])
            })
    game_map['obstacles'] = obstacles

    # 传送门
    if size >= 6 and theme.get('portalEnabled', True):
        portal_count = min(2, (size * size) // 20)
        obstacle_positions = {(o['x'], o['y']) for o in obstacles}
        for pi in range(portal_count):
            for _ in range(50):
                ex, ey = random.randint(0, size - 1), random.randint(0, size - 1)
                ax, ay = random.randint(0, size - 1), random.randint(0, size - 1)
                entry_ok = (ex, ey) not in forbidden and (ex, ey) not in obstacle_positions
                exit_ok = (ax, ay) not in forbidden and (ax, ay) not in obstacle_positions
                if entry_ok and exit_ok and (ex, ey) != (ax, ay):
                    game_map['portals'].append({
                        'entry': {'x': ex, 'y': ey},
                        'exit': {'x': ax, 'y': ay},
                        'color': PORTAL_COLORS[pi % len(PORTAL_COLORS)]['color'],
                    })
                    break

    # 草丛（森林主题）
    if theme.get('grassEnabled'):
        grass_count = max(3, int(size * size * 0.1))
        obstacle_positions = {(o['x'], o['y']) for o in obstacles}
        portal_positions = set()
        for p in game_map['portals']:
            portal_positions.add((p['entry']['x'], p['entry']['y']))
            portal_positions.add((p['exit']['x'], p['exit']['y']))
        all_blocked = forbidden | obstacle_positions | portal_positions
        for _ in range(grass_count * 3):
            if len(game_map['grass']) >= grass_count:
                break
            gx, gy = random.randint(0, size - 1), random.randint(0, size - 1)
            if (gx, gy) not in all_blocked and not any(g['x'] == gx and g['y'] == gy for g in game_map['grass']):
                game_map['grass'].append({'x': gx, 'y': gy})

    # 沙丘（沙漠主题）
    if theme.get('sandDuneEnabled'):
        dune_count = max(2, int(size * size * 0.08))
        obstacle_positions = {(o['x'], o['y']) for o in obstacles}
        all_blocked = forbidden | obstacle_positions
        for _ in range(dune_count * 3):
            if len(game_map['sandDunes']) >= dune_count:
                break
            dx, dy = random.randint(0, size - 1), random.randint(0, size - 1)
            if (dx, dy) not in all_blocked and not any(d['x'] == dx and d['y'] == dy for d in game_map['sandDunes']):
                game_map['sandDunes'].append({'x': dx, 'y': dy})

    return game_map, theme


# ==================== 游戏环境 ====================

class CloakEnv:
    """
    Cloak of Moves 游戏环境 v2
    支持完整的对局流程，用于自我对弈训练

    改进:
    - 共享卡牌池（与真实游戏一致）
    - 冰原寒流概率修正为15%
    - 完善被动技能
    - 奖励塑形
    """

    def __init__(self, map_size=None, theme_id=None,
                 char_id_0=None, char_id_1=None):
        self.map_size = map_size
        self.theme_id = theme_id
        self.char_ids = [char_id_0, char_id_1]

    def reset(self):
        """初始化/重置游戏，返回初始状态"""
        size = self.map_size or random.choice(GAME_CONFIG['MAP_SIZE_OPTIONS'])
        theme_id = self.theme_id or random.choice(THEME_LIST)

        game_map, theme = generate_map(size, theme_id)

        # 初始化玩家状态
        player_states = []
        for i in range(2):
            char_id = self.char_ids[i] if self.char_ids[i] else random.choice(list(CHARACTER_SKILLS.keys()))
            skill = CHARACTER_SKILLS[char_id]
            hp = GAME_CONFIG['INITIAL_HP'] + skill.get('bonusHp', 0)

            pos = {'x': 0, 'y': 0} if i == 0 else {'x': size - 1, 'y': size - 1}

            player_states.append({
                'id': f'player_{i}',
                'position': pos,
                'hp': hp,
                'isDefending': False,
                'isHidden': False,
                'currentCards': [],
                'handCards': [],
                'selectedCards': [],
                'orderConfirmed': False,
                'skill': skill,
                'skillCooldown': 0,
                'skillSelected': False,
            })

        # 先手轮换
        is_player1_priority = random.random() < 0.5

        self.game = {
            'map': game_map,
            'theme': theme,
            'playerStates': player_states,
            'currentRound': 1,
            'isPlayer1Priority': is_player1_priority,
            'frozenThisRound': False,
            'skillSealed': theme_id == 'ruins',
            'phase': 'selecting',
            'winner': None,
            'turnIndex': 0,
        }

        # 发牌：使用共享卡牌池（双方看到相同的牌）
        shared_cards = generate_shared_cards(GAME_CONFIG['CARD_COUNT'])
        for i in range(2):
            # 每个玩家获得相同卡牌的深拷贝
            self.game['playerStates'][i]['currentCards'] = deepcopy(shared_cards)

        return self._get_both_states()

    def _get_both_states(self):
        """获取双方的状态编码"""
        return {
            0: encode_state(self.game, 0),
            1: encode_state(self.game, 1),
        }

    def select_cards(self, player_index, card_indices):
        """玩家选牌"""
        ps = self.game['playerStates'][player_index]
        current = ps['currentCards']
        selected = [current[i] for i in card_indices if i < len(current)]
        ps['handCards'] = selected[:HAND_SIZE]
        return selected

    def order_cards(self, player_index, order):
        """玩家排列手牌顺序"""
        ps = self.game['playerStates'][player_index]
        ps['handCards'] = order

    def execute_round(self, actions_0, actions_1):
        """
        执行一个完整回合

        actions_0/1: dict with keys:
          'select_indices': list of card indices to select
          'card_order': ordered list of cards to play

        Returns: (states, rewards, done, info)
        """
        game = self.game
        ps = game['playerStates']

        # 选牌
        self.select_cards(0, actions_0['select_indices'])
        self.select_cards(1, actions_1['select_indices'])

        # 排序
        self.order_cards(0, actions_0['card_order'])
        self.order_cards(1, actions_1['card_order'])

        # 记录回合开始时的状态（用于奖励塑形）
        hp_before = [ps[0]['hp'], ps[1]['hp']]
        dist_before = self._get_manhattan_distance()

        # 交替出牌
        priority = 0 if game['isPlayer1Priority'] else 1
        normal = 1 - priority

        for turn in range(HAND_SIZE * 2):
            current = priority if turn % 2 == 0 else normal
            card_idx = turn // 2
            if card_idx < len(ps[current]['handCards']):
                card = ps[current]['handCards'][card_idx]
                self._execute_card(current, card)

            # 检查游戏结束
            if self._check_game_end():
                break

        # 回合结束处理
        self._end_round()

        # 计算奖励（含塑形）
        hp_after = [ps[0]['hp'], ps[1]['hp']]
        dist_after = self._get_manhattan_distance()
        rewards = self._compute_rewards(hp_before, hp_after, dist_before, dist_after)

        # 准备下一回合
        game['currentRound'] += 1
        game['isPlayer1Priority'] = not game['isPlayer1Priority']

        # 检查游戏是否结束
        done = game['winner'] is not None

        # 如果未结束，发新牌
        if not done:
            # 共享卡牌池
            shared_cards = generate_shared_cards(GAME_CONFIG['CARD_COUNT'])
            for i in range(2):
                ps[i]['currentCards'] = deepcopy(shared_cards)
                ps[i]['handCards'] = []
                ps[i]['isDefending'] = False
                # 技能冷却递减
                if ps[i].get('skillCooldown', 0) > 0:
                    ps[i]['skillCooldown'] -= 1

        states = self._get_both_states() if not done else None
        info = {'round': game['currentRound'], 'winner': game['winner']}

        return states, rewards, done, info

    def _get_manhattan_distance(self):
        """获取双方曼哈顿距离"""
        ps = self.game['playerStates']
        return abs(ps[0]['position']['x'] - ps[1]['position']['x']) + \
               abs(ps[0]['position']['y'] - ps[1]['position']['y'])

    def _execute_card(self, player_index, card):
        """执行一张卡牌的效果"""
        game = self.game
        ps = game['playerStates']
        me = ps[player_index]

        if card.get('invalidated'):
            return

        card_type = card['type']

        if card_type == 'move':
            self._execute_move(player_index, card['direction'])

        elif card_type == 'attack':
            self._execute_attack(player_index, card['direction'], card.get('range', 1))

        elif card_type == 'defense':
            me['isDefending'] = True

        elif card_type == 'scout':
            pass  # 探查不影响HP，训练中简化处理

        elif card_type == 'skill':
            self._execute_skill(player_index, card)

    def _execute_move(self, player_index, direction):
        """执行移动"""
        game = self.game
        ps = game['playerStates']
        me = ps[player_index]
        opp = ps[1 - player_index]

        offset = DIRECTION_OFFSET.get(direction)
        if not offset:
            return

        new_x = me['position']['x'] + offset['x']
        new_y = me['position']['y'] + offset['y']

        # 边界检查
        if new_x < 0 or new_x >= game['map']['width'] or \
           new_y < 0 or new_y >= game['map']['height']:
            return

        # 障碍物检查
        if any(o['x'] == new_x and o['y'] == new_y and not o.get('isBoundary')
               for o in game['map']['obstacles']):
            return

        # 对手位置检查
        if opp['position']['x'] == new_x and opp['position']['y'] == new_y:
            return

        # 沙丘检查
        if any(d['x'] == new_x and d['y'] == new_y
               for d in game['map'].get('sandDunes', [])):
            return

        me['position'] = {'x': new_x, 'y': new_y}

        # 检查传送门
        for p in game['map'].get('portals', []):
            if p['entry']['x'] == new_x and p['entry']['y'] == new_y:
                me['position'] = {'x': p['exit']['x'], 'y': p['exit']['y']}
                break

        # 检查草丛隐藏
        in_grass = any(g['x'] == me['position']['x'] and g['y'] == me['position']['y']
                       for g in game['map'].get('grass', []))
        me['isHidden'] = in_grass

    def _execute_attack(self, player_index, direction, attack_range=1):
        """执行攻击"""
        game = self.game
        ps = game['playerStates']
        me = ps[player_index]
        opp = ps[1 - player_index]

        offset = DIRECTION_OFFSET.get(direction)
        if not offset:
            return

        for r in range(1, attack_range + 1):
            check_x = me['position']['x'] + offset['x'] * r
            check_y = me['position']['y'] + offset['y'] * r

            # 边界
            if check_x < 0 or check_x >= game['map']['width'] or \
               check_y < 0 or check_y >= game['map']['height']:
                break

            # 障碍物
            is_obstacle = any(o['x'] == check_x and o['y'] == check_y and not o.get('isBoundary')
                             for o in game['map']['obstacles'])

            # 女法师爆裂攻击：摧毁障碍物
            skill = me.get('skill') or {}
            if is_obstacle and skill.get('passiveEffect') == 'explosive_attack':
                game['map']['obstacles'] = [
                    o for o in game['map']['obstacles']
                    if not (o['x'] == check_x and o['y'] == check_y and not o.get('isBoundary'))
                ]
                break

            if is_obstacle:
                break

            # 命中对手
            if opp['position']['x'] == check_x and opp['position']['y'] == check_y:
                if opp.get('isDefending'):
                    opp['isDefending'] = False
                else:
                    opp['hp'] -= 1
                break

    def _execute_skill(self, player_index, card):
        """执行技能卡"""
        game = self.game
        ps = game['playerStates']
        me = ps[player_index]
        skill = me.get('skill') or {}

        if skill.get('skillType') != 'active':
            return
        if me.get('skillCooldown', 0) > 0:
            return

        skill_id = skill.get('id', '')

        if skill_id == 'mage_male':
            # 天降陨石：随机格子造成伤害
            m = max(1, int(math.ceil(math.sqrt(game['map']['width'] * game['map']['height']) / 2)))
            for _ in range(m):
                tx = random.randint(0, game['map']['width'] - 1)
                ty = random.randint(0, game['map']['height'] - 1)
                for i in range(2):
                    if ps[i]['position']['x'] == tx and ps[i]['position']['y'] == ty:
                        if ps[i].get('isDefending'):
                            ps[i]['isDefending'] = False
                        else:
                            ps[i]['hp'] -= 1
            me['skillCooldown'] = skill.get('cooldown', 3)

        elif skill_id == 'knight_male':
            # 旋风斩：周围8格伤害
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    ax = me['position']['x'] + dx
                    ay = me['position']['y'] + dy
                    for i in range(2):
                        if i == player_index:
                            continue  # 旋风斩不伤害自己
                        if ps[i]['position']['x'] == ax and ps[i]['position']['y'] == ay:
                            if ps[i].get('isDefending'):
                                ps[i]['isDefending'] = False
                            else:
                                ps[i]['hp'] -= 1
            me['skillCooldown'] = skill.get('cooldown', 3)

        elif skill_id == 'archer_male':
            # 百步穿杨：四方向穿透箭
            for d in DIRECTIONS:
                offset = DIRECTION_OFFSET[d]
                for r in range(1, max(game['map']['width'], game['map']['height'])):
                    cx = me['position']['x'] + offset['x'] * r
                    cy = me['position']['y'] + offset['y'] * r
                    if cx < 0 or cx >= game['map']['width'] or cy < 0 or cy >= game['map']['height']:
                        break
                    if any(o['x'] == cx and o['y'] == cy and not o.get('isBoundary')
                           for o in game['map']['obstacles']):
                        break
                    opp = ps[1 - player_index]
                    if opp['position']['x'] == cx and opp['position']['y'] == cy:
                        if opp.get('isDefending'):
                            opp['isDefending'] = False
                        else:
                            opp['hp'] -= 1
                        break
            me['skillCooldown'] = skill.get('cooldown', 5)

        elif skill_id == 'thief_male':
            # 盗为己用：使对手第一张牌失效
            opp = ps[1 - player_index]
            if opp.get('handCards') and len(opp['handCards']) > 0:
                opp['handCards'][0]['invalidated'] = True
            me['skillCooldown'] = skill.get('cooldown', 4)

        elif skill_id == 'reader_male':
            # 回忆过去：额外获得信息优势（训练中简化处理为技能冷却设置）
            me['skillCooldown'] = skill.get('cooldown', 5)

    def _check_game_end(self):
        """检查游戏是否结束"""
        ps = self.game['playerStates']
        if ps[0]['hp'] <= 0 and ps[1]['hp'] <= 0:
            self.game['winner'] = 'draw'
            return True
        elif ps[0]['hp'] <= 0:
            self.game['winner'] = 1
            return True
        elif ps[1]['hp'] <= 0:
            self.game['winner'] = 0
            return True
        return False

    def _end_round(self):
        """回合结束处理"""
        ps = self.game['playerStates']

        # 重置防御状态
        for i in range(2):
            ps[i]['isDefending'] = False

        # 被动技能处理
        for i in range(2):
            skill = ps[i].get('skill') or {}
            if skill.get('skillType') == 'passive':
                self._process_passive(i, skill)

        # 主题特效
        theme_id = self.game['theme'].get('id', '')

        # 冰原寒流：15%概率（修正：原来是100%）
        if theme_id == 'ice':
            frostbite_chance = self.game['theme'].get('frostbiteChance', 0.15)
            if random.random() < frostbite_chance:
                self._ice_frostbite()

        # 沙漠沙丘移动
        if self.game['theme'].get('sandDuneEnabled') and self.game['map'].get('sandDunes'):
            self._move_sand_dunes()

        # 火山火球
        if theme_id == 'volcano':
            fireball_chance = self.game['theme'].get('fireballChance', 0.2)
            if random.random() < fireball_chance:
                self._volcano_fireball()

    def _process_passive(self, player_index, skill):
        """处理被动技能"""
        ps = self.game['playerStates']
        me = ps[player_index]
        opp = ps[1 - player_index]
        effect = skill.get('passiveEffect')

        if effect == 'arrow_rain':
            # 天降箭雨：随机一格攻击
            tx = random.randint(0, self.game['map']['width'] - 1)
            ty = random.randint(0, self.game['map']['height'] - 1)
            # 只攻击对手，不攻击自己
            if opp['position']['x'] == tx and opp['position']['y'] == ty:
                if opp.get('isDefending'):
                    opp['isDefending'] = False
                else:
                    opp['hp'] -= 1

        elif effect == 'tough_thrust':
            # 坚韧突刺：近战攻击时额外伤害（在attack中处理，此处为回合结束的加成检查）
            pass

        elif effect == 'explosive_attack':
            # 爆裂攻击：在attack中处理
            pass

        elif effect == 'deep_seeker':
            # 深度求索：额外信息（训练中简化）
            pass

        elif effect == 'wall_has_eyes':
            # 隔墙有眼：额外视野（训练中简化）
            pass

    def _ice_frostbite(self):
        """冰原寒流：随机对一个玩家造成1点伤害"""
        ps = self.game['playerStates']
        target = random.randint(0, 1)
        if ps[target].get('isDefending'):
            ps[target]['isDefending'] = False
        else:
            ps[target]['hp'] -= 1

    def _move_sand_dunes(self):
        """移动沙丘"""
        dunes = self.game['map'].get('sandDunes', [])
        if not dunes:
            return
        if random.random() < 0.3 and dunes:
            d = random.choice(dunes)
            dx = random.choice([-1, 0, 1])
            dy = random.choice([-1, 0, 1])
            new_x = d['x'] + dx
            new_y = d['y'] + dy
            if 0 <= new_x < self.game['map']['width'] and 0 <= new_y < self.game['map']['height']:
                blocked = (any(o['x'] == new_x and o['y'] == new_y for o in self.game['map']['obstacles']) or
                          any(self.game['playerStates'][i]['position']['x'] == new_x and
                              self.game['playerStates'][i]['position']['y'] == new_y for i in range(2)))
                if not blocked:
                    d['x'] = new_x
                    d['y'] = new_y

    def _volcano_fireball(self):
        """火山火球：从边缘发射直线火球"""
        direction = random.choice(DIRECTIONS)
        offset = DIRECTION_OFFSET[direction]
        # 从边缘发射
        if direction == 'up':
            sx, sy = random.randint(0, self.game['map']['width'] - 1), self.game['map']['height'] - 1
        elif direction == 'down':
            sx, sy = random.randint(0, self.game['map']['width'] - 1), 0
        elif direction == 'left':
            sx, sy = self.game['map']['width'] - 1, random.randint(0, self.game['map']['height'] - 1)
        else:
            sx, sy = 0, random.randint(0, self.game['map']['height'] - 1)

        for r in range(max(self.game['map']['width'], self.game['map']['height'])):
            fx = sx + offset['x'] * r
            fy = sy + offset['y'] * r
            if fx < 0 or fx >= self.game['map']['width'] or fy < 0 or fy >= self.game['map']['height']:
                break
            for i in range(2):
                if self.game['playerStates'][i]['position']['x'] == fx and \
                   self.game['playerStates'][i]['position']['y'] == fy:
                    if self.game['playerStates'][i].get('isDefending'):
                        self.game['playerStates'][i]['isDefending'] = False
                    else:
                        self.game['playerStates'][i]['hp'] -= 1

    def _compute_rewards(self, hp_before, hp_after, dist_before, dist_after):
        """
        计算双方奖励（v3增强塑形）

        奖励组成:
        1. 伤害/承伤奖励（主要信号，加大权重）
        2. 位置优势奖励（有利攻击位/不利被攻位）
        3. 接近对手奖励（鼓励主动进攻）
        4. HP优势奖励（持续奖励领先方）
        5. 胜负奖励（终极信号，大幅增强）
        """
        rewards = [0.0, 0.0]
        ps = self.game['playerStates']

        for i in range(2):
            opp_i = 1 - i
            damage_dealt = hp_before[opp_i] - hp_after[opp_i]
            damage_taken = hp_before[i] - hp_after[i]

            # 1. 伤害奖励（加大权重）
            rewards[i] += damage_dealt * 0.8   # 造成伤害（0.5 → 0.8）
            rewards[i] -= damage_taken * 0.8    # 承受伤害（0.5 → 0.8）

            # 2. 位置优势奖励
            can_hit_opp = any(_can_attack_hit(self.game, i, d) for d in DIRECTIONS)
            opp_can_hit = any(_can_attack_hit(self.game, opp_i, d) for d in DIRECTIONS)
            if can_hit_opp and not opp_can_hit:
                rewards[i] += 0.3   # 处于有利攻击位
            elif opp_can_hit and not can_hit_opp:
                rewards[i] -= 0.3   # 处于不利被攻位

            # 3. 接近对手奖励（鼓励主动进攻而非消极躲避）
            dist_change = dist_before - dist_after  # 正值=接近对手
            if damage_dealt > 0:
                rewards[i] += dist_change * 0.08
            elif dist_change > 0:
                rewards[i] += 0.03  # 主动接近

            # 4. HP优势奖励（持续奖励领先方）
            hp_advantage = (ps[i]['hp'] - ps[opp_i]['hp']) * 0.15
            rewards[i] += hp_advantage

        # 5. 胜负奖励（大幅增强）
        if self.game['winner'] is not None:
            if self.game['winner'] == 'draw':
                rewards[0] -= 0.5
                rewards[1] -= 0.5
            else:
                rewards[self.game['winner']] += 5.0     # 赢家（2.0 → 5.0）
                rewards[1 - self.game['winner']] -= 5.0  # 输家

        return rewards

    def get_valid_card_indices(self, player_index):
        """获取可选的卡牌索引"""
        cards = self.game['playerStates'][player_index].get('currentCards', [])
        return list(range(len(cards)))

    def get_action_mask(self, player_index):
        """获取选牌动作mask（1=可选，0=不可选）"""
        n = len(self.game['playerStates'][player_index].get('currentCards', []))
        mask = np.zeros(MAX_CARDS, dtype=np.float32)
        mask[:n] = 1.0
        return mask


# ==================== 规则AI（用于行为克隆数据采集） ====================

class RuleBasedAI:
    """规则AI：启发式选牌和排序（v2 - 增强版）"""

    def __init__(self, player_index, difficulty='hard'):
        self.player_index = player_index
        self.difficulty = difficulty

    def select_cards(self, game):
        """选牌策略"""
        ps = game['playerStates'][self.player_index]
        opp = game['playerStates'][1 - self.player_index]
        current_cards = ps.get('currentCards', [])

        if len(current_cards) <= HAND_SIZE:
            return list(range(len(current_cards)))

        distance = self._get_distance(ps, opp)
        my_hp = ps['hp']

        card_values = []
        for i, card in enumerate(current_cards):
            value = self._evaluate_card(card, distance, my_hp, game)
            value += random.random() * 0.5  # 小随机性
            card_values.append((i, value))

        card_values.sort(key=lambda x: x[1], reverse=True)
        return [cv[0] for cv in card_values[:HAND_SIZE]]

    def order_cards(self, game, hand_cards):
        """排序策略"""
        ps = game['playerStates'][self.player_index]
        opp = game['playerStates'][1 - self.player_index]
        distance = self._get_distance(ps, opp)
        my_hp = ps['hp']

        card_priorities = []
        for i, card in enumerate(hand_cards):
            priority = self._evaluate_card(card, distance, my_hp, game)
            if card['type'] == 'defense' and my_hp <= 2:
                priority += 3
            priority += random.random() * 0.3
            card_priorities.append((i, priority))

        card_priorities.sort(key=lambda x: x[1], reverse=True)
        return [hand_cards[cp[0]] for cp in card_priorities]

    def _evaluate_card(self, card, distance, my_hp, game):
        """评估卡牌价值"""
        value = 0
        if card.get('isSkillCard'):
            value = 8 if not game.get('skillSealed') else 0
        elif card['type'] == 'attack':
            can_hit = self._can_attack_hit(card, game)
            value = (9 if distance <= 2 else 4) if can_hit else (3 if distance <= 3 else 1)
        elif card['type'] == 'defense':
            value = 8 if my_hp <= 3 else 5
        elif card['type'] == 'move':
            value = 7 if distance > 2 else 3
        elif card['type'] == 'scout':
            value = 6 if distance > 2 else 4
        return value

    def _get_distance(self, ps, opp):
        return abs(ps['position']['x'] - opp['position']['x']) + \
               abs(ps['position']['y'] - opp['position']['y'])

    def _can_attack_hit(self, card, game):
        """检查攻击能否命中对手"""
        ps = game['playerStates'][self.player_index]
        opp = game['playerStates'][1 - self.player_index]
        direction = card.get('direction')
        attack_range = card.get('range', 1)

        if not direction:
            return False

        offset = DIRECTION_OFFSET.get(direction)
        if not offset:
            return False

        for r in range(1, attack_range + 1):
            check_x = ps['position']['x'] + offset['x'] * r
            check_y = ps['position']['y'] + offset['y'] * r
            if check_x < 0 or check_x >= game['map']['width'] or \
               check_y < 0 or check_y >= game['map']['height']:
                break
            if any(o['x'] == check_x and o['y'] == check_y and not o.get('isBoundary')
                   for o in game['map']['obstacles']):
                break
            if opp['position']['x'] == check_x and opp['position']['y'] == check_y:
                return True
        return False


# ==================== 自我对弈 ====================

def self_play_episode(env, ai_0=None, ai_1=None):
    """
    执行一局自我对弈，收集训练数据

    Args:
        env: CloakEnv实例
        ai_0, ai_1: RuleBasedAI实例（如果为None则创建）

    Returns:
        episode_data: {0: [step, ...], 1: [step, ...]}
    """
    if ai_0 is None:
        ai_0 = RuleBasedAI(0)
    if ai_1 is None:
        ai_1 = RuleBasedAI(1)

    states = env.reset()
    done = False
    episode_data = {0: [], 1: []}

    while not done and env.game['currentRound'] <= 50:
        game = env.game
        ps = game['playerStates']

        # 为两个玩家做决策
        for pi in range(2):
            ai = ai_0 if pi == 0 else ai_1
            current_cards = ps[pi].get('currentCards', [])

            # 选牌
            selected_indices = ai.select_cards(game)
            hand_cards = [current_cards[i] for i in selected_indices if i < len(current_cards)]

            # 排序
            ordered_cards = ai.order_cards(game, hand_cards)

            # 记录数据
            episode_data[pi].append({
                'state': states[pi],
                'selected_indices': selected_indices,
                'hand_cards': ordered_cards,
            })

        # 执行回合
        actions_0 = {
            'select_indices': episode_data[0][-1]['selected_indices'],
            'card_order': episode_data[0][-1]['hand_cards'],
        }
        actions_1 = {
            'select_indices': episode_data[1][-1]['selected_indices'],
            'card_order': episode_data[1][-1]['hand_cards'],
        }

        states, rewards, done, info = env.execute_round(actions_0, actions_1)

    return episode_data