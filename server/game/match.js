import { GAME_CONFIG, CARD_TYPES, ALL_CARD_TYPES, DIRECTION_OFFSET, GAME_PHASES, MAP_THEMES, THEME_LIST, PORTAL_COLORS, PORTAL_COLOR_LIST, THEME_SHAPE_LAYOUTS, CHARACTER_SKILLS, getCharacterSkillById } from '../shared/constants.js'
import { AIPlayer } from './aiPlayer.js'
import { NeuralAIPlayer } from './neural_ai_player.js'

export class MatchManager {
  constructor() {
    this.matches = new Map()
    this.io = null
  }
  
  createMatch(roomCode) {
    const match = new Match(roomCode)
    match.setIO(this.io)
    this.matches.set(roomCode, match)
    return match
  }
  
  getMatchBySocket(socketId) {
    for (const match of this.matches.values()) {
      if (match.hasPlayer(socketId)) {
        return match
      }
    }
    return null
  }
  
  getMatch(roomCode) {
    return this.matches.get(roomCode)
  }
  
  deleteMatch(roomCode) {
    this.matches.delete(roomCode)
  }
  
  setPlayer(roomCode, socketId, playerIndex, avatarId = null) {
    const match = this.matches.get(roomCode)
    if (match && (playerIndex === 0 || playerIndex === 1)) {
      match.setPlayer(socketId, playerIndex, avatarId)
    }
  }
  
  setIO(io) {
    this.io = io
    for (const match of this.matches.values()) {
      match.setIO(io)
    }
  }
  
  // 根据socket ID移除match
  removeMatchBySocket(socketId) {
    for (const [roomCode, match] of this.matches) {
      if (match.hasPlayer(socketId)) {
        this.matches.delete(roomCode)
        console.log(`[Match] 已移除房间 ${roomCode} 的Match`)
        return
      }
    }
  }
}

class Match {
  constructor(roomCode) {
    this.roomCode = roomCode
    this.players = [null, null]  // [player1, player2]
    this.currentRound = 1
    this.phase = GAME_PHASES.WAITING
    
    // 地图配置状态
    this.mapConfig = {
      selectedSize: GAME_CONFIG.MAP_SIZE,  // 选中的地图大小
      isConfigured: false,                  // 是否已配置完成
      configTimeLimit: 30000                // 配置时间限制(ms)
    }
    
    // 迷雾效果开关
    this.fogEnabled = GAME_CONFIG.FOG_ENABLED_DEFAULT
    
    // 初始化地图（支持正方形和单行地图）
    this.map = {
      width: GAME_CONFIG.MAP_SIZE,   // 宽度
      height: GAME_CONFIG.MAP_SIZE,  // 高度
      size: GAME_CONFIG.MAP_SIZE,    // 兼容旧代码
      isSingleRow: false,            // 是否为单行地图
      obstacles: [],
      portals: [],                   // 传送门数组
      grass: [],                     // 草丛数组（森林主题）
      sandDunes: []                  // 可移动沙丘数组（沙漠主题）
    }
    this.map.obstacles = this.generateObstacles()
    
    // 玩家状态
    this.playerStates = [
      {
        id: '',
        avatarId: null,  // 玩家形象ID
        position: { x: 0, y: 0 },
        hp: GAME_CONFIG.INITIAL_HP,
        handCards: [],
        selectedCards: [],
        orderConfirmed: false,
        isDefending: false,
        isHidden: false,   // 是否在草丛中隐藏
        currentCards: [],  // 当前回合可选择的牌
        scoutEffects: [],  // 探查效果数组
        // ========== 技能相关字段 ==========
        skill: null,           // 当前角色技能配置
        skillCooldown: 0,      // 当前冷却回合数
        skillSelected: false,  // 本回合是否选择了技能牌
        historyVision: [],     // 历史视野记录（男阅读者用）
        normalTurnsCount: 0,   // 后手回合计数（女盗贼用）
        wallSkillLastTriggeredRound: -1  // 女盗贼技能上次触发的回合，-1表示从未触发
      },
      {
        id: '',
        avatarId: null,  // 玩家形象ID
        position: { x: GAME_CONFIG.MAP_SIZE - 1, y: GAME_CONFIG.MAP_SIZE - 1 },
        hp: GAME_CONFIG.INITIAL_HP,
        handCards: [],
        selectedCards: [],
        orderConfirmed: false,
        isDefending: false,
        isHidden: false,   // 是否在草丛中隐藏
        currentCards: [],  // 当前回合可选择的牌
        scoutEffects: [],  // 探查效果数组
        // ========== 技能相关字段 ==========
        skill: null,           // 当前角色技能配置
        skillCooldown: 0,      // 当前冷却回合数
        skillSelected: false,  // 本回合是否选择了技能牌
        historyVision: [],     // 历史视野记录（男阅读者用）
        normalTurnsCount: 0,   // 后手回合计数（女盗贼用）
        wallSkillLastTriggeredRound: -1  // 女盗贼技能上次触发的回合，-1表示从未触发
      }
    ]
    
    this.turnIndex = 0
    this.winner = null
    // 随机决定先手玩家 (true=玩家1先手, false=玩家2先手)
    this.isPlayer1Priority = Math.random() > 0.5
    this.priorityOrderComplete = false  // 优先玩家的顺序是否已确定
    
    // 地图主题（游戏开始时随机选择）
    this.theme = null
    
    // 冰原寒流状态：本回合是否被冻结
    this.frozenThisRound = false
    
    // 古城技能封印状态：技能是否被封印
    this.skillSealed = false
    
    // ========== AI单人模式 ==========
    this.isAIMatch = false
    this.aiPlayer = null
  }
  
  // 生成障碍物（根据地图大小动态计算数量）
  generateObstacles() {
    const obstacles = []
    const width = this.map.width
    const height = this.map.height
    
    // 单行地图不生成障碍物（会阻挡唯一通道）
    if (this.map.isSingleRow || height === 1) {
      console.log(`[障碍] 单行地图，不生成障碍物`)
      return []
    }
    
    // 动态计算障碍物数量：面积/6，范围 3 ~ 面积/5
    const area = width * height
    const count = Math.max(3, Math.min(Math.floor(area / 6), Math.floor(area / 5)))
    
    console.log(`[障碍] 地图 ${width}x${height}，面积 ${area}，生成 ${count} 个障碍物`)
    
    // 禁止区域：玩家初始位置周围
    const forbidden = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
      { x: width - 1, y: height - 1 }, { x: width - 2, y: height - 1 }, { x: width - 1, y: height - 2 }
    ]
    
    while (obstacles.length < count) {
      const x = Math.floor(Math.random() * width)
      const y = Math.floor(Math.random() * height)
      
      const isForbidden = forbidden.some(f => f.x === x && f.y === y)
      const isDuplicate = obstacles.some(o => o.x === x && o.y === y)
      
      if (!isForbidden && !isDuplicate) {
        obstacles.push({ x, y })
      }
    }
    
