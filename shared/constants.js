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
  FOG_ENABLED_DEFAULT: false,     // 迷雾效果默认关闭
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
    icon: '🌲',
    nameCn: '🌲 森林',
    // 主题名称渐变色
    nameColor: 'linear-gradient(135deg, #15803d, #22c55e)',
    // 棋盘背景渐变（深色）
    background: 'linear-gradient(135deg, #1a3d2e 0%, #2d5a3f 40%, #1e4d2f 100%)',
    // 全屏柔和背景色（浅色）
    screenBg: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
    // 格子背景
    cellBg: 'rgba(34, 85, 51, 0.4)',
    cellBorder: 'rgba(45, 90, 63, 0.6)',
    // 障碍物类型（与GameBoard.vue中的形状映射一致）
    obstacleTypes: ['tree', 'rock'],
    // 装饰元素
    decorations: {
      particles: 'leaves',
      ambient: 'light-spots'
    },
    // 粒子样式配置
    particleStyle: {
      shape: 'leaf',
      colors: ['#15803d', '#166534', '#14532d', '#0d4f2c', '#1a5e3a'], // 深绿色系，在浅绿背景上对比度高
      sizeMin: 20,
      sizeMax: 60,
      count: 70,
      speedMin: 15,
      speedMax: 25,
      opacityMin: 0.5,
      opacityMax: 0.8
    },
    // 玩家颜色
    playerColors: {
      player1: '#4ade80',
      player2: '#f87171'
    },
    // 森林特色：草丛配置
    grassEnabled: true,
    grassStyle: {
      color: 'rgba(34, 139, 34, 0.6)',
      borderColor: 'rgba(46, 125, 50, 0.8)',
      icon: '🌿'
    }
  },
  desert: {
    id: 'desert',
    name: '沙漠',
    icon: '🏜️',
    nameCn: '🏜️ 沙漠',
    // 主题名称渐变色
    nameColor: 'linear-gradient(135deg, #b45309, #d97706)',
    background: 'linear-gradient(135deg, #8b6914 0%, #c2956e 40%, #d4a574 100%)',
    // 全屏柔和背景色（浅黄色）
    screenBg: 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 50%, #ffe082 100%)',
    cellBg: 'rgba(210, 180, 140, 0.35)',
    cellBorder: 'rgba(194, 149, 110, 0.5)',
    obstacleTypes: ['cactus', 'sand'],
    decorations: {
      particles: 'sand',
      ambient: 'heat-wave'
    },
    // 粒子样式配置
    particleStyle: {
      shape: 'sand',
      colors: ['#92400e', '#78350f', '#a16207', '#854d0e', '#713f12'], // 深褐色系，在浅黄背景上对比度高
      sizeMin: 8,
      sizeMax: 35,
      count: 110,
      speedMin: 18,
      speedMax: 30,
      opacityMin: 0.4,
      opacityMax: 0.6
    },
    playerColors: {
      player1: '#fbbf24',
      player2: '#60a5fa'
    },
    // 沙漠特色：启用可移动沙丘生成
    sandDuneEnabled: true,
    sandDuneStyle: {
      color: 'rgba(210, 180, 140, 0.6)',
      borderColor: 'rgba(194, 149, 110, 0.7)',
      icon: '🏜️'
    }
  },
  ice: {
    id: 'ice',
    name: '冰原',
    icon: '❄️',
    nameCn: '❄️ 冰原',
    // 主题名称渐变色
    nameColor: 'linear-gradient(135deg, #0369a1, #0ea5e9)',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a7b 40%, #4a7c9b 100%)',
    // 全屏柔和背景色（浅蓝色）
    screenBg: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
    cellBg: 'rgba(147, 197, 253, 0.25)',
    cellBorder: 'rgba(147, 197, 253, 0.4)',
    obstacleTypes: ['ice', 'snow'],
    decorations: {
      particles: 'snow',
      ambient: 'ice-mist'
    },
    // 粒子样式配置
    particleStyle: {
      shape: 'snow',
      colors: ['#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e'], // 深蓝色系，在浅蓝背景上对比度高
      sizeMin: 18,
      sizeMax: 55,
      count: 100,
      speedMin: 12,
      speedMax: 22,
      opacityMin: 0.6,
      opacityMax: 0.9
    },
    playerColors: {
      player1: '#67e8f9',
      player2: '#fb7185'
    }
  },
  volcano: {
    id: 'volcano',
    name: '火山',
    icon: '🌋',
    nameCn: '🌋 火山',
    // 主题名称渐变色
    nameColor: 'linear-gradient(135deg, #991b1b, #dc2626)',
    background: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 40%, #5c2020 100%)',
    // 全屏柔和背景色（浅红/粉色）
    screenBg: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 50%, #ef9a9a 100%)',
    cellBg: 'rgba(80, 30, 30, 0.5)',
    cellBorder: 'rgba(100, 40, 40, 0.6)',
    obstacleTypes: ['lava', 'rock'],
    decorations: {
      particles: 'embers',
      ambient: 'smoke'
    },
    // 粒子样式配置
    particleStyle: {
      shape: 'ember',
      colors: ['#991b1b', '#7f1d1d', '#b91c1c', '#c2410c', '#9a3412'], // 深红/暗橙色系，在浅红背景上对比度高
      sizeMin: 10,
      sizeMax: 40,
      count: 90,
      speedMin: 15,
      speedMax: 28,
      opacityMin: 0.6,
      opacityMax: 0.9
    },
    playerColors: {
      player1: '#f97316',
      player2: '#a78bfa'
    }
  },
  ruins: {
    id: 'ruins',
    name: '古城',
    icon: '🏛️',
    nameCn: '🏛️ 古城',
    // 主题名称渐变色
    nameColor: 'linear-gradient(135deg, #78716c, #a8a29e)',
    background: 'linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 40%, #3d3d3d 100%)',
    // 全屏柔和背景色（浅灰色）
    screenBg: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 50%, #e0e0e0 100%)',
    cellBg: 'rgba(80, 70, 60, 0.4)',
    cellBorder: 'rgba(100, 90, 80, 0.5)',
    obstacleTypes: ['wall', 'bone'],
    decorations: {
      particles: 'dust',
      ambient: 'vines'
    },
    // 粒子样式配置
    particleStyle: {
      shape: 'dust',
      colors: ['#78350f', '#713f12', '#92400e', '#5c3d2e', '#4a3728'], // 深褐色系，在浅灰背景上对比度高
      sizeMin: 8,
      sizeMax: 30,
      count: 130,
      speedMin: 20,
      speedMax: 35,
      opacityMin: 0.4,
      opacityMax: 0.7
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

// ==================== 特色地形布局 ====================
// 每个主题的特色地形布局，1=可用格子，0=不可用格子
// 玩家起始位置固定

export const THEME_SHAPE_LAYOUTS = {
  volcano: {
    name: '火山形',
    icon: '🌋',
    layout: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1],
    ],
    player1Start: { x: 5, y: 0 },
    player2Start: { x: 5, y: 9 },
  },
  
  forest: {
    name: '树木形',
    icon: '🌲',
    layout: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
    ],
    player1Start: { x: 5, y: 0 },
    player2Start: { x: 5, y: 10 },
  },
  
  desert: {
    name: '沙丘形',
    icon: '🏜️',
    layout: [
      [0,0,0,0,0,1,1,1,1,1,1],
      [0,0,0,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,0,0,0,0,0],
      [1,1,1,1,0,0,0,0,0,0,0],
      [1,1,1,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0],
    ],
    player1Start: { x: 10, y: 0 },
    player2Start: { x: 0, y: 5 },
  },
  
  ice: {
    name: '菱形',
    icon: '❄️',
    layout: [
      [0,0,0,0,0,1,0,0,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,1,0,0,0,0],
      [0,0,0,0,0,1,0,0,0,0,0],
    ],
    player1Start: { x: 5, y: 0 },
    player2Start: { x: 5, y: 10 },
  },
  
  ruins: {
    name: '城堡形',
    icon: '🏛️',
    layout: [
      [0,0,1,1,1,0,1,1,1,0,0],
      [0,0,1,1,1,0,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [0,0,1,1,1,1,1,1,1,0,0],
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,0,0,0,0,0,1,1,1],
      [1,1,1,0,0,0,0,0,1,1,1],
      [1,1,1,0,0,0,0,0,1,1,1],
    ],
    player1Start: { x: 2, y: 5 },
    player2Start: { x: 8, y: 5 },
  },
};

