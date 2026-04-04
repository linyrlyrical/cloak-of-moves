// 游戏常量配置
export const GAME_CONFIG = {
  MAP_SIZE: 7,                    // 地图尺寸 N×N (默认值)
  // 地图选项：数字表示正方形N×N，字符串'1xN'表示单行横向地图
  MAP_SIZE_OPTIONS: [5, 6, 7, 8, '1x5', '1x7', '1x10'],
  OBSTACLE_COUNT: 8,              // 障碍数量 (已废弃，改为动态计算)
  CARDS_PER_ROUND: 6,             // 每回合发放卡牌数
  HAND_SIZE: 3,                  // 手牌数量
  SELECT_TIME: 30000,             // 卡牌选择时限(ms) - 30秒
  ORDER_TIME: 30000,              // 顺序调整时限(ms) - 30秒
  INITIAL_HP: 1,                  // 初始血量
  SERVER_PORT: 3000,              // 服务器端口
  CLIENT_PORT: 5173               // 客户端端口
};

// 卡牌类型定义
export const CARD_TYPES = {
  // 移动牌 (4种)
  MOVE_UP: { type: 'move', direction: 'up', range: 1, name: '向上移动', icon: '↑' },
  MOVE_RIGHT: { type: 'move', direction: 'right', range: 1, name: '向右移动', icon: '→' },
  MOVE_DOWN: { type: 'move', direction: 'down', range: 1, name: '向下移动', icon: '↓' },
  MOVE_LEFT: { type: 'move', direction: 'left', range: 1, name: '向左移动', icon: '←' },
  
  // 一格攻击牌 (4种)
  ATTACK_UP_1: { type: 'attack', direction: 'up', range: 1, name: '向上攻击(1格)', icon: '⚔↑' },
  ATTACK_RIGHT_1: { type: 'attack', direction: 'right', range: 1, name: '向右攻击(1格)', icon: '⚔→' },
  ATTACK_DOWN_1: { type: 'attack', direction: 'down', range: 1, name: '向下攻击(1格)', icon: '⚔↓' },
  ATTACK_LEFT_1: { type: 'attack', direction: 'left', range: 1, name: '向左攻击(1格)', icon: '⚔←' },
  
  // 两格攻击牌 (4种)
  ATTACK_UP_2: { type: 'attack', direction: 'up', range: 2, name: '向上攻击(2格)', icon: '⚔↑2' },
  ATTACK_RIGHT_2: { type: 'attack', direction: 'right', range: 2, name: '向右攻击(2格)', icon: '⚔→2' },
  ATTACK_DOWN_2: { type: 'attack', direction: 'down', range: 2, name: '向下攻击(2格)', icon: '⚔↓2' },
  ATTACK_LEFT_2: { type: 'attack', direction: 'left', range: 2, name: '向左攻击(2格)', icon: '⚔←2' },
  
  // 防御牌 (1种)
  DEFENSE: { type: 'defense', name: '防御', icon: '🛡' },
  
  // 探查牌 (3种)
  SCOUT_ROW: { type: 'scout', scoutType: 'row', name: '行探查', icon: '👁↔' },
  SCOUT_COL: { type: 'scout', scoutType: 'col', name: '列探查', icon: '👁↕' },
  SCOUT_AROUND: { type: 'scout', scoutType: 'around', name: '环绕探查', icon: '👁' }
};

// 所有卡牌类型列表（用于随机抽取）
export const ALL_CARD_TYPES = Object.keys(CARD_TYPES);

// 游戏阶段
export const GAME_PHASES = {
  WAITING: 'waiting',           // 等待玩家
  CONFIGURING: 'configuring',   // 地图配置阶段（房主选择地图大小）
  DEALING: 'dealing',           // 发牌阶段
  SELECTING_PRIORITY: 'selecting_priority', // 优先玩家选择卡牌
  SELECTING_NORMAL: 'selecting_normal',     // 非优先玩家选择卡牌
  ORDERING_PRIORITY: 'ordering_priority', // 优先玩家调整顺序
  ORDERING_NORMAL: 'ordering_normal',     // 非优先玩家调整顺序
  PLAYING: 'playing',           // 交替出牌阶段
  ROUND_END: 'round_end',       // 回合结束
  GAME_END: 'game_end'          // 游戏结束
};

