import { GAME_CONFIG, CARD_TYPES, ALL_CARD_TYPES, DIRECTION_OFFSET, GAME_PHASES, MAP_THEMES, THEME_LIST, PORTAL_COLORS, PORTAL_COLOR_LIST } from '../shared/constants.js'

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
      portals: []                    // 传送门数组
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
        currentCards: [],  // 当前回合可选择的牌
        scoutEffects: []  // 探查效果数组
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
        currentCards: [],  // 当前回合可选择的牌
        scoutEffects: []  // 探查效果数组
      }
    ]
    
    this.turnIndex = 0
    this.winner = null
    // 随机决定先手玩家 (true=玩家1先手, false=玩家2先手)
    this.isPlayer1Priority = Math.random() > 0.5
    this.priorityOrderComplete = false  // 优先玩家的顺序是否已确定
    
    // 地图主题（游戏开始时随机选择）
    this.theme = null
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
    console.log(`[玩家] 玩家${index + 1}设置为: ${socketId}, 形象: ${avatarId || '默认'}`)
    
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
    
    // 验证地图大小是否在允许范围内
    if (!GAME_CONFIG.MAP_SIZE_OPTIONS.includes(size)) {
      console.error(`[错误] 无效的地图大小: ${size}`)
      return false
    }
    
    // 保存迷雾设置
    this.fogEnabled = fogEnabled
    console.log(`[配置] 迷雾效果: ${fogEnabled ? '启用' : '关闭'}`)
    
    this.mapConfig.selectedSize = size
    this.mapConfig.isConfigured = true
    
    // 解析地图大小（支持正方形和1×N单行地图）
    if (typeof size === 'string' && size.startsWith('1x')) {
      // 单行地图格式: '1x5', '1x7', '1x10'
      const width = parseInt(size.split('x')[1])
      this.map.width = width
      this.map.height = 1
      this.map.size = width  // 兼容旧代码
      this.map.isSingleRow = true
      
      // 单行地图：玩家1在左侧，玩家2在右侧
      this.playerStates[0].position = { x: 0, y: 0 }
      this.playerStates[1].position = { x: width - 1, y: 0 }
      
      console.log(`[配置] 房主设置单行地图: ${size}`)
    } else {
      // 正方形地图
      this.map.width = size
      this.map.height = size
      this.map.size = size
      this.map.isSingleRow = false
      
      // 正方形地图：玩家在对角
      this.playerStates[0].position = { x: 0, y: 0 }
      this.playerStates[1].position = { x: size - 1, y: size - 1 }
      
      console.log(`[配置] 房主设置正方形地图: ${size}x${size}`)
    }
    
    // 重新生成障碍物
    this.map.obstacles = this.generateObstacles()
    
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
    
    // 随机选择地图主题
    const randomThemeIndex = Math.floor(Math.random() * THEME_LIST.length)
    const themeId = THEME_LIST[randomThemeIndex]
    this.theme = MAP_THEMES[themeId]
    console.log(`[游戏] 随机选择地图主题: ${this.theme.nameCn}`)
    
    // 为每个障碍物随机分配类型
    this.map.obstacles = this.map.obstacles.map(obs => ({
      ...obs,
      type: this.theme.obstacleTypes[Math.floor(Math.random() * this.theme.obstacleTypes.length)]
    }))
    
    // 生成传送门
    this.generatePortals()
    
    // 通知客户端游戏开始，并传递先手信息和主题
    this.io?.to(this.roomCode).emit('game_start', {
      ...this.getState(),
      isPlayer1Priority: this.isPlayer1Priority,
      theme: this.theme
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
    
    // 分别发送卡牌给两位玩家
    this.io?.to(this.playerStates[0].id).emit('deal_cards', {
      cards: this.playerStates[0].currentCards,
      isPriority: priorityIndex === 0,
      opponentFirstCard: null
    })
    
    this.io?.to(this.playerStates[1].id).emit('deal_cards', {
      cards: this.playerStates[1].currentCards,
      isPriority: priorityIndex === 1,
      opponentFirstCard: null
    })
    
    console.log(`[发牌] 发给两名玩家相同的6张牌`)
    
    this.phase = GAME_PHASES.SELECTING_PRIORITY
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
    // 检查对方位置
    if (opponentPos.x === x && opponentPos.y === y) {
      return false
    }
    return true
  }
  
  // 选择卡牌
  selectCards(socketId, selectedCards) {
    const index = this.getPlayerIndex(socketId)
    if (index === -1) return
    
    const player = this.playerStates[index]
    
    // 验证选牌数量
    if (selectedCards.length !== GAME_CONFIG.HAND_SIZE) {
      console.error(`[错误] 玩家${index + 1}选择了${selectedCards.length}张牌，应该选择${GAME_CONFIG.HAND_SIZE}张`)
      return
    }
    
    // 将选中的牌设置为手牌
    player.selectedCards = selectedCards
    player.handCards = [...selectedCards]
    player.currentCards = []
    
    console.log(`[选择] 玩家${index + 1}选择了卡牌:`, selectedCards.map(c => c.name))
    
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
    } else {
      // 后手玩家选择完毕，通知进入排序阶段
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
      // 先手玩家确认完毕，通知后手玩家选择要查看的手牌
      this.priorityOrderComplete = true
      this.phase = GAME_PHASES.SELECTING_NORMAL
      
      const normalIndex = 1 - priorityIndex
      const handCards = this.playerStates[priorityIndex].handCards
      
      // 通知后手玩家选择要查看先手的第一张还是最后一张牌
      this.io?.to(this.playerStates[normalIndex].id).emit('choose_opponent_card_to_view', {
        firstCard: handCards[0] || null,
        lastCard: handCards[handCards.length - 1] || null
      })
      
      console.log(`[顺序] 先手确认完毕，通知后手选择查看第一张或最后一张牌`)
      
      // 通知先手玩家能看到后手玩家的第一张牌（当后手选完牌后会有值）
      this.io?.to(this.playerStates[priorityIndex].id).emit('opponent_first_card_visible', {
        opponentFirstCard: null
      })
      
    } else {
      // 后手玩家确认顺序完毕，开始出牌阶段
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
    }
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
      // 执行卡牌效果
      this.executeCard(playerIndex, card)
      
      // 检查游戏是否结束
      if (this.checkGameEnd()) return
      
      this.turnIndex++
      
      // 先发送状态更新，让客户端看到最后一张牌的效果
      this.io?.to(this.roomCode).emit('turn_played', this.getState())
      
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
    
    // 如果打出的是非防御牌，清除该玩家的防御状态
    if (card.type !== 'defense' && player.isDefending) {
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
    
    if (card.type === 'move') {
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
  
  // 执行移动
  executeMove(playerIndex, direction) {
    const player = this.playerStates[playerIndex]
    const offset = DIRECTION_OFFSET[direction]
    const newX = player.position.x + offset.x
    const newY = player.position.y + offset.y
    const opponent = this.playerStates[1 - playerIndex]
    
    // 记录旧位置用于特效
    const oldPos = { x: player.position.x, y: player.position.y }
    
    // 检查边界
    if (newX < 0 || newX >= this.map.size || newY < 0 || newY >= this.map.size) {
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
    
    // 记录攻击路径（用于特效）
    const attackPath = [{ x: player.position.x, y: player.position.y }]
    
    // 逐格检查攻击路径
    for (let i = 1; i <= range; i++) {
      const targetX = player.position.x + offset.x * i
      const targetY = player.position.y + offset.y * i
      attackPath.push({ x: targetX, y: targetY })
      
      // 检查边界
      if (targetX < 0 || targetX >= this.map.size || targetY < 0 || targetY >= this.map.size) {
        // 超出边界，发送特效后返回
        this.io?.to(this.roomCode).emit('attack_effect', {
          from: player.position,
          to: { x: targetX, y: targetY },
          direction,
          range,
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
      if (this.map.obstacles.some(o => o.x === targetX && o.y === targetY)) {
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
          range,
          hit: false
        })
        return false
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
    
    // 记录探查效果
    const scoutEffect = {
      type: scoutType,
      position: { ...player.position },
      playerIndex: playerIndex
    }
    
    // 添加到玩家探查效果数组
    player.scoutEffects.push(scoutEffect)
    
    // 只发给打出探查牌的玩家（私密效果，对手不可见）
    this.io?.to(this.playerStates[playerIndex].id).emit('scout_effect', {
      playerIndex: playerIndex,
      scoutType: scoutType,
      position: player.position
    })
    
    this.io?.to(this.roomCode).emit('game_message', {
      message: `玩家${playerIndex + 1}使用了${scoutType === 'row' ? '行探查' : scoutType === 'col' ? '列探查' : '环绕探查'}`,
      type: 'info',
      playerIndex: playerIndex
    })
    
    console.log(`[探查] 玩家${playerIndex + 1}使用${scoutType}探查`)
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
    
    console.log(`[回合] 第${this.currentRound}回合开始，先手: ${this.isPlayer1Priority ? '玩家1' : '玩家2'}`)
    
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
    
    // 发送回合结束消息
    this.io?.to(this.roomCode).emit('round_end', this.getState())
    
    // 开始新回合，给先手玩家发牌
    setTimeout(() => {
      this.dealCardsToPriorityPlayer()
    }, 100)
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
    
    this.playerStates[1].position = { x: GAME_CONFIG.MAP_SIZE - 1, y: GAME_CONFIG.MAP_SIZE - 1 }
    this.playerStates[1].hp = GAME_CONFIG.INITIAL_HP
    this.playerStates[1].handCards = []
    this.playerStates[1].selectedCards = []
    this.playerStates[1].orderConfirmed = false
    this.playerStates[1].isDefending = false
    this.playerStates[1].currentCards = []
    
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
        handCards: i === 0 ? p.handCards : (i === 1 ? p.handCards : [])
      })),
      turnIndex: this.turnIndex,
      winner: this.winner,
      isPlayer1Priority: this.isPlayer1Priority,
      player1AvatarId: this.playerStates[0].avatarId,
      player2AvatarId: this.playerStates[1].avatarId
    }
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