// 获取特色地形的尺寸
export function getThemeShapeDimensions(layout) {
  if (!layout || !layout.length) return { width: 0, height: 0 };
  return {
    width: layout[0].length,
    height: layout.length
  };
}

// 计算特色地形中的可用格子数量
export function countThemeShapeCells(layout) {
  if (!layout) return 0;
  let count = 0;
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (layout[row][col] === 1) count++;
    }
  }
  return count;
}

// ==================== 地图随机事件配置 ====================

export const MAP_EVENTS = {
  forest: {
    id: 'forest',
    name: '草丛隐藏',
    icon: '🌿',
    description: '角色进入草丛后隐藏身形，对手无法看到你的位置',
    trigger: 'passive'  // 被动触发
  },
  desert: {
    id: 'desert',
    name: '流沙迁徙',
    icon: '🏜️',
    description: '沙丘每回合结束后随机移动位置',
    trigger: 'active',
    effect: 'moveSandDunes'
  },
  ice: {
    id: 'ice',
    name: '寒流冰冻',
    icon: '🧊',
    description: '出牌阶段开始时，20%概率触发寒流，本回合所有牌效果无效',
    trigger: 'chance',  // 概率触发
    chance: 0.20
  },
  volcano: {
    id: 'volcano',
    name: '火球坠落',
    icon: '☄️',
    description: '出牌阶段开始时，随机火球坠落攻击地图上的格子',
    trigger: 'active'  // 主动触发
  },
  ruins: {
    id: 'ruins',
    name: '技能封印',
    icon: '🔒',
    description: '古城中，双方玩家的所有角色技能均无法生效',
    trigger: 'passive'
  }
};