// 移动方向偏移
export const DIRECTION_OFFSET = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

// 地图主题配置
export const MAP_THEMES = {
  forest: {
    id: 'forest',
    name: '森林',
    nameCn: '🌲 森林',
    background: 'linear-gradient(135deg, #1a3d2e 0%, #2d5a3f 40%, #1e4d2f 100%)',
    screenBg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
    cellBg: 'rgba(34, 85, 51, 0.4)',
    cellBorder: 'rgba(45, 90, 63, 0.6)',
    obstacleTypes: ['tree', 'rock'],
    decorations: {
      particles: 'leaves',
      ambient: 'light-spots'
    },
    playerColors: {
      player1: '#4ade80',
      player2: '#f87171'
    }
  },
  desert: {
    id: 'desert',
    name: '沙漠',
    nameCn: '🏜️ 沙漠',
    background: 'linear-gradient(135deg, #8b6914 0%, #c2956e 40%, #d4a574 100%)',
    screenBg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 50%, #ffe082 100%)',
    cellBg: 'rgba(210, 180, 140, 0.35)',
    cellBorder: 'rgba(194, 149, 110, 0.5)',
    obstacleTypes: ['cactus', 'sand'],
    decorations: {
      particles: 'sand',
      ambient: 'heat-wave'
    },
    playerColors: {
      player1: '#fbbf24',
      player2: '#60a5fa'
    }
  },
  ice: {
    id: 'ice',
    name: '冰原',
    nameCn: '❄️ 冰原',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a7b 40%, #4a7c9b 100%)',
    screenBg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
    cellBg: 'rgba(147, 197, 253, 0.25)',
    cellBorder: 'rgba(147, 197, 253, 0.4)',
    obstacleTypes: ['ice', 'snow'],
    decorations: {
      particles: 'snow',
      ambient: 'ice-mist'
    },
    playerColors: {
      player1: '#67e8f9',
      player2: '#fb7185'
    }
  },
  volcano: {
    id: 'volcano',
    name: '火山',
    nameCn: '🌋 火山',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 40%, #5c2020 100%)',
    screenBg: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 50%, #ef9a9a 100%)',
    cellBg: 'rgba(80, 30, 30, 0.5)',
    cellBorder: 'rgba(100, 40, 40, 0.6)',
    obstacleTypes: ['lava', 'rock'],
    decorations: {
      particles: 'embers',
      ambient: 'smoke'
    },
    playerColors: {
      player1: '#f97316',
      player2: '#a78bfa'
    }
  },
  ruins: {
    id: 'ruins',
    name: '古城',
    nameCn: '🏛️ 古城',
    background: 'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 40%, #3d3d3d 100%)',
    screenBg: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 50%, #e0e0e0 100%)',
    cellBg: 'rgba(80, 70, 60, 0.4)',
    cellBorder: 'rgba(100, 90, 80, 0.5)',
    obstacleTypes: ['wall', 'bone'],
    decorations: {
      particles: 'dust',
      ambient: 'vines'
    },
    playerColors: {
      player1: '#fcd34d',
      player2: '#818cf8'
    }
  }
};

// 主题列表（用于随机选择）
export const THEME_LIST = Object.keys(MAP_THEMES);

// 传送门颜色配置
export const PORTAL_COLORS = {
  red: { id: 'red', name: '红色', color: '#ef4444', glowColor: 'rgba(239, 68, 68, 0.6)', icon: '🔴' },
  yellow: { id: 'yellow', name: '黄色', color: '#eab308', glowColor: 'rgba(234, 179, 8, 0.6)', icon: '🟡' },
  blue: { id: 'blue', name: '蓝色', color: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.6)', icon: '🔵' }
};

// 传送门颜色列表（用于随机选择）
export const PORTAL_COLOR_LIST = Object.keys(PORTAL_COLORS);