    return obstacles
  }
  
  // 特色地形地图：在有效区域内随机生成普通障碍物
  generateShapeMapObstacles(layout) {
    // 获取有效区域内的所有可用地格（layout=1的格子）
    const validCells = []
    for (let y = 0; y < layout.length; y++) {
      for (let x = 0; x < layout[y].length; x++) {
        if (layout[y][x] === 1) {
          validCells.push({ x, y })
        }
      }
    }
    
    // 计算有效区域面积
    const validArea = validCells.length
    if (validArea < 10) {
      console.log(`[障碍] 特色地形有效区域过小(${validArea}格)，不生成普通障碍物`)
      return
    }
    
    // 计算障碍物数量：有效面积/6，范围 2 ~ 有效面积/5
    const obstacleCount = Math.max(2, Math.min(Math.floor(validArea / 6), Math.floor(validArea / 5)))
    console.log(`[障碍] 特色地形有效区域 ${validArea}格，计划生成 ${obstacleCount} 个普通障碍物`)
    
    // 玩家起始位置
    const player1Pos = this.playerStates[0].position
    const player2Pos = this.playerStates[1].position
    
    // 禁止区域：玩家起始位置及其周围一格
    const forbidden = new Set()
    const addToForbidden = (x, y) => {
      forbidden.add(`${x},${y}`)
    }
    
    // 玩家1周围禁止放置障碍物
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        addToForbidden(player1Pos.x + dx, player1Pos.y + dy)
      }
    }
    
    // 玩家2周围禁止放置障碍物
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        addToForbidden(player2Pos.x + dx, player2Pos.y + dy)
      }
    }
    
    // 最多尝试20次生成有效布局
    const maxAttempts = 20
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // 临时障碍物数组
      const tempObstacles = []
      
      // 从有效格子中随机选择障碍物位置
      const availableCells = validCells.filter(cell => !forbidden.has(`${cell.x},${cell.y}`))
      const shuffledCells = availableCells.sort(() => Math.random() - 0.5)
      
      for (let i = 0; i < obstacleCount && i < shuffledCells.length; i++) {
        tempObstacles.push({ x: shuffledCells[i].x, y: shuffledCells[i].y })
      }
      
      // 检查路径连通性
      if (this.checkPathConnectivity(layout, tempObstacles, player1Pos, player2Pos)) {
        // 路径连通，添加障碍物到地图
        this.map.obstacles.push(...tempObstacles)
        console.log(`[障碍] 特色地形生成 ${tempObstacles.length} 个普通障碍物，尝试次数: ${attempt + 1}`)
        return
      }
    }
    
    console.log(`[障碍] 特色地形无法生成连通的障碍物布局，跳过普通障碍物`)
  }
  
  // 检查两名玩家之间是否存在可达路径（BFS）
  checkPathConnectivity(layout, obstacles, startPos, endPos) {
    // 创建障碍物位置集合（包括边界障碍物）
    const obstacleSet = new Set()
    this.map.obstacles.forEach(o => obstacleSet.add(`${o.x},${o.y}`))
    obstacles.forEach(o => obstacleSet.add(`${o.x},${o.y}`))
    
    // BFS搜索
    const queue = [{ x: startPos.x, y: startPos.y }]
    const visited = new Set()
    visited.add(`${startPos.x},${startPos.y}`)
    
    const directions = [
      { dx: 0, dy: -1 },  // 上
      { dx: 0, dy: 1 },   // 下
      { dx: -1, dy: 0 },  // 左
      { dx: 1, dy: 0 }    // 右
    ]
    
    while (queue.length > 0) {
      const current = queue.shift()
      
      // 检查是否到达终点
      if (current.x === endPos.x && current.y === endPos.y) {
        return true
      }
      
      // 探索四个方向
      for (const dir of directions) {
        const newX = current.x + dir.dx
        const newY = current.y + dir.dy
        const key = `${newX},${newY}`
        
        // 检查边界
        if (newX < 0 || newX >= this.map.width || newY < 0 || newY >= this.map.height) {
          continue
        }
        
        // 检查是否为有效区域
        if (layout[newY][newX] !== 1) {
          continue
        }
        
        // 检查是否已访问
        if (visited.has(key)) {
          continue
        }
        
        // 检查是否有障碍物
        if (obstacleSet.has(key)) {
          continue
        }
        
        visited.add(key)
        queue.push({ x: newX, y: newY })
      }
    }
    
    return false
  }
  
  // 根据地图面积计算传送门数量
  calculatePortalCount() {
    const area = this.map.width * this.map.height
    if (area <= 20) return 0
    if (area <= 40) return 1
    if (area <= 60) return Math.random() < 0.5 ? 1 : 2
    return Math.random() < 0.5 ? 2 : 3
  }
  
  // 生成传送门
  generatePortals() {
    const count = this.calculatePortalCount()
    if (count === 0) {
      this.map.portals = []
      console.log(`[传送门] 地图面积过小，不生成传送门`)
      return
    }
    
    // 随机选择不重复的颜色
    const shuffledColors = [...PORTAL_COLOR_LIST].sort(() => Math.random() - 0.5)
    const selectedColors = shuffledColors.slice(0, count)
    
    const portals = []
    const usedPositions = new Set()
    
    // 添加障碍物到禁止区域
    this.map.obstacles.forEach(o => usedPositions.add(`${o.x},${o.y}`))
    // 添加玩家初始位置到禁止区域
    usedPositions.add('0,0')  // 玩家1初始位置
    usedPositions.add(`${this.map.width - 1},${this.map.height - 1}`)  // 玩家2初始位置
    
    for (const color of selectedColors) {
      // 随机选择进口和出口位置
      const entry = this.getRandomEmptyPosition(usedPositions)
      if (!entry) {
        console.log(`[传送门] 无法找到合适的进口位置，跳过${color}传送门`)
        continue
      }
      usedPositions.add(`${entry.x},${entry.y}`)
      
      const exit = this.getRandomEmptyPosition(usedPositions)
      if (!exit) {
        console.log(`[传送门] 无法找到合适的出口位置，跳过${color}传送门`)
        usedPositions.delete(`${entry.x},${entry.y}`)
        continue
      }
      usedPositions.add(`${exit.x},${exit.y}`)
      
      portals.push({
        id: `portal_${color}_${Date.now()}`,
        color: color,
        entry: entry,
        exit: exit
      })
    }
    
    this.map.portals = portals
    console.log(`[传送门] 生成了 ${portals.length} 对传送门:`, portals.map(p => `${PORTAL_COLORS[p.color].name}(${p.entry.x},${p.entry.y})→(${p.exit.x},${p.exit.y})`).join(', '))
  }
  
  // 获取随机空位置
  getRandomEmptyPosition(usedPositions) {
    const maxAttempts = 100
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(Math.random() * this.map.width)
      const y = Math.floor(Math.random() * this.map.height)
      const key = `${x},${y}`
      if (!usedPositions.has(key)) {
        return { x, y }
      }
    }
    return null
  }
  
  // 检查玩家是否站在传送门进口
  checkPortalEntry(position) {
    return this.map.portals?.find(p => 
      p.entry.x === position.x && p.entry.y === position.y
    )
  }
  
  // 传送玩家
  teleportPlayer(playerIndex, portal) {
    const player = this.playerStates[playerIndex]
    const fromPos = { ...player.position }
    
    // 更新位置到出口
    player.position = { ...portal.exit }
    
    // 发送传送特效事件
    this.io?.to(this.roomCode).emit('portal_teleport', {
      playerIndex: playerIndex,
      color: portal.color,
      from: fromPos,
      to: portal.exit
    })
    
    this.io?.to(this.roomCode).emit('game_message', {
      message: `🌀 玩家${playerIndex + 1}通过${PORTAL_COLORS[portal.color].name}传送门传送！`,
      type: 'info'
    })
    
    console.log(`[传送门] 玩家${playerIndex + 1}从(${fromPos.x},${fromPos.y})传送到(${portal.exit.x},${portal.exit.y})`)
    
    // 更新隐藏状态
    this.updateHiddenState(playerIndex)
  }
  
  // 生成草丛（森林主题特色）
  generateGrass() {
    const width = this.map.width
    const height = this.map.height
    
    // 确定有效区域（特色地形只在使用 layout=1 的格子生成）
    let validCells = []
    if (this.map.isShapeMap && this.map.shapeLayout) {
      // 特色地形：只收集 layout=1 的格子
      for (let y = 0; y < this.map.shapeLayout.length; y++) {
        for (let x = 0; x < this.map.shapeLayout[y].length; x++) {
          if (this.map.shapeLayout[y][x] === 1) {
            validCells.push({ x, y })
          }
        }
      }
      console.log(`[草丛] 特色地形有效区域: ${validCells.length} 个格子`)
    } else {
      // 正方形地图：所有格子都有效
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          validCells.push({ x, y })
        }
      }
    }
    
    // 计算草丛数量：有效区域面积的 1/6 ~ 1/5
    const validArea = validCells.length
    const count = Math.max(3, Math.min(Math.floor(validArea / 6), Math.floor(validArea / 5)))
    
    console.log(`[草丛] 地图 ${width}x${height}，有效区域 ${validArea} 格，计划生成 ${count} 个草丛`)
    
    // 禁止区域：障碍物位置、传送门位置、玩家初始位置
    const forbidden = new Set()
    
    // 添加障碍物到禁止区域
    this.map.obstacles.forEach(o => forbidden.add(`${o.x},${o.y}`))
    console.log(`[草丛] 障碍物数量: ${this.map.obstacles.length}`)
    
    // 添加传送门位置到禁止区域
    if (this.map.portals && this.map.portals.length > 0) {
      this.map.portals.forEach(p => {
        forbidden.add(`${p.entry.x},${p.entry.y}`)
        forbidden.add(`${p.exit.x},${p.exit.y}`)
      })
      console.log(`[草丛] 传送门数量: ${this.map.portals.length}`)
    }
    
    // 添加玩家初始位置到禁止区域
    forbidden.add(`${this.playerStates[0].position.x},${this.playerStates[0].position.y}`)
    forbidden.add(`${this.playerStates[1].position.x},${this.playerStates[1].position.y}`)
    console.log(`[草丛] 玩家1位置: (${this.playerStates[0].position.x},${this.playerStates[0].position.y})`)
    console.log(`[草丛] 玩家2位置: (${this.playerStates[1].position.x},${this.playerStates[1].position.y})`)
    
    // 从有效区域中过滤出可用格子
    const availableCells = validCells.filter(cell => !forbidden.has(`${cell.x},${cell.y}`))
    console.log(`[草丛] 可用格子数量: ${availableCells.length}`)
    
    // 随机选择草丛位置
    const shuffledCells = availableCells.sort(() => Math.random() - 0.5)
    const grass = shuffledCells.slice(0, count).map(cell => ({ x: cell.x, y: cell.y }))
    
    this.map.grass = grass
    console.log(`[草丛] 成功生成 ${grass.length} 个草丛:`, grass.map(g => `(${g.x},${g.y})`).join(', '))
  }
  
  // 检查玩家是否在草丛中
  checkPlayerInGrass(position) {
    return this.map.grass?.some(g => g.x === position.x && g.y === position.y) || false
  }
  
  // 更新玩家隐藏状态
  updateHiddenState(playerIndex) {
    const player = this.playerStates[playerIndex]
    const wasHidden = player.isHidden
    player.isHidden = this.checkPlayerInGrass(player.position)
    
    if (player.isHidden !== wasHidden) {
      console.log(`[草丛] 玩家${playerIndex + 1} ${player.isHidden ? '进入' : '离开'}草丛`)
    }
  }
  
  // ========== 沙漠沙丘特性 ==========
  
  // 生成可移动沙丘（沙漠主题特色）
  generateSandDunes() {
    const width = this.map.width
    const height = this.map.height
    
    // 确定有效区域
    let validCells = []
    if (this.map.isShapeMap && this.map.shapeLayout) {
      for (let y = 0; y < this.map.shapeLayout.length; y++) {
        for (let x = 0; x < this.map.shapeLayout[y].length; x++) {
          if (this.map.shapeLayout[y][x] === 1) {
            validCells.push({ x, y })
          }
        }
      }
    } else {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          validCells.push({ x, y })
        }
      }
    }
    
    // 计算沙丘数量：有效区域面积的 1/8 ~ 1/6
    const validArea = validCells.length
    const count = Math.max(2, Math.min(Math.floor(validArea / 8), Math.floor(validArea / 6)))
    
    console.log(`[沙丘] 地图 ${width}x${height}，有效区域 ${validArea} 格，计划生成 ${count} 个沙丘`)
    
    // 禁止区域：障碍物、传送门、玩家初始位置、草丛
    const forbidden = new Set()
    this.map.obstacles.forEach(o => forbidden.add(`${o.x},${o.y}`))
    if (this.map.portals) {
      this.map.portals.forEach(p => {
        forbidden.add(`${p.entry.x},${p.entry.y}`)
        forbidden.add(`${p.exit.x},${p.exit.y}`)
      })
    }
    forbidden.add(`${this.playerStates[0].position.x},${this.playerStates[0].position.y}`)
    forbidden.add(`${this.playerStates[1].position.x},${this.playerStates[1].position.y}`)
    if (this.map.grass) {
      this.map.grass.forEach(g => forbidden.add(`${g.x},${g.y}`))
    }
    
    const availableCells = validCells.filter(cell => !forbidden.has(`${cell.x},${cell.y}`))
    const shuffledCells = availableCells.sort(() => Math.random() - 0.5)
    const sandDunes = shuffledCells.slice(0, count).map(cell => ({ x: cell.x, y: cell.y }))
    
    this.map.sandDunes = sandDunes
    console.log(`[沙丘] 成功生成 ${sandDunes.length} 个沙丘:`, sandDunes.map(d => `(${d.x},${d.y})`).join(', '))
  }
  
  // 检查位置是否是沙丘
  isSandDune(x, y) {
    return this.map.sandDunes?.some(d => d.x === x && d.y === y) || false
  }
  
  // 移动沙丘（每回合结束后调用）
  moveSandDunes() {
    if (!this.map.sandDunes || this.map.sandDunes.length === 0) return
    
    const movedDunes = []
    const directions = [
      { dx: 0, dy: -1 },  // 上
      { dx: 0, dy: 1 },   // 下
      { dx: -1, dy: 0 },  // 左
      { dx: 1, dy: 0 }    // 右
    ]
    
    // 收集所有不可移动到的位置
    const occupiedPositions = new Set()
    this.map.obstacles.forEach(o => occupiedPositions.add(`${o.x},${o.y}`))
    if (this.map.portals) {
      this.map.portals.forEach(p => {
        occupiedPositions.add(`${p.entry.x},${p.entry.y}`)
        occupiedPositions.add(`${p.exit.x},${p.exit.y}`)
      })
    }
    if (this.map.grass) {
      this.map.grass.forEach(g => occupiedPositions.add(`${g.x},${g.y}`))
    }
    
    // 新沙丘位置集合（用于去重）
    const newDunePositions = new Set()
    
    for (const dune of this.map.sandDunes) {
      // 收集已有沙丘位置（排除当前沙丘）
      const otherDunePositions = new Set()
      for (const d of this.map.sandDunes) {
        if (d !== dune) otherDunePositions.add(`${d.x},${d.y}`)
      }
      for (const pos of newDunePositions) otherDunePositions.add(pos)
      
      // 50%概率移动
      if (Math.random() < 0.5) {
        // 随机选择移动方向
        const shuffledDirs = [...directions].sort(() => Math.random() - 0.5)
        let moved = false
        
        for (const dir of shuffledDirs) {
          const newX = dune.x + dir.dx
          const newY = dune.y + dir.dy
          const key = `${newX},${newY}`
          
          // 检查边界
          if (newX < 0 || newX >= this.map.width || newY < 0 || newY >= this.map.height) continue
          
          // 检查是否在有效区域内（特色地形）
          if (this.map.isShapeMap && this.map.shapeLayout) {
            if (!this.map.shapeLayout[newY] || this.map.shapeLayout[newY][newX] !== 1) continue
          }
          
          // 检查是否被占据
          if (occupiedPositions.has(key)) continue
          
          // 检查是否与其他沙丘重叠
          if (otherDunePositions.has(key)) continue
          
          // 检查是否与玩家重叠
          if (this.playerStates[0].position.x === newX && this.playerStates[0].position.y === newY) continue
          if (this.playerStates[1].position.x === newX && this.playerStates[1].position.y === newY) continue
          
          // 可以移动
          movedDunes.push({ from: { x: dune.x, y: dune.y }, to: { x: newX, y: newY } })
          newDunePositions.add(key)
          dune.x = newX
          dune.y = newY
          moved = true
          break
        }
        
        if (!moved) {
          newDunePositions.add(`${dune.x},${dune.y}`)
        }
      } else {
        newDunePositions.add(`${dune.x},${dune.y}`)
      }
    }
    
    // 通知客户端沙丘移动
    if (movedDunes.length > 0) {
      this.io?.to(this.roomCode).emit('sand_dunes_moved', {
        sandDunes: this.map.sandDunes,
        movedDunes: movedDunes
      })
      console.log(`[沙丘] ${movedDunes.length} 个沙丘移动了位置`)
    }
  }
  
  hasPlayer(socketId) {
    return this.playerStates[0].id === socketId || this.playerStates[1].id === socketId
  }
  
  getPlayerIndex(socketId) {
    if (!socketId) return -1
    if (this.playerStates[0].id === socketId) return 0
    if (this.playerStates[1].id === socketId) return 1
    return -1
  }
  
  setPlayer(socketId, index, avatarId = null) {
    if (index !== 0 && index !== 1) {
      console.error(`[错误] 无效的玩家索引: ${index}`)
      return
    }
    this.playerStates[index].id = socketId
    this.playerStates[index].avatarId = avatarId
    
    // ========== 技能初始化 ==========
    if (avatarId) {
      const skillConfig = getCharacterSkillById(avatarId)
      if (skillConfig) {
        this.playerStates[index].skill = skillConfig
        console.log(`[技能] 玩家${index + 1}角色: ${skillConfig.name}, 技能: ${skillConfig.skillName} (${skillConfig.skillType === 'active' ? '主动' : '被动'})`)
        
        // ========== 女骑士血量加成 ==========
        if (skillConfig.bonusHp) {
          this.playerStates[index].hp = GAME_CONFIG.INITIAL_HP + skillConfig.bonusHp
          console.log(`[技能] 女骑士坚韧突刺：初始血量+${skillConfig.bonusHp}，当前HP: ${this.playerStates[index].hp}`)
        }
      }
    }
    
    console.log(`[玩家] 玩家${index + 1}设置为: ${socketId}, 形象: ${avatarId || '默认'}`)
  }

  // 更新玩家角色形象（配置阶段实时更新）
  updatePlayerAvatar(socketId, avatarId) {
    // 找到对应的玩家索引
    const playerIndex = this.playerStates.findIndex(p => p.id === socketId)
    if (playerIndex === -1) {
      console.log(`[警告] 未找到玩家 ${socketId}`)
      return
    }

    // 更新角色形象
    this.playerStates[playerIndex].avatarId = avatarId
    console.log(`[角色] 玩家${playerIndex + 1} (${socketId}) 更换角色为: ${avatarId}`)
    
    // 检查两个玩家是否都已加入
    if (this.playerStates[0].id && this.playerStates[1].id) {
      // 进入地图配置阶段，通知房主（玩家1）选择地图大小
      this.phase = GAME_PHASES.CONFIGURING
      console.log(`[配置] 进入地图配置阶段`)
      
      // 通知双方进入配置阶段
      this.io?.to(this.roomCode).emit('enter_configuring', {
        phase: GAME_PHASES.CONFIGURING,
        mapSizeOptions: GAME_CONFIG.MAP_SIZE_OPTIONS,
        creatorId: this.playerStates[0].id  // 房主ID
      })
    }
  }
  
  // 设置地图大小（仅房主可调用）
  setMapSize(socketId, config) {
    // 只有房主（玩家1）可以设置地图大小
    if (this.playerStates[0].id !== socketId) {
      console.log(`[配置] 非房主尝试设置地图大小，被拒绝`)
      return false
    }
    
    // 支持传入 size 或 config 对象
    const size = typeof config === 'object' ? config.mapSize : config
    const fogEnabled = typeof config === 'object' ? config.fogEnabled : GAME_CONFIG.FOG_ENABLED_DEFAULT
    const themeId = typeof config === 'object' ? config.themeId : 'random'
    
    // 保存迷雾设置
    this.fogEnabled = fogEnabled
    console.log(`[配置] 迷雾效果: ${fogEnabled ? '启用' : '关闭'}`)
    
    // 保存主题设置
    this.selectedThemeId = themeId
    console.log(`[配置] 地图主题: ${themeId}`)
    
    this.mapConfig.selectedSize = size
    this.mapConfig.isConfigured = true
    
    // 检查是否为特色地形模式
    if (size === 'shape') {
      // 特色地形模式：如果主题是random或不存在于布局中，随机选择一个有效的主题
      let actualThemeId = themeId
      if (themeId === 'random' || !THEME_SHAPE_LAYOUTS[themeId]) {
        const themeKeys = Object.keys(THEME_SHAPE_LAYOUTS)
        actualThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)]
        console.log(`[配置] 特色地形随机选择主题: ${actualThemeId}`)
      }
      
      const shapeData = THEME_SHAPE_LAYOUTS[actualThemeId]
      if (!shapeData) {
        console.error(`[错误] 找不到主题 ${actualThemeId} 的特色地形布局`)
        return false
      }
      
      // 更新选中的主题ID为实际使用的主题
      this.selectedThemeId = actualThemeId
      
      const layout = shapeData.layout
      this.map.width = layout[0].length
      this.map.height = layout.length
      this.map.size = Math.max(this.map.width, this.map.height)
      this.map.isSingleRow = false
      this.map.shapeLayout = layout  // 保存布局数据
      this.map.isShapeMap = true     // 标记为特色地形地图
      
      // 设置玩家起始位置
      if (shapeData.player1Start) {
        this.playerStates[0].position = { ...shapeData.player1Start }
      } else {
        this.playerStates[0].position = { x: 0, y: 0 }
      }
      
      if (shapeData.player2Start) {
        this.playerStates[1].position = { ...shapeData.player2Start }
      } else {
        this.playerStates[1].position = { x: this.map.width - 1, y: this.map.height - 1 }
      }
      
      console.log(`[配置] 房主设置特色地形地图: ${themeId} (${this.map.width}x${this.map.height})`)
      
      // 特色地形：不可用的格子作为边界障碍物（标记为isBoundary）
      this.map.obstacles = []
      for (let y = 0; y < layout.length; y++) {
        for (let x = 0; x < layout[y].length; x++) {
          if (layout[y][x] === 0) {
            this.map.obstacles.push({ x, y, isBoundary: true })
          }
        }
      }
      console.log(`[配置] 特色地形边界障碍物数量: ${this.map.obstacles.length}`)
      
      // 在有效区域内随机生成普通障碍物
      this.generateShapeMapObstacles(layout)
    } else if (typeof size === 'string' && size.startsWith('1x')) {
      // 单行地图格式: '1x5', '1x7', '1x10'
      const width = parseInt(size.split('x')[1])
      this.map.width = width
      this.map.height = 1
      this.map.size = width  // 兼容旧代码
      this.map.isSingleRow = true
      this.map.shapeLayout = null
      this.map.isShapeMap = false
      
      // 单行地图：玩家1在左侧，玩家2在右侧
      this.playerStates[0].position = { x: 0, y: 0 }
      this.playerStates[1].position = { x: width - 1, y: 0 }
      
      console.log(`[配置] 房主设置单行地图: ${size}`)
      
      // 重新生成障碍物
      this.map.obstacles = this.generateObstacles()
    } else {
      // 验证地图大小是否在允许范围内
      if (!GAME_CONFIG.MAP_SIZE_OPTIONS.includes(size)) {
        console.error(`[错误] 无效的地图大小: ${size}`)
        return false
      }
      
      // 正方形地图
      this.map.width = size
      this.map.height = size
      this.map.size = size
      this.map.isSingleRow = false
      this.map.shapeLayout = null
      this.map.isShapeMap = false
      
      // 正方形地图：玩家在对角
      this.playerStates[0].position = { x: 0, y: 0 }
      this.playerStates[1].position = { x: size - 1, y: size - 1 }
      
      console.log(`[配置] 房主设置正方形地图: ${size}x${size}`)
      
      // 重新生成障碍物
      this.map.obstacles = this.generateObstacles()
    }
    
    // 通知双方配置完成
    this.io?.to(this.roomCode).emit('map_configured', {
      mapSize: size,
      map: this.map
    })
    
    // 开始游戏
    setTimeout(() => {
      this.startGame()
    }, 500)
    
    return true
  }
  
  // 开始游戏
  startGame() {
    console.log(`[游戏] 玩家都已加入，开始游戏`)
    console.log(`[游戏] 先手玩家: ${this.isPlayer1Priority ? '玩家1' : '玩家2'}`)
    this.phase = GAME_PHASES.DEALING
    
    // 使用指定的主题，如果是'random'则随机选择
    let selectedThemeId = this.selectedThemeId || 'random'
    if (selectedThemeId === 'random' || !MAP_THEMES[selectedThemeId]) {
      const randomThemeIndex = Math.floor(Math.random() * THEME_LIST.length)
      selectedThemeId = THEME_LIST[randomThemeIndex]
    }
    this.theme = MAP_THEMES[selectedThemeId]
    console.log(`[游戏] 地图主题: ${this.theme.nameCn} (选择: ${this.selectedThemeId || 'random'})`)
    
    // 为每个障碍物随机分配类型
    this.map.obstacles = this.map.obstacles.map(obs => ({
      ...obs,
      type: this.theme.obstacleTypes[Math.floor(Math.random() * this.theme.obstacleTypes.length)]
    }))
    
    // 生成传送门
    this.generatePortals()
    
    // 森林主题：生成草丛
    console.log(`[草丛] 检查主题: ${this.theme.id}, grassEnabled: ${this.theme.grassEnabled}`)
    if (this.theme.grassEnabled) {
      console.log(`[草丛] 森林主题确认，开始生成草丛...`)
      this.generateGrass()
    } else {
      console.log(`[草丛] 非森林主题或 grassEnabled 未设置，跳过草丛生成`)
    }
    
    // 沙漠主题：生成可移动沙丘
    console.log(`[沙丘] 检查主题: ${this.theme.id}, sandDuneEnabled: ${this.theme.sandDuneEnabled}`)
    if (this.theme.sandDuneEnabled) {
      console.log(`[沙丘] 沙漠主题确认，开始生成沙丘...`)
      this.generateSandDunes()
    } else {
      console.log(`[沙丘] 非沙漠主题或 sandDuneEnabled 未设置，跳过沙丘生成`)
    }
    
    // 古城主题：技能封印
    if (this.theme.id === 'ruins') {
      this.skillSealed = true
      console.log(`[封印] 古城技能封印生效！所有角色技能无效`)
    } else {
      this.skillSealed = false
    }
    
    // 通知客户端游戏开始，并传递先手信息和主题
    this.io?.to(this.roomCode).emit('game_start', {
      ...this.getState(),
      isPlayer1Priority: this.isPlayer1Priority,
      theme: this.theme,
      skillSealed: this.skillSealed
    })
    
    // 给先手玩家发牌
    this.dealCardsToPriorityPlayer()
  }
  
  // 为先手玩家发牌（生成相同的卡牌给两名玩家）
  dealCardsToPriorityPlayer() {
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    const normalIndex = 1 - priorityIndex
    
    // 单行地图发5张牌，正方形地图发6张牌
    const cardCount = this.map.isSingleRow ? 5 : 6
    
    // 生成共享卡牌（两名玩家相同的牌）
    const sharedCards = this.generateSharedCards(cardCount)
    console.log(`[发牌] 生成共享卡牌 (${this.map.isSingleRow ? '单行地图' : '正方形地图'}，${cardCount}张):`, sharedCards.map(c => c.name))
    
    // 生成玩家1的卡牌（使用共享卡牌）
    this.playerStates[0].currentCards = this.generateCards(cardCount, 0, sharedCards)
    this.playerStates[0].selectedCards = []
    this.playerStates[0].orderConfirmed = false
    
    // 生成玩家2的卡牌（使用共享卡牌）
    this.playerStates[1].currentCards = this.generateCards(cardCount, 1, sharedCards)
    this.playerStates[1].selectedCards = []
    this.playerStates[1].orderConfirmed = false
    
    // ========== 处理主动技能牌 ==========
    // 始终添加技能牌，古城封印时标记sealed=true（客户端显示封印效果，禁止选择）
    for (let i = 0; i < 2; i++) {
      const player = this.playerStates[i]
      if (player.skill && player.skill.skillType === 'active' && player.skillCooldown === 0) {
        // 添加技能牌到可选卡牌
        const skillCard = {
          id: `skill_${player.skill.id}_${Date.now()}`,
          type: 'skill',
          skillId: player.skill.id,
          name: player.skill.skillName,
          icon: player.skill.skillIcon,
          description: player.skill.description,
          cooldown: player.skill.cooldown,
          isSkillCard: true,
          sealed: this.skillSealed  // 古城封印标记
        }
        player.currentCards.push(skillCard)
        if (this.skillSealed) {
          console.log(`[封印] 玩家${i + 1}的主动技能牌【${player.skill.skillName}】已加入可选牌池（封印状态）`)
        } else {
          console.log(`[技能] 玩家${i + 1}的主动技能牌【${player.skill.skillName}】已加入可选牌池`)
        }
      }
    }
    
    // 先发送回合开始事件给双方（显示"进入第X回合"提示）
    this.io?.to(this.roomCode).emit('round_start', {
      round: this.currentRound
    })
    
    console.log(`[回合] 第${this.currentRound}回合开始，通知双方显示回合提示`)
    
    // 2秒后给先手玩家发送卡牌（等待回合提示完全消失）
    setTimeout(() => {
      this.io?.to(this.playerStates[priorityIndex].id).emit('deal_cards', {
        cards: this.playerStates[priorityIndex].currentCards,
        isPriority: true,
        opponentFirstCard: null,
        // 双方技能信息（用于显示双方的技能卡牌）
        player1Skill: this.playerStates[0].skill,
        player1SkillCooldown: this.playerStates[0].skillCooldown,
        player2Skill: this.playerStates[1].skill,
        player2SkillCooldown: this.playerStates[1].skillCooldown
      })
      
      console.log(`[发牌] 发给先手玩家(玩家${priorityIndex + 1})`)
    }, 2000)
    
    this.phase = GAME_PHASES.SELECTING_PRIORITY
    this.triggerAIIfNeeded('selecting')
  }
  
  // 为后手玩家发牌
  dealCardsToNormalPlayer() {
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    const normalIndex = 1 - priorityIndex
    
      // 给后手玩家发送卡牌
      this.io?.to(this.playerStates[normalIndex].id).emit('deal_cards', {
        cards: this.playerStates[normalIndex].currentCards,
        isPriority: false,
        opponentFirstCard: null,
        // 双方技能信息（用于显示双方的技能卡牌）
        player1Skill: this.playerStates[0].skill,
        player1SkillCooldown: this.playerStates[0].skillCooldown,
        player2Skill: this.playerStates[1].skill,
        player2SkillCooldown: this.playerStates[1].skillCooldown
      })
      
      console.log(`[发牌] 发给后手玩家(玩家${normalIndex + 1})`)
  }
  
  // 生成指定数量的卡牌（两名玩家相同的牌）
  // 参数 sharedCards: 预生成的共享卡牌数组（如果有）
  generateCards(count, playerIndex = 0, sharedCards = null) {
    const cards = []
    
    // 如果已经有预生成的共享卡牌，直接复制
    if (sharedCards && sharedCards.length >= count) {
      for (let i = 0; i < count; i++) {
        cards.push({
          ...sharedCards[i],
          id: `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`
        })
      }
      return cards
    }
    
    // 否则生成新卡牌（备用逻辑，正常情况下使用 generateSharedCards）
    const isEarlyGame = this.currentRound <= 3
    
    // 卡牌分类权重配置
    // 前三回合：80%移动牌, 15%攻击牌, 5%防御牌
    // 后期：55%移动牌, 25%攻击牌, 20%防御牌
    const moveRatio = isEarlyGame ? 16 : 11
    const attackRatio = isEarlyGame ? 3 : 5
    const defenseRatio = isEarlyGame ? 1 : 4
    
    const cardPool = []
    
    // 添加移动牌（始终包含所有4个方向，不依赖位置）
    for (let i = 0; i < moveRatio; i++) {
      cardPool.push('MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT')
    }
    
    // 添加攻击牌
    for (let i = 0; i < attackRatio; i++) {
      cardPool.push('ATTACK_UP_1', 'ATTACK_RIGHT_1', 'ATTACK_DOWN_1', 'ATTACK_LEFT_1',
                   'ATTACK_UP_2', 'ATTACK_RIGHT_2', 'ATTACK_DOWN_2', 'ATTACK_LEFT_2')
    }
    
    // 添加防御牌
    for (let i = 0; i < defenseRatio; i++) {
      cardPool.push('DEFENSE', 'DEFENSE', 'DEFENSE', 'DEFENSE')
    }
    
    // 添加探查牌（正方形地图才有）
    if (!isSingleRow) {
      const scoutRatio = isEarlyGame ? 2 : 1  // 前期探查需求更高
      for (let i = 0; i < scoutRatio; i++) {
        cardPool.push('SCOUT_ROW', 'SCOUT_COL', 'SCOUT_AROUND')
      }
    }
    
    const guaranteedMoves = isEarlyGame ? 2 : 1
    
    for (let i = 0; i < count; i++) {
      let cardType
      
      // 前几张保证有移动牌
      if (i < guaranteedMoves) {
        const moves = ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT']
        cardType = moves[Math.floor(Math.random() * moves.length)]
      } else {
        const randomIndex = Math.floor(Math.random() * cardPool.length)
        cardType = cardPool[randomIndex]
      }
      
      if (cardType && CARD_TYPES[cardType]) {
        cards.push({
          ...CARD_TYPES[cardType],
          id: `${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`
        })
      }
    }
    return cards
  }
  
  // 生成共享卡牌（供两名玩家使用）
  generateSharedCards(count) {
    const size = this.map.size
    const isEarlyGame = this.currentRound <= 3  // 前三回合
    const isSingleRow = this.map.isSingleRow    // 是否为单行地图
    
    // 卡牌池
    const cardPool = []
    
    // 卡牌权重配置
    // 正方形地图前三回合：移动牌, 攻击牌, 防御牌, 探查牌
    // 正方形地图后期：移动牌, 攻击牌, 防御牌, 探查牌
    // 单行地图前三回合：移动牌, 攻击牌, 防御牌, 探查牌
    // 单行地图后期：移动牌, 攻击牌, 防御牌, 探查牌
    let moveRatio, attackRatio, defenseRatio, scoutRatio
    
    if (isSingleRow) {
      // 单行地图：降低移动牌概率，增加防御牌概率
      moveRatio = isEarlyGame ? 8 : 9     // 移动牌权重
      attackRatio = isEarlyGame ? 7 : 6   // 攻击牌权重
      defenseRatio = isEarlyGame ? 5 : 5  // 防御牌权重
      scoutRatio = isEarlyGame ? 7 : 4    // 探查牌权重（前三回合提升）
    } else {
      // 正方形地图：探查牌与攻击牌相当，前三回合略高
      moveRatio = isEarlyGame ? 16 : 11   // 移动牌权重
      attackRatio = isEarlyGame ? 3 : 5   // 攻击牌权重
      defenseRatio = isEarlyGame ? 1 : 4  // 防御牌权重
      scoutRatio = isEarlyGame ? 6 : 5    // 探查牌权重（前三回合提升）
    }
    
    // 根据地图类型决定可用的移动方向
    // 单行地图只能左右移动和攻击
    const moveCards = isSingleRow 
      ? ['MOVE_LEFT', 'MOVE_RIGHT']  // 单行地图：只有左右
      : ['MOVE_UP', 'MOVE_DOWN', 'MOVE_LEFT', 'MOVE_RIGHT']  // 正方形：四个方向
    
    const attackCards1 = isSingleRow
      ? ['ATTACK_LEFT_1', 'ATTACK_RIGHT_1']  // 单行地图：只有左右1格攻击
      : ['ATTACK_UP_1', 'ATTACK_DOWN_1', 'ATTACK_LEFT_1', 'ATTACK_RIGHT_1']  // 正方形：四个方向
    
    // 单行地图不生成2格攻击牌
    const attackCards2 = isSingleRow
      ? []  // 单行地图：不生成2格攻击
      : ['ATTACK_UP_2', 'ATTACK_DOWN_2', 'ATTACK_LEFT_2', 'ATTACK_RIGHT_2']  // 正方形：四个方向
    
    // 添加移动牌
    for (let i = 0; i < moveRatio; i++) {
      cardPool.push(...moveCards)
    }
    
    // 添加攻击牌
    for (let i = 0; i < attackRatio; i++) {
      cardPool.push(...attackCards1, ...attackCards2)
    }
    
    // 添加防御牌
    for (let i = 0; i < defenseRatio; i++) {
      cardPool.push('DEFENSE', 'DEFENSE', 'DEFENSE', 'DEFENSE')
    }
    
    // 根据地图条件决定可用的探查牌
    // 如果迷雾效果关闭，则不提供探查牌
    if (!this.fogEnabled) {
      console.log(`[发牌] 迷雾效果已关闭，不提供探查牌`)
    } else {
      const scoutCards = []
      const minDimension = Math.min(this.map.width, this.map.height)
      
      // 只有地图有多列时才提供行探查（行探查照亮整行）
      if (this.map.width > 1) {
        scoutCards.push('SCOUT_ROW')
      }
      
      // 只有地图有多行时才提供列探查（列探查照亮整列）
      if (this.map.height > 1) {
        scoutCards.push('SCOUT_COL')
      }
      
      // 只有地图短边 >= 5 时才提供环绕探查
      if (minDimension >= 5) {
        scoutCards.push('SCOUT_AROUND')
      }
      
      // 只有有可用探查牌时才添加到卡牌池
      if (scoutCards.length > 0) {
        for (let i = 0; i < scoutRatio; i++) {
          cardPool.push(...scoutCards)
        }
        console.log(`[发牌] 可用探查牌: ${scoutCards.map(c => CARD_TYPES[c].name).join(', ')} (地图: ${this.map.width}x${this.map.height}, 短边: ${minDimension})`)
      } else {
        console.log(`[发牌] 当前地图不提供探查牌 (地图: ${this.map.width}x${this.map.height})`)
      }
    }
    
    // 尝试生成合理的卡牌，最多尝试10次
    let cards = []
    let attempts = 0
    const maxAttempts = 10
    
    do {
      cards = []
      // 前三回合：至少保证前3张有2张是移动牌
      const guaranteedMoves = isEarlyGame ? 2 : 1
      
      for (let i = 0; i < count; i++) {
        let cardType
        
        // 前几张保证有移动牌
        if (i < guaranteedMoves) {
          cardType = moveCards[Math.floor(Math.random() * moveCards.length)]
        } else {
          const randomIndex = Math.floor(Math.random() * cardPool.length)
          cardType = cardPool[randomIndex]
        }
        
        if (cardType && CARD_TYPES[cardType]) {
          cards.push({
            ...CARD_TYPES[cardType],
            id: `shared_${Date.now()}_${i}_${attempts}`
          })
        }
      }
      attempts++
    } while (!this.validateCardsIntelligently(cards) && attempts < maxAttempts)
    
    console.log(`[发牌] 第${this.currentRound}回合，${isEarlyGame ? '前' : '后'}期阶段，${isSingleRow ? '单行地图' : '正方形地图'}，生成卡牌:`, cards.map(c => c.name), `(尝试${attempts}次)`)
    return cards
  }
  
  // 智能验证卡牌合理性
  validateCardsIntelligently(cards) {
    // 检查防御牌数量：不能出现3张或更多防御牌
    const defenseCount = cards.filter(c => c.type === 'defense').length
    if (defenseCount >= 3) {
      console.log(`[验证] 防御牌过多(${defenseCount}张)，重新生成`)
      return false
    }
    
    // 检查探查牌重复：同类型探查牌不能出现2张或更多
    const scoutCounts = {}
    for (const card of cards) {
      if (card.type === 'scout') {
        scoutCounts[card.name] = (scoutCounts[card.name] || 0) + 1
        if (scoutCounts[card.name] >= 2) {
          console.log(`[验证] ${card.name}探查牌重复(${scoutCounts[card.name]}张)，重新生成`)
          return false
        }
      }
    }
    
    // 检查同一方向的卡牌数量：不能超过2张
    const directionCounts = {}
    for (const card of cards) {
      if (card.direction) {
        directionCounts[card.direction] = (directionCounts[card.direction] || 0) + 1
        if (directionCounts[card.direction] > 2) {
          console.log(`[验证] ${card.direction}方向卡牌过多(${directionCounts[card.direction]}张)，重新生成`)
          return false
        }
      }
    }
    
    // 生成所有C(n,3)组合
    const combinations = this.getCombinations(cards, 3)
    
    // 检查是否至少有一种组合能让玩家有所作为
    let validCombinations = 0
    
    for (const combo of combinations) {
      // 检查玩家1是否有有效操作
      const player1Valid = this.hasValidAction(combo, 0)
      // 检查玩家2是否有有效操作
      const player2Valid = this.hasValidAction(combo, 1)
      
      // 如果这个组合对两名玩家都可行，则合理
      if (player1Valid && player2Valid) {
        validCombinations++
      }
    }
    
    // 至少要有一种组合对双方都可行
    return validCombinations > 0
  }
  
  // 生成所有C(n,k)组合
  getCombinations(arr, k) {
    const result = []
    const combine = (start, combo) => {
      if (combo.length === k) {
        result.push([...combo])
        return
      }
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i])
        combine(i + 1, combo)
        combo.pop()
      }
    }
    combine(0, [])
    return result
  }
  
  // 检查玩家是否有有效操作（移动或攻击）
  hasValidAction(cards, playerIndex) {
    const myPos = this.playerStates[playerIndex].position
    const opponentPos = this.playerStates[1 - playerIndex].position
    
    // 检查是否有有效移动
    const hasValidMove = this.checkValidMove(cards, myPos, opponentPos)
    // 检查是否有有效攻击
    const hasValidAttack = this.checkValidAttack(cards, myPos, opponentPos)
    
    return hasValidMove || hasValidAttack
  }
  
  // 检查是否有有效移动
  checkValidMove(cards, myPos, opponentPos) {
    for (const card of cards) {
      if (card.type !== 'move') continue
      const offset = DIRECTION_OFFSET[card.direction]
      const newX = myPos.x + offset.x
      const newY = myPos.y + offset.y
      
      // 检查是否可以移动到该位置
      if (this.isValidMovePosition(newX, newY, opponentPos)) {
        return true
      }
    }
    return false
  }
  
  // 检查是否有有效攻击
  checkValidAttack(cards, myPos, opponentPos) {
    for (const card of cards) {
      if (card.type !== 'attack') continue
      
      const offset = DIRECTION_OFFSET[card.direction]
      const range = card.range
      
      // 检查攻击路径上是否有对方
      let blocked = false
      for (let i = 1; i <= range; i++) {
        const targetX = myPos.x + offset.x * i
        const targetY = myPos.y + offset.y * i
        
        // 检查边界
        if (targetX < 0 || targetX >= this.map.width || 
            targetY < 0 || targetY >= this.map.height) {
          blocked = true
          break
        }
        
        // 检查障碍
        if (this.map.obstacles.some(o => o.x === targetX && o.y === targetY)) {
          blocked = true
          break
        }
        
        // 检查是否命中对方
        if (targetX === opponentPos.x && targetY === opponentPos.y) {
          return true
        }
      }
    }
    return false
  }
  
  // 检查位置是否可以移动到
  isValidMovePosition(x, y, opponentPos) {
    // 检查边界
    if (x < 0 || x >= this.map.width || y < 0 || y >= this.map.height) {
      return false
    }
    // 检查障碍
    if (this.map.obstacles.some(o => o.x === x && o.y === y)) {
      return false
    }
    // 检查沙丘（阻挡移动）
    if (this.isSandDune(x, y)) {
      return false
    }
    // 检查对方位置
    if (opponentPos.x === x && opponentPos.y === y) {
      return false
    }
    return true
  }
  
  // 选择卡牌（统一处理技能牌和普通牌）
  selectCards(socketId, selectedCardIndices) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    const player = this.playerStates[index]
    
    // 验证选牌数量：统一要求3张（技能牌和普通牌一起计算）
    if (selectedCardIndices.length !== 3) {
      console.error(`[错误] 玩家${index + 1}选择了${selectedCardIndices.length}张牌，应该选择3张`)
      return
    }
    
    // 根据索引从 currentCards 获取实际卡牌对象
    const handCards = selectedCardIndices.map(i => player.currentCards[i]).filter(c => c)
    
    // 检查是否选中了技能牌
    const hasSkillCard = handCards.some(c => c && c.isSkillCard)
    
    // 古城封印校验：封印状态下不允许选择技能牌
    if (hasSkillCard && this.skillSealed) {
      console.log(`[封印] 玩家${index + 1}尝试选择被封印的技能牌，已拒绝`)
      this.io?.to(player.id).emit('private_message', {
        message: `技能已被封印，无法选择！`,
        type: 'warning'
      })
      return
    }
    
    if (hasSkillCard) {
      player.skillSelected = true
      console.log(`[技能] 玩家${index + 1}选中了技能牌`)
    }
    
    // 将选中的牌设置为手牌
    player.selectedCards = selectedCardIndices
    player.handCards = handCards
    player.currentCards = []
    
    console.log(`[选择] 玩家${index + 1}选择了卡牌:`, handCards.map(c => c.name))
    
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    
    if (index === priorityIndex) {
      // 先手玩家选择完毕，通知先手进入排序阶段
      // 注意：此时不通知后手开始选牌，要等先手确认顺序后才通知
      this.phase = GAME_PHASES.ORDERING_PRIORITY
      this.io?.to(player.id).emit('enter_ordering_phase', {
        handCards: player.handCards,
        isPriority: true,
        opponentFirstCard: null
      })
      console.log(`[选择] 先手选完，进入排序阶段`)
      this.triggerAIIfNeeded('ordering_priority')
    } else {
      // 后手玩家选择完毕，通知进入排序阶段
      this.phase = GAME_PHASES.ORDERING_NORMAL
      const priorityIndex = this.isPlayer1Priority ? 0 : 1
      this.io?.to(this.playerStates[index].id).emit('normal_cards_selected', {
        playerIndex: index,
        handCards: this.playerStates[index].handCards,
        opponentFirstCard: this.playerStates[priorityIndex].handCards[0] || null
      })
      // 通知先手玩家能看到后手玩家的第一张牌
      this.io?.to(this.playerStates[priorityIndex].id).emit('opponent_first_card_visible', {
        opponentFirstCard: this.playerStates[index].handCards[0] || null
      })
      
      // AI后手选牌后自动确认顺序
      if (this.isAIMatch && this.aiPlayer && this.aiPlayer.playerIndex === index) {
        this.triggerAIIfNeeded('ordering_normal')
      }
    }
  }
  
  // 确认手牌顺序
  confirmOrder(socketId, handCards) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    const player = this.playerStates[index]
    
    // 检查是否已经确认过顺序
    if (player.orderConfirmed) {
      console.log(`[顺序] 玩家${index + 1}已经确认过顺序，忽略此次请求`)
      return
    }
    
    player.handCards = handCards
    player.orderConfirmed = true
    
    console.log(`[顺序] 玩家${index + 1}确认顺序:`, handCards.map(c => c.name))
    
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    
    if (index === priorityIndex) {
      // 先手玩家确认完毕，给后手玩家发牌
      this.priorityOrderComplete = true
      
      const normalIndex = 1 - priorityIndex
      const handCards = this.playerStates[priorityIndex].handCards
      
      console.log(`[顺序] 先手确认完毕，给后手发牌并通知选择查看`)
      
      // 递增后手玩家的后手回合计数（必须先递增，再检查触发条件）
      this.playerStates[normalIndex].normalTurnsCount = (this.playerStates[normalIndex].normalTurnsCount || 0) + 1
      console.log(`[隔墙有眼] 后手玩家(玩家${normalIndex + 1})后手回合计数: ${this.playerStates[normalIndex].normalTurnsCount}`)
      
      // ========== 女盗贼被动技能：隔墙有眼 ==========
      // 在先手玩家确认顺序后，检查后手玩家是否是女盗贼
      const normalPlayer = this.playerStates[normalIndex]
      const wallSkillTriggered = normalPlayer.skill && normalPlayer.skill.id === 'thief_female' && this.shouldTriggerWallSkill(normalIndex)
      
      // 获取先手玩家的第一张和最后一张手牌
      const firstCard = handCards[0] || null
      const lastCard = handCards[handCards.length - 1] || null
      
      if (wallSkillTriggered) {
        // 标记本次触发了技能，用于跳过观看手牌阶段
        this.wallSkillTriggeredThisRound = true
        console.log(`[隔墙有眼] 女盗贼技能触发！将在发牌时直接发送对手手牌信息`)
        // 不再延迟触发，而是直接在 deal_cards 事件中发送手牌信息
      } else {
        this.wallSkillTriggeredThisRound = false
      }
      
      // 给后手玩家发送卡牌，不显示回合过渡界面
      // 如果女盗贼技能触发，直接在发牌事件中发送对手的第一张和最后一张手牌
      this.io?.to(this.playerStates[normalIndex].id).emit('deal_cards', {
        cards: this.playerStates[normalIndex].currentCards,
        isPriority: false,
        opponentFirstCard: null,
        showRoundTransition: false,  // 后手玩家不显示回合过渡界面
        // 女盗贼技能触发时，直接发送对手的第一张和最后一张手牌
        wallSkillTriggered: wallSkillTriggered,
        opponentFirstAndLastCard: wallSkillTriggered ? {
          firstCard: firstCard ? { id: firstCard.id, name: firstCard.name, icon: firstCard.icon, type: firstCard.type } : null,
          lastCard: lastCard ? { id: lastCard.id, name: lastCard.name, icon: lastCard.icon, type: lastCard.type } : null,
          totalCards: handCards.length
        } : null,
        // 技能冷却信息（修复后手玩家CD显示不同步问题）
        player1Skill: this.playerStates[0].skill,
        player1SkillCooldown: this.playerStates[0].skillCooldown,
        player2Skill: this.playerStates[1].skill,
        player2SkillCooldown: this.playerStates[1].skillCooldown
      })
      
      console.log(`[发牌] 发给后手玩家(玩家${normalIndex + 1})，不显示回合过渡`)
      
      // 通知后手玩家选择要查看先手的第一张还是最后一张牌（延迟发送，等发牌动画完成）
      // 如果女盗贼技能已触发，则跳过观看手牌阶段
      if (!this.wallSkillTriggeredThisRound) {
        setTimeout(() => {
          this.io?.to(this.playerStates[normalIndex].id).emit('choose_opponent_card_to_view', {
            firstCard: handCards[0] || null,
            lastCard: handCards[handCards.length - 1] || null,
            isFirstRound: this.currentRound === 1  // 是否第一回合
          })
          console.log(`[顺序] 通知后手选择查看第一张或最后一张牌`)
          // AI自动查看对手牌
          if (this.isAIMatch && this.aiPlayer && this.aiPlayer.playerIndex === normalIndex) {
            this.triggerAIIfNeeded('view_opponent_card')
          }
        }, 1200)  // 等待发牌动画完成（约1秒）
      } else {
        console.log(`[顺序] 女盗贼技能已触发，跳过观看手牌阶段`)
        // 直接进入选牌阶段，不发 choose_opponent_card_to_view
        // 延迟让发牌动画完成后再进入选牌阶段
        setTimeout(() => {
          this.phase = GAME_PHASES.SELECTING_NORMAL
          this.triggerAIIfNeeded('selecting')
        }, 1500)
      }
      
      // 通知先手玩家能看到后手玩家的第一张牌（当后手选完牌后会有值）
      this.io?.to(this.playerStates[priorityIndex].id).emit('opponent_first_card_visible', {
        opponentFirstCard: null
      })
      
    } else {
      // 后手玩家确认顺序完毕
      
      // ========== 冰原寒流检查（出牌阶段开始前）==========
      this.checkAndTriggerIceFreeze()
      
      // ========== 火山火球检查（出牌阶段开始前）==========
      // 火球伤害在卡牌执行之前计算，如果火球导致玩家死亡则直接结束游戏
      this.checkAndTriggerVolcanoFireball((gameEnded) => {
        // 如果火球导致游戏结束，不再开始出牌阶段
        if (gameEnded) {
          console.log(`[火球] 火球导致玩家死亡，游戏结束，跳过出牌阶段`)
          return
        }

        // ========== 被动技能触发（出牌阶段开始前）==========
        // 天降箭雨等被动技能在此触发，特效播放完毕后再开始出牌
        console.log(`[被动技能] 出牌阶段开始前，检查双方被动技能...`)
        
        let hasPassiveSkill = false
        
        for (let i = 0; i < 2; i++) {
          const player = this.playerStates[i]
          if (player.skill && player.skill.skillType === 'passive') {
            hasPassiveSkill = true
            console.log(`[被动技能] 玩家${i + 1}的被动技能: ${player.skill.id}`)
            this.processPassiveSkill(i)
          }
        }
        
        // 延迟2秒让被动技能特效播放完毕，再开始出牌阶段
        const delayTime = hasPassiveSkill ? 2000 : 0
        
        setTimeout(() => {
          // ========== 男盗贼"盗为己用"预处理（出牌阶段开始前）==========
          // 无论盗为己用牌在手牌中排第几位，都在出牌阶段开始前标记对手第一张牌为无效
          for (let i = 0; i < 2; i++) {
            const player = this.playerStates[i]
            const opponent = this.playerStates[1 - i]
            const hasStealSkill = player.handCards.some(c => c.isSkillCard && c.skillId === 'thief_male')
            if (hasStealSkill && opponent.handCards[0]) {
              opponent.handCards[0].invalidated = true
              console.log(`[盗为己用] 预处理：玩家${i + 1}有盗为己用，标记对手第一张牌【${opponent.handCards[0].name}】为无效`)
              // 通知使用盗为己用的玩家
              this.io?.to(this.playerStates[i].id).emit('private_message', {
                message: `🗡️ 你使用了【盗为己用】！对手的第一张牌将无效`,
                type: 'success'
              })
              // 通知被偷牌的对手（使用"你"）
              this.io?.to(opponent.id).emit('private_message', {
                message: `🗡️ 对手使用了【盗为己用】！你的第一张牌将无效`,
                type: 'warning'
              })
            }
          }
          
          // 开始出牌阶段
          this.phase = GAME_PHASES.PLAYING
          this.turnIndex = 0
          console.log(`[出牌] 开始出牌阶段`)
          console.log(`[出牌] 先手玩家: ${this.isPlayer1Priority ? '玩家1' : '玩家2'}`)
          console.log(`[出牌] 玩家1手牌:`, this.playerStates[0].handCards.map(c => c.name))
          console.log(`[出牌] 玩家2手牌:`, this.playerStates[1].handCards.map(c => c.name))
          
          // 发送完整状态给所有玩家，包括各自的手牌
          const state = this.getState()
          state.player1Hand = this.playerStates[0].handCards
          state.player2Hand = this.playerStates[1].handCards
          
          // 通知先手玩家可以出牌
          this.io?.to(this.playerStates[priorityIndex].id).emit('your_turn_to_play')
          
          this.io?.to(this.roomCode).emit('all_orders_complete', state)
          this.triggerAIIfNeeded('playing')
        }, delayTime)
      })
    }
  }
  
  // ========== 寒流回合快速跳过处理 ==========
  handleFrozenRound() {
    console.log(`[寒流] 处理寒流回合，展示双方冻结的手牌`)
    
    // 发送寒流回合事件，通知客户端直接展示双方手牌（跳过逐张出牌）
    const state = this.getState()
    state.player1Hand = this.playerStates[0].handCards
    state.player2Hand = this.playerStates[1].handCards
    
    this.io?.to(this.roomCode).emit('frozen_round_cards', {
      state: state,
      message: '❄️ 寒流来袭！本回合所有卡牌效果被冻结！'
    })
    
    // 2秒后自动结束回合
    setTimeout(() => {
      console.log(`[寒流] 寒流回合结束，进入下一回合`)
      this.endRound()
    }, 2000)
  }
  
  // 后手玩家选择查看先手的手牌
  viewOpponentCard(socketId, choice) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    
    // 只有后手玩家可以选择
    if (index === priorityIndex) {
      console.log(`[查看] 先手玩家不能选择查看`)
      return
    }
    
    const handCards = this.playerStates[priorityIndex].handCards
    let viewedCard = null
    
    if (choice === 'first') {
      viewedCard = handCards[0]
    } else if (choice === 'last') {
      viewedCard = handCards[handCards.length - 1]
    }
    
    console.log(`[查看] 后手玩家选择查看先手的${choice === 'first' ? '第一张' : '最后一张'}牌: ${viewedCard?.name}`)
    
    // 通知先手玩家：对方选择查看了你的第几张牌
    this.io?.to(this.playerStates[priorityIndex].id).emit('opponent_viewed_card_info', {
      choice: choice  // 'first' 或 'last'
    })
    
    // 通知后手玩家进入选牌阶段，并显示查看的牌
    this.io?.to(this.playerStates[index].id).emit('opponent_card_viewed', {
      viewedCard: viewedCard,
      choice: choice
    })
    
    // AI查看对手牌后自动进入选牌阶段
    if (this.isAIMatch && this.aiPlayer && this.aiPlayer.playerIndex === index) {
      this.phase = GAME_PHASES.SELECTING_NORMAL
      this.triggerAIIfNeeded('selecting')
    }
  }
  
  // 出牌
  playCard(socketId) {
    if (this.phase !== GAME_PHASES.PLAYING) {
      console.log(`[出牌] 当前阶段不是PLAYING: ${this.phase}`)
      return
    }
    
    const playerIndex = this.getPlayerIndex(socketId)
    if (playerIndex === -1) return
    
    // 计算当前应该是哪个玩家出牌
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    const turnInPair = this.turnIndex % 2
    // turnInPair=0时，优先玩家出牌；turnInPair=1时，非优先玩家出牌
    const expectedPlayerIndex = turnInPair === 0 ? priorityIndex : 1 - priorityIndex
    
    if (playerIndex !== expectedPlayerIndex) {
      console.log(`[出牌] 不是该玩家的回合: 玩家${playerIndex + 1}，应该是玩家${expectedPlayerIndex + 1}`)
      return
    }
    
    const player = this.playerStates[playerIndex]
    const cardIndex = Math.floor(this.turnIndex / 2)
    const card = player.handCards[cardIndex]
    
    if (!card) {
      console.error(`[出牌] 玩家${playerIndex + 1}没有可出的牌`)
      return
    }
    
    console.log(`[出牌] 玩家${playerIndex + 1}出牌: ${card.name}`)
    
    // 1. 先发送"牌被打出"的事件（显示牌被打出的动画，turnIndex还没增加）
    this.io?.to(this.roomCode).emit('card_played', {
      playerIndex: playerIndex,
      card: card,
      cardIndex: cardIndex,
      turnIndex: this.turnIndex
    })
    
    // 2. 延迟1.5秒后执行卡牌效果
    setTimeout(() => {
      // 检查牌是否被无效化（男盗贼技能）
      if (card.invalidated) {
        console.log(`[出牌] 玩家${playerIndex + 1}的牌【${card.name}】已被无效化，跳过执行`)
        this.io?.to(this.roomCode).emit('game_message', {
          message: `玩家${playerIndex + 1}的【${card.name}】被无效化！`,
          type: 'warning'
        })
        // 发送牌被打出但无效的事件
        this.io?.to(this.roomCode).emit('card_invalidated', {
          playerIndex: playerIndex,
          card: card,
          cardIndex: cardIndex
        })
        // 跳过执行，直接进入下一轮
        this.turnIndex++
        this.io?.to(this.roomCode).emit('turn_played', this.getState())
        
        // 检查回合是否结束
        if (this.turnIndex >= GAME_CONFIG.HAND_SIZE * 2) {
          setTimeout(() => {
            this.endRound()
          }, 2000)
        }
        return
      }
      
      // 执行卡牌效果
      this.executeCard(playerIndex, card)
      
      // 检查游戏是否结束
      if (this.checkGameEnd()) return
      
      this.turnIndex++
      
      // 先发送状态更新，让客户端看到最后一张牌的效果
      this.io?.to(this.roomCode).emit('turn_played', this.getState())
      
      this.triggerAIIfNeeded('playing')
      
      // 检查回合是否结束 (3对牌，每对2次出牌)
      if (this.turnIndex >= GAME_CONFIG.HAND_SIZE * 2) {
        // 延迟2秒后再结束回合，让玩家看到最后一张牌的效果
        setTimeout(() => {
          this.endRound()
        }, 2000)
      }
    }, 1500)
  }
  
  // 执行卡牌效果
  executeCard(playerIndex, card) {
    const player = this.playerStates[playerIndex]
    
    // ========== 冰原寒流检查 ==========
    // 如果本回合被冻结，跳过卡牌效果执行
    if (this.frozenThisRound) {
      console.log(`[寒流] 玩家${playerIndex + 1}的牌【${card.name}】被寒流冻结，效果无效`)
      this.io?.to(this.roomCode).emit('card_frozen', {
        playerIndex: playerIndex,
        card: card
      })
      this.io?.to(this.roomCode).emit('game_message', {
        message: `❄️ 玩家${playerIndex + 1}的【${card.name}】被寒流冻结，效果无效！`,
        type: 'warning'
      })
      return  // 直接返回，不执行任何效果
    }
    
    // 如果打出的是非防御牌，清除该玩家的防御状态
    if (card.type !== 'defense' && card.type !== 'skill' && player.isDefending) {
      player.isDefending = false
      // 发送防御失效事件（让客户端清除护盾特效）
      this.io?.to(this.roomCode).emit('defense_expired', {
        playerIndex: playerIndex
      })
      this.io?.to(this.roomCode).emit('game_message', {
        message: `玩家${playerIndex + 1}出牌后，防御状态失效`,
        type: 'warning',
        playerIndex: playerIndex
      })
    }
    
    if (card.type === 'skill') {
      // 执行技能
      this.executeSkill(playerIndex, card)
    } else if (card.type === 'move') {
      this.executeMove(playerIndex, card.direction)
    } else if (card.type === 'attack') {
      this.executeAttack(playerIndex, card.direction, card.range)
    } else if (card.type === 'defense') {
      player.isDefending = true
      // 发送防御激活特效
      this.io?.to(this.roomCode).emit('defense_activated', {
        playerIndex: playerIndex
      })
      this.io?.to(this.roomCode).emit('game_message', {
        message: `玩家${playerIndex + 1}进入防御状态`,
        type: 'info',
        playerIndex: playerIndex
      })
    } else if (card.type === 'scout') {
      this.executeScout(playerIndex, card.scoutType)
    }
  }
  
  // ========== 技能执行方法 ==========
  
  // 执行技能
  executeSkill(playerIndex, card) {
    const player = this.playerStates[playerIndex]
    const skillId = card.skillId
    
    // 设置冷却
    if (player.skill && player.skill.cooldown) {
      player.skillCooldown = player.skill.cooldown
    }
    player.skillSelected = true
    
    console.log(`[技能] 玩家${playerIndex + 1}使用技能: ${skillId}`)
    
    // 根据技能ID执行对应效果
    switch (skillId) {
      case 'mage_male':
        this.executeMeteorSkill(playerIndex)
        break
      case 'knight_male':
        this.executeWhirlwindSkill(playerIndex)
        break
      case 'reader_male':
        this.executeHistorySkill(playerIndex)
        break
      case 'archer_male':
        this.executePierceSkill(playerIndex)
        break
      case 'thief_male':
        this.executeStealSkill(playerIndex, card)
        break
      default:
        console.log(`[技能] 未知技能ID: ${skillId}`)
    }
  }
  
  // 男法师 - 天降陨石：攻击对手，造成 m=ceil(sqrt(面积)/2) 点伤害
  executeMeteorSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    
    // 计算陨石数量：m = ceil(sqrt(面积)/2)
    const area = this.map.width * this.map.height
    const m = Math.ceil(Math.sqrt(area) / 2)
    
    console.log(`[技能] 天降陨石: 地图面积=${area}, 陨石数量=${m}`)
    
    // 生成所有可攻击的格子（排除边界）
    const validCells = []
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        // 排除边界障碍物
        const isBoundary = this.map.obstacles?.some(o => o.x === x && o.y === y && o.isBoundary)
        if (!isBoundary) {
          validCells.push({ x, y })
        }
      }
    }
    
    // 随机选择 m 个不重复的格子
    const targetCells = []
    const shuffled = [...validCells].sort(() => Math.random() - 0.5)
    for (let i = 0; i < Math.min(m, shuffled.length); i++) {
      targetCells.push(shuffled[i])
    }
    
    console.log(`[技能] 天降陨石: 目标格子`, targetCells)
    
    // 发送技能特效（多个目标）
    this.io?.to(this.roomCode).emit('skill_effect', {
      skillId: 'mage_male_meteor',
      playerIndex: playerIndex,
      targetCells: targetCells
    })
    
    // 对每个目标格子进行处理
    for (const cell of targetCells) {
      // 检查是否命中玩家
      if (opponent.position.x === cell.x && opponent.position.y === cell.y) {
        // 命中对手
        if (opponent.isDefending) {
          opponent.isDefending = false
          this.io?.to(this.roomCode).emit('defense_broken', {
            playerIndex: 1 - playerIndex
          })
          this.io?.to(this.roomCode).emit('game_message', {
            message: `☄️ 天降陨石命中玩家${1 - playerIndex + 1}，但被防御！`,
            type: 'warning'
          })
        } else {
          opponent.hp -= 1
          this.io?.to(this.roomCode).emit('game_message', {
            message: `☄️ 天降陨石命中玩家${1 - playerIndex + 1}！血量-1`,
            type: 'error'
          })
        }
      }
      // 注意：陨石不会攻击施法者自身（已排除）
      {
        // 检查是否命中障碍物
        const obstacleIndex = this.map.obstacles?.findIndex(o => o.x === cell.x && o.y === cell.y && !o.isBoundary)
        if (obstacleIndex !== -1 && obstacleIndex !== undefined) {
          // 摧毁障碍物
          const destroyedObstacle = this.map.obstacles.splice(obstacleIndex, 1)[0]
          this.io?.to(this.roomCode).emit('obstacle_destroyed', {
            position: { x: cell.x, y: cell.y },
            obstacle: destroyedObstacle
          })
          this.io?.to(this.roomCode).emit('game_message', {
            message: `☄️ 天降陨石摧毁了障碍物！`,
            type: 'success'
          })
          console.log(`[技能] 天降陨石: 摧毁障碍物(${cell.x}, ${cell.y})`)
        }
        
        // 检查是否命中传送门
        const portalIndex = this.map.portals?.findIndex(p => 
          (p.entry.x === cell.x && p.entry.y === cell.y) || 
          (p.exit.x === cell.x && p.exit.y === cell.y)
        )
        if (portalIndex !== -1 && portalIndex !== undefined) {
          // 成对摧毁传送门（入口和出口）
          const destroyedPortal = this.map.portals.splice(portalIndex, 1)[0]
          this.io?.to(this.roomCode).emit('portal_destroyed', {
            position: { x: cell.x, y: cell.y },
            portal: destroyedPortal
          })
          this.io?.to(this.roomCode).emit('game_message', {
            message: `☄️ 天降陨石摧毁了传送门！`,
            type: 'success'
          })
          console.log(`[技能] 天降陨石: 摧毁传送门`, destroyedPortal)
        }
      }
    }
    
    // 检查游戏结束
    this.checkGameEnd()
  }
  
  // 男骑士 - 旋风斩：攻击周围8格的所有敌人
  executeWhirlwindSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    
    // 8个方向偏移
    const directions = [
      { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 0 },                   { dx: 1, dy: 0 },
      { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
    ]
    
    // 检查对手是否在周围8格
    const dx = opponent.position.x - player.position.x
    const dy = opponent.position.y - player.position.y
    const isInRange = directions.some(d => d.dx === dx && d.dy === dy)
    
    // 发送技能特效
    this.io?.to(this.roomCode).emit('skill_effect', {
      skillId: 'knight_male_whirlwind',
      playerIndex: playerIndex,
      position: player.position
    })
    
    if (isInRange) {
      // 检查防御
      if (opponent.isDefending) {
        opponent.isDefending = false
        this.io?.to(this.roomCode).emit('defense_broken', {
          playerIndex: 1 - playerIndex
        })
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🌀 旋风斩被防御！玩家${1 - playerIndex + 1}防御破碎`,
          type: 'warning'
        })
      } else {
        opponent.hp -= 1
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🌀 旋风斩命中！玩家${1 - playerIndex + 1}受到1点伤害`,
          type: 'error'
        })
      }
      this.checkGameEnd()
    } else {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🌀 旋风斩释放！但对手不在攻击范围内`,
        type: 'info'
      })
    }
  }
  
  // 记录历史视野（男阅读者技能用）
  recordHistoryVision(playerIndex) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    
    // 计算当前位置的视野范围（与迷雾系统一致）
    const visionRange = 2  // 视野范围：周围2格
    const visionCells = []
    
    for (let dx = -visionRange; dx <= visionRange; dx++) {
      for (let dy = -visionRange; dy <= visionRange; dy++) {
        const targetX = player.position.x + dx
        const targetY = player.position.y + dy
        
        // 检查边界
        if (targetX < 0 || targetX >= this.map.width || 
            targetY < 0 || targetY >= this.map.height) {
          continue
        }
        
        // 检查是否为边界障碍物（特色地形地图的边界）
        const isBoundary = this.map.obstacles.some(o => o.x === targetX && o.y === targetY && o.isBoundary)
        if (isBoundary) {
          continue
        }
        
        visionCells.push({ x: targetX, y: targetY })
      }
    }
    
    // 将新视野格子添加到历史记录（去重）
    for (const cell of visionCells) {
      const exists = player.historyVision.some(v => v.x === cell.x && v.y === cell.y)
      if (!exists) {
        player.historyVision.push(cell)
      }
    }
    
    console.log(`[历史视野] 玩家${playerIndex + 1}记录视野: +${visionCells.length}格, 总计: ${player.historyVision.length}格`)
  }
  
  // 男阅读者 - 回忆过去：查看历史视野覆盖过的所有格子
  executeHistorySkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    
    // 获取自己的历史视野记录
    const myHistoryVision = player.historyVision || []
    
    // 发送技能特效（看到自己曾经看到过的所有格子）
    this.io?.to(this.playerStates[playerIndex].id).emit('skill_effect', {
      skillId: 'reader_male_history',
      playerIndex: playerIndex,
      historyVision: myHistoryVision
    })
    
    this.io?.to(this.roomCode).emit('game_message', {
      message: `📖 玩家${playerIndex + 1}使用回忆过去，回顾了自己的历史视野区域`,
      type: 'info'
    })
    
    console.log(`[技能] 回忆过去: 玩家${playerIndex + 1}查看自己历史视野(${myHistoryVision.length}格)`)
  }
  
  // 男弓箭手 - 百步穿杨：四向穿透攻击
  executePierceSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    
    let hit = false
    const directions = [
      { dx: 0, dy: -1, name: '上' },
      { dx: 0, dy: 1, name: '下' },
      { dx: -1, dy: 0, name: '左' },
      { dx: 1, dy: 0, name: '右' }
    ]
    
    // 检查四个方向
    for (const dir of directions) {
      // 沿方向检查整条线
      for (let i = 1; i < Math.max(this.map.width, this.map.height); i++) {
        const targetX = player.position.x + dir.dx * i
        const targetY = player.position.y + dir.dy * i
        
        // 检查边界
        if (targetX < 0 || targetX >= this.map.width || 
            targetY < 0 || targetY >= this.map.height) {
          break
        }
        
        // 检查障碍物（被阻挡则停止该方向搜索）
        if (this.map.obstacles.some(o => o.x === targetX && o.y === targetY && !o.isBoundary)) {
          break
        }
        
        // 检查是否命中对手
        if (opponent.position.x === targetX && opponent.position.y === targetY) {
          hit = true
          break
        }
      }
      if (hit) break
    }
    
    // 发送技能特效
    this.io?.to(this.roomCode).emit('skill_effect', {
      skillId: 'archer_male_pierce',
      playerIndex: playerIndex,
      position: player.position
    })
    
    if (hit) {
      if (opponent.isDefending) {
        opponent.isDefending = false
        this.io?.to(this.roomCode).emit('defense_broken', {
          playerIndex: 1 - playerIndex
        })
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🏹 百步穿杨被防御！玩家${1 - playerIndex + 1}防御破碎`,
          type: 'warning'
        })
      } else {
        opponent.hp -= 1
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🏹 百步穿杨命中！远距离击中玩家${1 - playerIndex + 1}`,
          type: 'error'
        })
      }
      this.checkGameEnd()
    } else {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🏹 百步穿杨释放！但四向均无敌人`,
        type: 'info'
      })
    }
  }
  
  // 男盗贼 - 盗为己用：复制对手第一张牌并使其无效
  // 注意：对手第一张牌的invalidated标记已在出牌阶段开始前（confirmOrder中）预处理完成
  executeStealSkill(playerIndex, card) {
    const opponent = this.playerStates[1 - playerIndex]
    const opponentHand = opponent.handCards

    // 获取对手第一张牌
    const firstCard = opponentHand[0]

    if (!firstCard) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🗡️ 盗为己用失败！对手没有可偷的牌`,
        type: 'warning'
      })
      return
    }

    // 发送技能特效
    this.io?.to(this.roomCode).emit('skill_effect', {
      skillId: 'thief_male_steal',
      playerIndex: playerIndex,
      stolenCard: firstCard
    })

    // 确保对手第一张牌标记为无效（双重保险，正常情况下已在confirmOrder中预处理）
    firstCard.invalidated = true

    // 将偷来的牌加入玩家手牌（立即执行效果）
    this.io?.to(this.roomCode).emit('game_message', {
      message: `🗡️ 盗为己用！偷取并复制对手的【${firstCard.name}】，对手的牌无效`,
      type: 'success'
    })

    // 执行偷来的牌的效果
    setTimeout(() => {
      this.executeCard(playerIndex, { ...firstCard, id: `stolen_${firstCard.id}`, invalidated: false })
    }, 1000)
  }
  
  // 执行移动
  executeMove(playerIndex, direction) {
    const player = this.playerStates[playerIndex]
    const offset = DIRECTION_OFFSET[direction]
    const newX = player.position.x + offset.x
    const newY = player.position.y + offset.y
    const opponent = this.playerStates[1 - playerIndex]
    
    // 记录旧位置用于特效
    const oldPos = { x: player.position.x, y: player.position.y }
    
    // 检查边界（使用正确的地图尺寸）
    if (newX < 0 || newX >= this.map.width || newY < 0 || newY >= this.map.height) {
      // 超出边界，发送私密提示（只给操作者）
      this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
        message: `无法移动：超出边界`,
        type: 'warning'
      })
      return false
    }
    
    // 检查障碍
    if (this.map.obstacles.some(o => o.x === newX && o.y === newY)) {
      // 障碍物，发送私密提示（只给操作者）
      this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
        message: `无法移动：前方有障碍物`,
        type: 'warning'
      })
      return false
    }
    
    // 检查沙丘
    if (this.isSandDune(newX, newY)) {
      this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
        message: `无法移动：前方有沙丘`,
        type: 'warning'
      })
      return false
    }
    
    // 检查对方位置
    if (opponent.position.x === newX && opponent.position.y === newY) {
      // 对方位置，发送私密提示（只给操作者）
      this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
        message: `无法移动：对方在此位置`,
        type: 'warning'
      })
      return false
    }
    
    // 发送移动特效
    this.io?.to(this.roomCode).emit('move_effect', {
      playerIndex: playerIndex,
      from: oldPos,
      to: { x: newX, y: newY },
      direction: direction
    })
    
    player.position.x = newX
    player.position.y = newY
    
    // 更新隐藏状态（草丛）
    this.updateHiddenState(playerIndex)
    
    // ========== 记录历史视野（男阅读者技能用）==========
    this.recordHistoryVision(playerIndex)
    
    // 检查是否踩到传送门进口
    const portal = this.checkPortalEntry(player.position)
    if (portal) {
      // 延迟触发传送，让移动特效先播放
      setTimeout(() => {
        this.teleportPlayer(playerIndex, portal)
      }, 600)
    }
    
    return true
  }
  
  // 执行攻击
  executeAttack(playerIndex, direction, range) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    const offset = DIRECTION_OFFSET[direction]
    
    // ========== 女骑士攻击范围+1 ==========
    let actualRange = range
    if (player.skill && player.skill.id === 'knight_female' && !this.skillSealed) {
      actualRange = range + 1
      console.log(`[被动] 坚韧突刺：攻击范围+1，${range} → ${actualRange}`)
    } else if (player.skill && player.skill.id === 'knight_female' && this.skillSealed) {
      console.log(`[封印] 古城技能封印：女骑士攻击范围+1无效`)
    }
    
    // 记录攻击路径（用于特效）
    const attackPath = [{ x: player.position.x, y: player.position.y }]
    
    // 逐格检查攻击路径
    for (let i = 1; i <= actualRange; i++) {
      const targetX = player.position.x + offset.x * i
      const targetY = player.position.y + offset.y * i
      attackPath.push({ x: targetX, y: targetY })
      
      // 检查边界（使用正确的地图尺寸）
      if (targetX < 0 || targetX >= this.map.width || targetY < 0 || targetY >= this.map.height) {
        // 超出边界，发送特效后返回
        this.io?.to(this.roomCode).emit('attack_effect', {
          from: player.position,
          to: { x: targetX, y: targetY },
          direction,
          range: actualRange,
          hit: false
        })
        // 私密提示（只给操作者）
        this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
          message: `攻击超出边界！`,
          type: 'warning'
        })
        return false
      }
      
      // 检查障碍
      const obstacleIndex = this.map.obstacles.findIndex(o => o.x === targetX && o.y === targetY && !o.isBoundary)
      if (obstacleIndex !== -1) {
        // ========== 女法师爆裂攻击：摧毁障碍物 ==========
        if (player.skill && player.skill.id === 'mage_female' && !this.skillSealed) {
          // 移除障碍物
          const destroyedObstacle = this.map.obstacles.splice(obstacleIndex, 1)[0]
          this.io?.to(this.roomCode).emit('obstacle_destroyed', {
            position: { x: targetX, y: targetY },
            obstacle: destroyedObstacle
          })
          this.io?.to(this.roomCode).emit('game_message', {
            message: `💥 爆裂攻击！玩家${playerIndex + 1}摧毁了障碍物`,
            type: 'success'
          })
          console.log(`[被动] 爆裂攻击：摧毁障碍物(${targetX}, ${targetY})`)
          // 继续攻击，不返回
        } else {
          // 被障碍阻挡，发送特效和提示后返回
          // 私密提示（只给操作者）
          this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
            message: `攻击被障碍阻挡！`,
            type: 'warning'
          })
          this.io?.to(this.roomCode).emit('attack_effect', {
            from: player.position,
            to: { x: targetX, y: targetY },
            direction,
            range: actualRange,
            hit: false
          })
          return false
        }
      }
      
      // 检查当前位置是否有对方玩家
      if (opponent.position.x === targetX && opponent.position.y === targetY) {
        // 检查防御
        if (opponent.isDefending) {
          opponent.isDefending = false
          // 发送防御破碎特效
          this.io?.to(this.roomCode).emit('defense_broken', {
            playerIndex: 1 - playerIndex
          })
          this.io?.to(this.roomCode).emit('game_message', {
            message: `玩家${playerIndex + 1}攻击被防御！`,
            type: 'success',
            playerIndex: playerIndex
          })
        } else {
          opponent.hp--
          this.io?.to(this.roomCode).emit('game_message', {
            message: `玩家${playerIndex + 1}攻击命中！玩家${1 - playerIndex + 1}血量-1`,
            type: 'error',
            playerIndex: playerIndex
          })
        }
        // 发送命中特效
        this.io?.to(this.roomCode).emit('attack_effect', {
          from: player.position,
          to: { x: targetX, y: targetY },
          direction,
          range,
          hit: true
        })
        return true
      }
    }
    
    // 攻击落空，发送空放特效和提示
    const finalX = player.position.x + offset.x * range
    const finalY = player.position.y + offset.y * range
    // 私密提示（只给操作者）
    this.io?.to(this.playerStates[playerIndex].id).emit('private_message', {
      message: `攻击落空！路径上无玩家`,
      type: 'warning'
    })
    this.io?.to(this.roomCode).emit('attack_effect', {
      from: player.position,
      to: { x: finalX, y: finalY },
      direction,
      range,
      hit: false
    })
    return false
  }
  
  // 执行探查
  executeScout(playerIndex, scoutType) {
    const player = this.playerStates[playerIndex]
    
    // ========== 女阅读者被动：深度求索 ==========
    // 环绕探查范围+1
    let actualScoutType = scoutType
    let scoutBonus = 0
    
    if (player.skill && player.skill.id === 'reader_female' && scoutType === 'around' && !this.skillSealed) {
      scoutBonus = 1
      console.log(`[被动] 深度求索：环绕探查范围+1`)
    } else if (player.skill && player.skill.id === 'reader_female' && scoutType === 'around' && this.skillSealed) {
      console.log(`[封印] 古城技能封印：女阅读者深度求索无效`)
    }
    
    // 记录探查效果
    const scoutEffect = {
      type: actualScoutType,
      position: { ...player.position },
      playerIndex: playerIndex,
      bonus: scoutBonus  // 探查范围加成
    }
    
    // 添加到玩家探查效果数组
    player.scoutEffects.push(scoutEffect)
    
    // 只发给打出探查牌的玩家（私密效果，对手不可见）
    this.io?.to(this.playerStates[playerIndex].id).emit('scout_effect', {
      playerIndex: playerIndex,
      scoutType: actualScoutType,
      position: player.position,
      bonus: scoutBonus
    })
    
    // 如果有范围加成，发送特殊消息
    if (scoutBonus > 0) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `📖 玩家${playerIndex + 1}使用深度环绕探查（范围+1）`,
        type: 'info',
        playerIndex: playerIndex
      })
    } else {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `玩家${playerIndex + 1}使用了${scoutType === 'row' ? '行探查' : scoutType === 'col' ? '列探查' : '环绕探查'}`,
        type: 'info',
        playerIndex: playerIndex
      })
    }
    
    console.log(`[探查] 玩家${playerIndex + 1}使用${scoutType}探查${scoutBonus > 0 ? '（范围+' + scoutBonus + '）' : ''}`)
    return true
  }
  
  // 检查游戏结束
  checkGameEnd() {
    if (this.playerStates[0].hp <= 0 && this.playerStates[1].hp <= 0) {
      this.winner = 'draw'
      this.phase = GAME_PHASES.GAME_END
      // 发送玩家死亡事件（用于播放死亡音效）
      this.io?.to(this.roomCode).emit('player_died', { playerIndex: 0 })
      this.io?.to(this.roomCode).emit('player_died', { playerIndex: 1 })
      this.io?.to(this.roomCode).emit('game_message', {
        message: '⚔️ 双方同时受到致命攻击，平局！',
        type: 'error'
      })
      console.log(`[游戏] 游戏结束: 平局`)
      
      // 延迟3.5秒后显示游戏结束画面
      setTimeout(() => {
        this.io?.to(this.roomCode).emit('game_message', {
          message: '即将重新开始...',
          type: 'info'
        })
        this.io?.to(this.roomCode).emit('game_end', { winner: 'draw' })
        
        // 平局后3秒自动重新开始
        setTimeout(() => {
          this.reset()
        }, 3000)
      }, 3500)
      return true
    } else if (this.playerStates[0].hp <= 0) {
      this.winner = this.playerStates[1].id
      this.phase = GAME_PHASES.GAME_END
      // 发送玩家死亡事件（用于播放死亡音效）
      this.io?.to(this.roomCode).emit('player_died', { playerIndex: 0 })
      this.io?.to(this.roomCode).emit('game_message', {
        message: '💀 玩家1被击败！玩家2获胜！',
        type: 'error'
      })
      console.log(`[游戏] 游戏结束: 玩家2胜利`)
      
      // 延迟3.5秒后显示游戏结束画面
      setTimeout(() => {
        this.io?.to(this.roomCode).emit('game_end', { winner: this.playerStates[1].id })
      }, 3500)
      return true
    } else if (this.playerStates[1].hp <= 0) {
      this.winner = this.playerStates[0].id
      this.phase = GAME_PHASES.GAME_END
      // 发送玩家死亡事件（用于播放死亡音效）
      this.io?.to(this.roomCode).emit('player_died', { playerIndex: 1 })
      this.io?.to(this.roomCode).emit('game_message', {
        message: '💀 玩家2被击败！玩家1获胜！',
        type: 'error'
      })
      console.log(`[游戏] 游戏结束: 玩家1胜利`)
      
      // 延迟3.5秒后显示游戏结束画面
      setTimeout(() => {
        this.io?.to(this.roomCode).emit('game_end', { winner: this.playerStates[0].id })
      }, 3500)
      return true
    }
    return false
  }
  
  // 结束回合
  endRound() {
    this.currentRound++
    // 交换先手玩家
    this.isPlayer1Priority = !this.isPlayer1Priority
    this.turnIndex = 0
    this.priorityOrderComplete = false
    
    // 重置冰原寒流状态
    this.frozenThisRound = false
    
    console.log(`[回合] 第${this.currentRound}回合开始，先手: ${this.isPlayer1Priority ? '玩家1' : '玩家2'}`)
    
    // 沙漠主题：移动沙丘
    if (this.theme && this.theme.sandDuneEnabled) {
      this.moveSandDunes()
    }
    
    // 检查是否有未使用的防御状态，如果有则发送提示
    if (this.playerStates[0].isDefending) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `玩家1防御未使用，回合结束后失效`,
        type: 'warning'
      })
    }
    if (this.playerStates[1].isDefending) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `玩家2防御未使用，回合结束后失效`,
        type: 'warning'
      })
    }
    
    // 重置防御状态
    this.playerStates[0].isDefending = false
    this.playerStates[1].isDefending = false
    this.playerStates[0].selectedCards = []
    this.playerStates[0].orderConfirmed = false
    this.playerStates[1].selectedCards = []
    this.playerStates[1].orderConfirmed = false
    
    // ========== 技能冷却处理 ==========
    for (let i = 0; i < 2; i++) {
      const player = this.playerStates[i]
      
      // 减少冷却
      if (player.skillCooldown > 0) {
        player.skillCooldown--
        console.log(`[冷却] 玩家${i + 1}技能冷却: ${player.skillCooldown}`)
      }
      
      // 重置技能选择状态
      player.skillSelected = false
      
      // 注意：被动技能处理移到发牌前执行，避免特效被回合过渡动画遮挡
    }
    
    // 发送回合结束消息
    this.io?.to(this.roomCode).emit('round_end', this.getState())
    
    // 开始新回合，给先手玩家发牌
    // 注意：被动技能（天降箭雨等）已移到后手确认顺序后触发（confirmOrder方法中）
    setTimeout(() => {
      this.dealCardsToPriorityPlayer()
    }, 100)
  }
  
  // ========== 冰原寒流特性 ==========
  
  // 检查并触发冰原寒流
  checkAndTriggerIceFreeze() {
    // 检查是否是冰原主题
    if (!this.theme || this.theme.id !== 'ice') {
      console.log(`[寒流] 非冰原主题，跳过寒流检查`)
      return
    }
    
    // 检查是否已经触发过寒流
    if (this.frozenThisRound) {
      console.log(`[寒流] 本回合已触发过寒流，跳过`)
      return
    }
    
    // 20%概率
    const chance = 0.20
    const triggered = Math.random() < chance
    
    if (triggered) {
      this.frozenThisRound = true
      console.log(`[寒流] 冰原寒流触发！本回合所有出牌效果被冻结`)
      
      // 发送寒流触发事件
      this.io?.to(this.roomCode).emit('cold_wave_triggered', {
        message: '❄️ 寒流来袭！本回合所有卡牌效果被冻结！'
      })
      
      this.io?.to(this.roomCode).emit('game_message', {
        message: `❄️ 寒流来袭！本回合所有出牌效果被冻结！`,
        type: 'warning'
      })
    } else {
      console.log(`[寒流] 冰原寒流未触发`)
    }
  }
  
  // ========== 火山火球特性 ==========

  // 检查并触发火山火球
  // onComplete: 火球处理完毕后的回调，参数为 gameEnded(是否导致游戏结束)
  checkAndTriggerVolcanoFireball(onComplete) {
    // 检查是否为火山主题
    if (this.theme?.id !== 'volcano') {
      if (onComplete) onComplete(false)
      return
    }

    console.log(`[火球] 火山火球事件触发！`)

    // 生成火球
    const fireballs = this.generateFireballs()

    if (fireballs.length > 0) {
      // 发送火球事件给客户端（先播放动画）
      this.io?.to(this.roomCode).emit('fireball_event', {
        fireballs: fireballs,
        message: '🔥 火山喷发！天降火球！'
      })

      this.io?.to(this.roomCode).emit('game_message', {
        message: '🔥 火山喷发！天降火球！',
        type: 'warning'
      })

      // 延迟处理火球伤害（等待动画播放）
      setTimeout(() => {
        const gameEnded = this.processFireballDamage(fireballs)
        if (onComplete) onComplete(gameEnded)
      }, 2000) // 2秒后处理伤害
    } else {
      if (onComplete) onComplete(false)
    }
  }

  // 生成火球位置和数量
  generateFireballs() {
    const width = this.map.width
    const height = this.map.height
    const area = width * height

    // 计算火球数量：m = 向上取整(地图面积开平方 ÷ 2)
    const m = Math.ceil(Math.sqrt(area) / 2)

    console.log(`[火球] 地图 ${width}x${height}，面积 ${area}，生成 ${m} 个火球`)

    // 获取所有有效格子（非边界障碍物的格子）
    const validCells = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // 排除边界障碍物
        const obstacle = this.map.obstacles?.find(o => o.x === x && o.y === y)
        if (obstacle?.isBoundary) continue

        // 特色地形检查：只选择有效区域内的格子
        if (this.map.isShapeMap && this.map.shapeLayout) {
          if (this.map.shapeLayout[y]?.[x] !== 1) continue
        }

        validCells.push({ x, y })
      }
    }

    // 随机选择 m 个格子
    const shuffledCells = validCells.sort(() => Math.random() - 0.5)
    const fireballs = shuffledCells.slice(0, m).map((cell, index) => ({
      id: `fireball_${index}_${Date.now()}`,
      x: cell.x,
      y: cell.y
    }))

    console.log(`[火球] 生成火球位置:`, fireballs.map(f => `(${f.x},${f.y})`).join(', '))

    return fireballs
  }

  // 处理火球伤害（摧毁障碍物、传送门，以及玩家HP伤害）
  processFireballDamage(fireballs) {
    const destroyedObstacles = []
    const destroyedPortals = []
    const hitPlayers = []  // 被火球击中的玩家信息

    for (const fireball of fireballs) {
      // 检查是否命中障碍物
      const obstacleIndex = this.map.obstacles.findIndex(
        o => o.x === fireball.x && o.y === fireball.y && !o.isBoundary
      )
      if (obstacleIndex !== -1) {
        const obstacle = this.map.obstacles[obstacleIndex]
        destroyedObstacles.push({ ...obstacle })
        this.map.obstacles.splice(obstacleIndex, 1)
        console.log(`[火球] 摧毁障碍物: (${fireball.x},${fireball.y})`)
      }

      // 检查是否命中传送门
      const portalIndex = this.map.portals.findIndex(
        p => (p.entry.x === fireball.x && p.entry.y === fireball.y) ||
             (p.exit.x === fireball.x && p.exit.y === fireball.y)
      )
      if (portalIndex !== -1) {
        const portal = this.map.portals[portalIndex]
        destroyedPortals.push({ ...portal })
        this.map.portals.splice(portalIndex, 1)
        console.log(`[火球] 摧毁传送门: ${portal.color}`)
      }

      // 检查是否命中玩家
      for (let i = 0; i < 2; i++) {
        const player = this.playerStates[i]
        if (player.position.x === fireball.x && player.position.y === fireball.y) {
          if (player.isDefending) {
            // 防御状态抵挡火球伤害
            hitPlayers.push({ playerIndex: i, defended: true })
            console.log(`[火球] 玩家${i + 1}在火球位置，但处于防御状态，抵挡了伤害！`)
          } else {
            // 非防御状态，扣除1点HP
            player.hp -= 1
            hitPlayers.push({ playerIndex: i, defended: false })
            console.log(`[火球] 玩家${i + 1}被火球击中！HP-1，当前HP: ${player.hp}`)
          }
        }
      }
    }

    // 发送伤害结果给客户端（始终发送，即使只有玩家被击中）
    this.io?.to(this.roomCode).emit('fireball_damage', {
      destroyedObstacles,
      destroyedPortals,
      hitPlayers,
      map: this.map
    })

    // 发送游戏消息
    if (destroyedObstacles.length > 0) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🔥 火球摧毁了${destroyedObstacles.length}个障碍物！`,
        type: 'warning'
      })
    }
    if (destroyedPortals.length > 0) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🔥 火球摧毁了${destroyedPortals.length}对传送门！`,
        type: 'warning'
      })
    }
    // 玩家被火球击中的消息
    for (const hit of hitPlayers) {
      if (hit.defended) {
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🛡️ 玩家${hit.playerIndex + 1}用防御抵挡了火球！`,
          type: 'info'
        })
      } else {
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🔥 玩家${hit.playerIndex + 1}被火球击中！HP-1`,
          type: 'error'
        })
      }
    }

    // 检查火球是否导致玩家死亡（游戏结束）
    const gameEnded = this.checkGameEnd()
    return gameEnded
  }

  // ========== 被动技能处理 ==========
  
  // 处理被动技能
  processPassiveSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    
    // 古城技能封印：被动技能无效
    if (this.skillSealed) {
      console.log(`[封印] 古城技能封印：玩家${playerIndex + 1}的被动技能无效`)
      return
    }
    
    const skillId = player.skill.id
    
    switch (skillId) {
      case 'archer_female':
        // 女弓箭手 - 天降箭雨：回合开始时随机射箭
        this.executeRainSkill(playerIndex)
        break
      case 'thief_female':
        // 女盗贼 - 隔墙有眼：每2个后手回合查看对手手牌
        // 此技能在后手玩家确认顺序时触发（confirmOrder中调用checkAndExecuteWallSkill）
        // 这里不再处理
        break
      case 'mage_female':
        // 女法师 - 爆裂攻击：攻击摧毁障碍物（在executeAttack中处理）
        // 这里不需要回合开始处理
        break
      case 'knight_female':
        // 女骑士 - 坚韧突刺：攻击范围+1，血量+1（已在setPlayer中处理血量）
        // 这里不需要回合开始处理
        break
      case 'reader_female':
        // 女阅读者 - 深度求索：环绕探查范围+1（在executeScout中处理）
        // 这里不需要回合开始处理
        break
    }
  }
  
  // 女弓箭手 - 天降箭雨：每回合出牌阶段开始时，随机在地图1个格子落下弓箭
  // 若该格子为障碍物或传送门，则此次攻击无任何效果
  executeRainSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    
    // 获取所有有效格子（排除边界障碍）
    const validCells = []
    for (let x = 0; x < this.map.width; x++) {
      for (let y = 0; y < this.map.height; y++) {
        // 排除边界障碍物
        const isBoundary = this.map.obstacles?.some(o => o.x === x && o.y === y && o.isBoundary)
        if (!isBoundary) {
          validCells.push({ x, y })
        }
      }
    }
    
    if (validCells.length === 0) {
      console.log(`[被动] 天降箭雨: 无有效格子`)
      return
    }
    
    // 随机选择一个格子
    const target = validCells[Math.floor(Math.random() * validCells.length)]
    
    // 检查目标格子是否为障碍物或传送门
    const isObstacle = this.map.obstacles?.some(o => o.x === target.x && o.y === target.y && !o.isBoundary)
    const isPortal = this.map.portals?.some(p => 
      (p.entry.x === target.x && p.entry.y === target.y) ||
      (p.exit.x === target.x && p.exit.y === target.y)
    )
    
    console.log(`[被动] 天降箭雨: 玩家${playerIndex + 1}的目标格子(${target.x}, ${target.y}), 障碍物=${isObstacle}, 传送门=${isPortal}`)
    
    // 发送技能特效
    this.io?.to(this.roomCode).emit('skill_effect', {
      skillId: 'archer_female_arrow_rain',
      playerIndex: playerIndex,
      targetPosition: target,
      isInvalid: isObstacle || isPortal  // 是否无效（命中障碍物或传送门）
    })
    
    // 如果命中障碍物或传送门，无任何效果
    if (isObstacle || isPortal) {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🎯 天降箭雨落在障碍物/传送门上，无效果`,
        type: 'info'
      })
      console.log(`[被动] 天降箭雨: 命中障碍物或传送门，无效果`)
      return
    }
    
    // 检查是否命中玩家
    let hitPlayer = false
    let hitPlayerIndex = -1
    
    for (let i = 0; i < 2; i++) {
      const targetPlayer = this.playerStates[i]
      if (targetPlayer.position.x === target.x && targetPlayer.position.y === target.y) {
        hitPlayer = true
        hitPlayerIndex = i
        break
      }
    }
    
    if (hitPlayer) {
      const hitPlayer = this.playerStates[hitPlayerIndex]
      // 检查防御
      if (hitPlayer.isDefending) {
        hitPlayer.isDefending = false
        this.io?.to(this.roomCode).emit('defense_broken', {
          playerIndex: hitPlayerIndex
        })
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🎯 天降箭雨命中玩家${hitPlayerIndex + 1}，但被防御！`,
          type: 'warning'
        })
      } else {
        hitPlayer.hp -= 1
        this.io?.to(this.roomCode).emit('game_message', {
          message: `🎯 天降箭雨命中玩家${hitPlayerIndex + 1}！血量-1`,
          type: 'error'
        })
        this.checkGameEnd()
      }
      console.log(`[被动] 天降箭雨: 命中玩家${hitPlayerIndex + 1}`)
    } else {
      this.io?.to(this.roomCode).emit('game_message', {
        message: `🎯 天降箭雨落在空地上`,
        type: 'info'
      })
      console.log(`[被动] 天降箭雨: 落在空地，无命中`)
    }
  }
  
  // 检查女盗贼技能是否应该触发（每隔一个后手回合触发，即每2个后手回合触发1次）
  shouldTriggerWallSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    
    // 只有后手玩家才会触发
    const priorityIndex = this.isPlayer1Priority ? 0 : 1
    if (playerIndex === priorityIndex) {
      console.log(`[隔墙有眼] 玩家${playerIndex + 1}是先手，不触发技能`)
      return false
    }
    
    // 使用后手回合计数器（每2个后手回合触发1次）
    // 计数器为奇数时触发：第1、3、5...个后手回合
    const normalTurnsCount = player.normalTurnsCount || 0
    const shouldTrigger = normalTurnsCount % 2 === 1
    
    console.log(`[隔墙有眼] 后手回合计数: ${normalTurnsCount}, 是否触发: ${shouldTrigger}`)
    return shouldTrigger
  }
  
  // 女盗贼 - 隔墙有眼：每2个后手回合自动查看对手的第一张和最后一张手牌
  // 注意：此方法现在在后手玩家选牌阶段开始时调用（dealCardsToNormalPlayer中）
  // 触发条件由 shouldTriggerWallSkill 方法判断
  checkAndExecuteWallSkill(playerIndex) {
    const player = this.playerStates[playerIndex]
    const opponent = this.playerStates[1 - playerIndex]
    
    // 古城技能封印：隔墙有眼无效
    if (this.skillSealed) {
      console.log(`[封印] 古城技能封印：女盗贼隔墙有眼无效`)
      return null
    }
    
    console.log(`[调试] ====== 隔墙有眼开始执行 ======`)
    console.log(`[调试] 执行对象: 玩家${playerIndex + 1}, 角色: ${player.avatar?.id || '未知'}`)
    console.log(`[调试] 对手: 玩家${1 - playerIndex + 1}, 角色: ${opponent.avatar?.id || '未知'}`)
    
    // 获取对手已确认的手牌
    const opponentHandCards = opponent.handCards || []
    
    // 获取第一张和最后一张手牌
    const firstCard = opponentHandCards.length > 0 ? opponentHandCards[0] : null
    const lastCard = opponentHandCards.length > 1 ? opponentHandCards[opponentHandCards.length - 1] : null
    
    console.log(`[调试] 对手手牌数量: ${opponentHandCards.length}`)
    console.log(`[调试] 对手所有手牌: ${JSON.stringify(opponentHandCards.map(c => ({ id: c.id, name: c.name })))}`)
    console.log(`[调试] 第一张牌: ${firstCard ? JSON.stringify({ id: firstCard.id, name: firstCard.name, icon: firstCard.icon }) : '无'}`)
    console.log(`[调试] 最后一张牌: ${lastCard ? JSON.stringify({ id: lastCard.id, name: lastCard.name, icon: lastCard.icon }) : '无'}`)
    
    // 返回要查看的手牌信息
    const revealedCards = {
      firstCard: firstCard ? { id: firstCard.id, name: firstCard.name, icon: firstCard.icon, type: firstCard.type } : null,
      lastCard: lastCard ? { id: lastCard.id, name: lastCard.name, icon: lastCard.icon, type: lastCard.type } : null,
      totalCards: opponentHandCards.length
    }
    
    console.log(`[调试] 准备发送的revealedCards: ${JSON.stringify(revealedCards)}`)
    
    // 发送技能特效（只有使用者能看到对手手牌）
    const payload = {
      skillId: 'thief_female_wall',
      playerIndex: playerIndex,
      revealedCards: revealedCards
    }
    console.log(`[调试] 发送skill_effect事件到玩家${playerIndex + 1}, payload: ${JSON.stringify(payload)}`)
    this.io?.to(this.playerStates[playerIndex].id).emit('skill_effect', payload)
    
    this.io?.to(this.roomCode).emit('game_message', {
      message: `👁️ 隔墙有眼触发！玩家${playerIndex + 1}窥视了对手的手牌`,
      type: 'info'
    })
    
    // 记录本次触发的回合数
    player.wallSkillLastTriggeredRound = this.currentRound
    
    console.log(`[被动] 隔墙有眼触发完成，记录触发回合: ${this.currentRound}`)
    
    return revealedCards
  }
  
  // 旧方法保留（回合结束时不调用，改为选牌阶段调用）
  executeWallSkill(playerIndex) {
    // 此方法已废弃，改为在dealCardsToNormalPlayer中调用checkAndExecuteWallSkill
    console.log(`[被动] executeWallSkill已废弃，请在选牌阶段使用checkAndExecuteWallSkill`)
  }
  
  // 重置游戏（重新进入地图配置阶段）
  reset() {
    this.currentRound = 1
    this.phase = GAME_PHASES.CONFIGURING
    this.winner = null
    this.turnIndex = 0
    this.isPlayer1Priority = Math.random() > 0.5
    this.priorityOrderComplete = false
    
    // 重置地图配置
    this.mapConfig.isConfigured = false
    this.mapConfig.selectedSize = GAME_CONFIG.MAP_SIZE
    
    // 重置地图为默认正方形
    this.map.width = GAME_CONFIG.MAP_SIZE
    this.map.height = GAME_CONFIG.MAP_SIZE
    this.map.size = GAME_CONFIG.MAP_SIZE
    this.map.isSingleRow = false
    
    // 重置玩家状态
    this.playerStates[0].position = { x: 0, y: 0 }
    this.playerStates[0].hp = GAME_CONFIG.INITIAL_HP
    this.playerStates[0].handCards = []
    this.playerStates[0].selectedCards = []
    this.playerStates[0].orderConfirmed = false
    this.playerStates[0].isDefending = false
    this.playerStates[0].currentCards = []
    this.playerStates[0].skillCooldown = 0  // 重置技能冷却，确保新游戏技能可用
    this.playerStates[0].skillSelected = false
    this.playerStates[0].wallSkillLastTriggeredRound = -1  // 重置女盗贼技能触发记录
    
    this.playerStates[1].position = { x: GAME_CONFIG.MAP_SIZE - 1, y: GAME_CONFIG.MAP_SIZE - 1 }
    this.playerStates[1].hp = GAME_CONFIG.INITIAL_HP
    this.playerStates[1].handCards = []
    this.playerStates[1].selectedCards = []
    this.playerStates[1].orderConfirmed = false
    this.playerStates[1].isDefending = false
    this.playerStates[1].currentCards = []
    this.playerStates[1].skillCooldown = 0  // 重置技能冷却，确保新游戏技能可用
    this.playerStates[1].skillSelected = false
    this.playerStates[1].wallSkillLastTriggeredRound = -1  // 重置女盗贼技能触发记录
    
    // 重置古城技能封印状态
    this.skillSealed = false
    
    console.log(`[游戏] 重置游戏，进入地图配置阶段`)
    
    // 通知双方重新进入配置阶段
    this.io?.to(this.roomCode).emit('enter_configuring', {
      phase: GAME_PHASES.CONFIGURING,
      mapSizeOptions: GAME_CONFIG.MAP_SIZE_OPTIONS,
      creatorId: this.playerStates[0].id
    })
  }
  
  // 处理断线
  handleDisconnect(socketId) {
    const index = this.getPlayerIndex(socketId)
    if (index !== -1) {
      console.log(`[断开] 玩家${index + 1}断开连接`)
      
      const winnerIndex = 1 - index // 未断线的玩家
      const winnerId = this.playerStates[winnerIndex].id
      
      // 通知未断线的玩家，对手已断开连接
      this.io?.to(this.playerStates[winnerIndex].id).emit('opponent_disconnected', {
        message: `对手已断开连接`
      })
      
      // 如果游戏正在进行中，判定未断线方胜利
      if (this.phase !== GAME_PHASES.WAITING && 
          this.phase !== GAME_PHASES.GAME_END &&
          !this.winner) {
        this.winner = winnerId
        this.phase = GAME_PHASES.GAME_END
        
        console.log(`[断开] 游戏结束，未断线的玩家${winnerIndex + 1}获胜`)
      }
    }
  }
  
  // 请求再来一局
  requestRematch(socketId) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return

    // 只有在游戏结束时才能请求再来一局
    if (this.phase !== GAME_PHASES.GAME_END) {
      console.log(`[再来一局] 当前阶段不允许请求再来一局: ${this.phase}`)
      return
    }

    const opponentIndex = 1 - index

    // ========== AI模式：自动同意再来一局 ==========
    if (this.isAIMatch) {
      console.log(`[再来一局] AI模式，自动同意再来一局`)

      // 清除请求记录
      this.rematchRequests = {}

      // 通知人类玩家再来一局已接受
      this.io?.to(this.roomCode).emit('rematch_accepted')

      // 重置游戏
      this.reset()
      return
    }

    // 记录请求
    this.rematchRequests = this.rematchRequests || {}
    this.rematchRequests[socketId] = true

    console.log(`[再来一局] 玩家${index + 1}请求再来一局`)

    // 通知对手有人请求再来一局
    this.io?.to(this.playerStates[opponentIndex].id).emit('rematch_requested', {
      from: socketId
    })

    // 通知请求者已发送请求
    this.io?.to(socketId).emit('rematch_request_sent')
  }
  
  // 接受再来一局
  acceptRematch(socketId) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    if (this.phase !== GAME_PHASES.GAME_END) return
    
    const opponentIndex = 1 - index
    const opponentId = this.playerStates[opponentIndex].id
    
    // 检查对手是否已经请求了再来一局
    if (this.rematchRequests && this.rematchRequests[opponentId]) {
      console.log(`[再来一局] 双方都同意，重新开始游戏`)
      
      // 清除请求记录
      this.rematchRequests = {}
      
      // 通知双方游戏即将重新开始
      this.io?.to(this.roomCode).emit('rematch_accepted')
      
      // 重置游戏
      this.reset()
    } else {
      console.log(`[再来一局] 对手还没有请求再来一局`)
    }
  }
  
  // 拒绝再来一局
  rejectRematch(socketId) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    const opponentIndex = 1 - index
    const opponentId = this.playerStates[opponentIndex].id
    
    console.log(`[再来一局] 玩家${index + 1}拒绝再来一局`)
    
    // 清除请求记录
    this.rematchRequests = {}
    
    // 通知对手请求被拒绝
    this.io?.to(opponentId).emit('rematch_rejected')
    
    // 通知拒绝者已处理
    this.io?.to(socketId).emit('rematch_reject_confirmed')
  }
  
  // 获取游戏状态
  getState() {
    return {
      phase: this.phase,
      currentRound: this.currentRound,
      map: this.map,
      fogEnabled: this.fogEnabled,
      players: this.playerStates.map((p, i) => ({
        id: p.id,
        avatarId: p.avatarId,
        position: { ...p.position },
        hp: p.hp,
        maxHp: GAME_CONFIG.INITIAL_HP + (p.skill?.bonusHp || 0),
        isHidden: p.isHidden,  // 草丛隐藏状态
        handCards: i === 0 ? p.handCards : (i === 1 ? p.handCards : []),
        // 技能相关状态
        skill: p.skill,
        skillCooldown: p.skillCooldown,
        skillSelected: p.skillSelected
      })),
      turnIndex: this.turnIndex,
      winner: this.winner,
      isPlayer1Priority: this.isPlayer1Priority,
      player1AvatarId: this.playerStates[0].avatarId,
      player2AvatarId: this.playerStates[1].avatarId,
      // 技能状态（方便客户端直接访问）
      player1Skill: this.playerStates[0].skill,
      player2Skill: this.playerStates[1].skill,
      player1SkillCooldown: this.playerStates[0].skillCooldown,
      player2SkillCooldown: this.playerStates[1].skillCooldown,
      // 古城技能封印状态
      skillSealed: this.skillSealed
    }
  }
  
  // ========== AI单人模式触发 ==========
  
  // AI触发：根据当前阶段让AI自动操作
  triggerAIIfNeeded(action) {
    if (!this.isAIMatch || !this.aiPlayer) return
    
    const aiIndex = this.aiPlayer.playerIndex
    const aiSocketId = this.aiPlayer.getSocketId()
    
    console.log(`[AI触发] action=${action}, AI索引=${aiIndex}`)
    
    switch (action) {
      case 'selecting':
        // AI选牌
        if (this.phase === GAME_PHASES.SELECTING_PRIORITY || this.phase === GAME_PHASES.SELECTING_NORMAL) {
          const priorityIndex = this.isPlayer1Priority ? 0 : 1
          // 检查是否轮到AI选牌
          if ((this.phase === GAME_PHASES.SELECTING_PRIORITY && aiIndex === priorityIndex) ||
              (this.phase === GAME_PHASES.SELECTING_NORMAL && aiIndex !== priorityIndex)) {
            this.aiPlayer.executeSelectCards()
          }
        }
        break
      case 'ordering_priority':
        // AI排序（先手）
        if (aiIndex === (this.isPlayer1Priority ? 0 : 1)) {
          this.aiPlayer.executeConfirmOrder()
        }
        break
      case 'ordering_normal':
        // AI排序（后手）
        if (aiIndex !== (this.isPlayer1Priority ? 0 : 1)) {
          this.aiPlayer.executeConfirmOrder()
        }
        break
      case 'view_opponent_card':
        // AI查看对手牌
        this.aiPlayer.executeViewOpponentCard()
        break
      case 'playing':
        // AI出牌
        this.aiPlayer.executePlayCard()
        break
      case 'game_end':
        // AI自动同意再来一局
        this.aiPlayer.executeRematch()
        break
    }
  }
  
  // 初始化AI单人模式
  // difficulty: 'easy', 'normal', 'hard'
  // 注意：已移除神经网络AI选项，统一使用规则AI
  initAI(difficulty = 'normal') {
    this.isAIMatch = true
    
    // 使用规则AI
    this.aiPlayer = new AIPlayer(1, this, difficulty)
    console.log(`[AI] 使用规则AI (难度: ${difficulty})`)
    
    const aiSocketId = this.aiPlayer.getSocketId()
    
    // 设置AI的socketId和角色
    this.playerStates[1].id = aiSocketId
    this.playerStates[1].avatarId = this.aiPlayer.avatarId
    
    // 初始化AI角色技能
    const skillConfig = getCharacterSkillById(this.aiPlayer.avatarId)
    if (skillConfig) {
      this.playerStates[1].skill = skillConfig
      if (skillConfig.bonusHp) {
        this.playerStates[1].hp = GAME_CONFIG.INITIAL_HP + skillConfig.bonusHp
      }
    }
    
    console.log(`[AI] 单人模式初始化完成, AI角色: ${this.aiPlayer.avatarId}, 难度: ${difficulty}`)
    return aiSocketId
  }
  
  // 设置IO实例
  setIO(io) {
    this.io = io
  }
  
  // 移除玩家
  removePlayer(socketId) {
    const index = this.getPlayerIndex(socketId)
    if (index !== -1) {
      console.log(`[Match] 移除玩家${index + 1}: ${socketId}`)
      this.playerStates[index].id = ''
      this.playerStates[index].handCards = []
      this.playerStates[index].selectedCards = []
      this.playerStates[index].currentCards = []
    }
  }
}