// ==================== 角色技能配置 ====================

// 角色技能定义（5个职业 × 2个性别 = 10个角色）
export const CHARACTER_SKILLS = {
  // ========== 法师 ==========
  mage_male: {
    id: 'mage_male',
    name: '男法师',
    profession: '法师',
    gender: 'male',
    skillName: '天降陨石',
    skillIcon: '☄️',
    skillType: 'active',        // 主动技能
    cooldown: 3,                // 冷却回合数
    description: '对地图内随机m个格子造成攻击伤害，摧毁命中的障碍物或传送门（m=向上取整(地图面积开根号÷2)）',
    passiveEffect: null
  },
  mage_female: {
    id: 'mage_female',
    name: '女法师',
    profession: '法师',
    gender: 'female',
    skillName: '爆裂攻击',
    skillIcon: '💥',
    skillType: 'passive',       // 被动技能
    cooldown: 0,
    description: '使用攻击牌时，若命中障碍物或传送门，直接摧毁目标',
    passiveEffect: 'explosive_attack'  // 被动效果标识
  },
  
  // ========== 骑士 ==========
  knight_male: {
    id: 'knight_male',
    name: '男骑士',
    profession: '骑士',
    gender: 'male',
    skillName: '旋风斩',
    skillIcon: '🌀',
    skillType: 'active',
    cooldown: 3,
    description: '对自身周围8个格子（环形环绕）造成范围伤害',
    passiveEffect: null
  },
  knight_female: {
    id: 'knight_female',
    name: '女骑士',
    profession: '骑士',
    gender: 'female',
    skillName: '坚韧突刺',
    skillIcon: '🗡️',
    skillType: 'passive',
    cooldown: 0,
    description: '攻击范围+1，初始血量+1',
    passiveEffect: 'tough_thrust',  // 攻击范围+1
    bonusHp: 1                      // 初始血量加成
  },
  
  // ========== 阅读者 ==========
  reader_male: {
    id: 'reader_male',
    name: '男阅读者',
    profession: '阅读者',
    gender: 'male',
    skillName: '回忆过去',
    skillIcon: '📖',
    skillType: 'active',
    cooldown: 5,
    description: '探查该角色历史视野覆盖过的所有格子',
    passiveEffect: null,
    isScoutSkill: true         // 标记为探查类技能
  },
  reader_female: {
    id: 'reader_female',
    name: '女阅读者',
    profession: '阅读者',
    gender: 'female',
    skillName: '深度求索',
    skillIcon: '🔍',
    skillType: 'passive',
    cooldown: 0,
    description: '常驻光圈探查效果，打出环绕探查牌时范围+1',
    passiveEffect: 'deep_seeker',  // 环绕探查范围+1
    hasPassiveScout: true           // 是否有常驻探查
  },
  
  // ========== 盗贼 ==========
  thief_male: {
    id: 'thief_male',
    name: '男盗贼',
    profession: '盗贼',
    gender: 'male',
    skillName: '盗为己用',
    skillIcon: '🃏',
    skillType: 'active',
    cooldown: 4,
    description: '复制对手第一张牌的效果，同时对手的第一张牌打出时不生效',
    passiveEffect: null,
    copyOpponentFirstCard: true     // 复制对手第一张牌
  },
  thief_female: {
    id: 'thief_female',
    name: '女盗贼',
    profession: '盗贼',
    gender: 'female',
    skillName: '隔墙有眼',
    skillIcon: '👁️',
    skillType: 'passive',
    cooldown: 0,
    description: '每2个后手回合自动查看对手的第一张和最后一张手牌',
    passiveEffect: 'wall_has_eyes',  // 隔墙有眼
    viewInterval: 2                    // 每2次后手回合触发
  },
  
  // ========== 弓箭手 ==========
  archer_male: {
    id: 'archer_male',
    name: '男弓箭手',
    profession: '弓箭手',
    gender: 'male',
    skillName: '百步穿杨',
    skillIcon: '🏹',
    skillType: 'active',
    cooldown: 5,
    description: '向上、下、左、右四个方向发射穿透弓箭，直至被障碍物阻挡',
    passiveEffect: null
  },
  archer_female: {
    id: 'archer_female',
    name: '女弓箭手',
    profession: '弓箭手',
    gender: 'female',
    skillName: '天降箭雨',
    skillIcon: '🎯',
    skillType: 'passive',
    cooldown: 0,
    description: '每回合开始时，随机在地图1个格子落下箭雨造成攻击伤害',
    passiveEffect: 'arrow_rain'  // 天降箭雨
  }
};

// 职业列表
export const PROFESSIONS = ['mage', 'knight', 'reader', 'thief', 'archer'];

// 职业名称映射
export const PROFESSION_NAMES = {
  mage: '法师',
  knight: '骑士',
  reader: '阅读者',
  thief: '盗贼',
  archer: '弓箭手'
};

// 根据职业和性别获取角色ID
export function getCharacterId(profession, gender) {
  return `${profession}_${gender}`;
}

// 根据ID获取角色技能配置
export function getCharacterSkillById(id) {
  return CHARACTER_SKILLS[id] || null;
}

// 获取所有男性角色（主动技能）
export function getMaleCharacters() {
  return Object.values(CHARACTER_SKILLS).filter(c => c.gender === 'male');
}

// 获取所有女性角色（被动技能）
export function getFemaleCharacters() {
  return Object.values(CHARACTER_SKILLS).filter(c => c.gender === 'female');
}

// ==================== 聊天系统配置 ====================

// 聊天表情列表（18个常用表情）
export const CHAT_EMOJIS = [
  // 情绪类
  { id: 'happy', emoji: '😊', name: '开心' },
  { id: 'laugh', emoji: '😂', name: '大笑' },
  { id: 'think', emoji: '🤔', name: '思考' },
  { id: 'surprise', emoji: '😮', name: '惊讶' },
  { id: 'cry', emoji: '😭', name: '哭泣' },
  { id: 'angry', emoji: '😠', name: '愤怒' },
  { id: 'awkward', emoji: '😅', name: '尴尬' },
  { id: 'please', emoji: '🥺', name: '请求' },
  
  // 动作类
  { id: 'thumbsup', emoji: '👍', name: '赞' },
  { id: 'thumbsdown', emoji: '👎', name: '不赞' },
  { id: 'clap', emoji: '👏', name: '鼓掌' },
  { id: 'thanks', emoji: '🙏', name: '感谢' },
  { id: 'wait', emoji: '✋', name: '等等' },
  { id: 'handshake', emoji: '🤝', name: '握手' },
  
  // 游戏相关
  { id: 'target', emoji: '🎯', name: '目标' },
  { id: 'sword', emoji: '⚔️', name: '战斗' },
  { id: 'trophy', emoji: '🏆', name: '获胜' },
  { id: 'dice', emoji: '🎲', name: '随机' }
];

// 快捷消息列表（9条预设短语）
export const CHAT_QUICK_MESSAGES = [
  { id: 'hello', text: '你好！', icon: '👋' },
  { id: 'coming', text: '我要来喽！', icon: '🏃' },
  { id: 'wait', text: '稍等一下...', icon: '⏳' },
  { id: 'thinking', text: '我要思考...', icon: '💭' },
  { id: 'ready', text: '准备好了！', icon: '✅' },
  { id: 'great_game', text: '精彩对局！', icon: '🌟' },
  { id: 'thanks_game', text: '感谢对局', icon: '🙏' },
  { id: 'rematch', text: '再来一局吧！', icon: '🔄' },
  { id: 'leaving', text: '抱歉，我得离开了', icon: '👋' }
];

// 聊天消息类型
export const CHAT_MESSAGE_TYPES = {
  EMOJI: 'emoji',       // 表情消息
  QUICK: 'quick',       // 快捷消息
  TEXT: 'text'          // 自定义文字
};

// 最大历史消息数量
export const MAX_CHAT_HISTORY = 15;
