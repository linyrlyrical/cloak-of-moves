import { CARD_TYPES, DIRECTION_OFFSET, CHARACTER_SKILLS } from '../shared/constants.js'

/**
 * AI玩家 - 单人模式的人工智能
 * 负责自动执行选牌、排序、查看对手牌等决策
 */
export class AIPlayer {
  constructor(playerIndex, match, difficulty = 'normal') {
    this.playerIndex = playerIndex  // AI在match中的玩家索引(0或1)
    this.match = match              // Match实例引用
    this.difficulty = difficulty    // 难度: 'easy', 'normal', 'hard'
    this.aiSocketId = `AI_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    this.avatarId = null           // AI的角色ID
    
    // 随机选择一个角色
    this.selectRandomAvatar()
    
    console.log(`[AI] AI玩家初始化, 索引: ${playerIndex}, 难度: ${difficulty}, 角色: ${this.avatarId}`)
  }
  
  // 随机选择角色
  selectRandomAvatar() {
    const avatarIds = Object.values(CHARACTER_SKILLS).map(s => s.id)
    this.avatarId = avatarIds[Math.floor(Math.random() * avatarIds.length)]
  }
  
  // 获取AI的socketId
  getSocketId() {
    return this.aiSocketId
  }
  
  // 获取对手玩家索引
  getOpponentIndex() {
    return this.playerIndex === 0 ? 1 : 0
  }
  
  // 获取AI玩家状态
  getMyState() {
    return this.match.playerStates[this.playerIndex]
  }
  
  // 获取对手玩家状态
  getOpponentState() {
    return this.match.playerStates[this.getOpponentIndex()]
  }
  
  // 计算与对手的曼哈顿距离
  getDistanceToOpponent() {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    return Math.abs(myPos.x - oppPos.x) + Math.abs(myPos.y - oppPos.y)
  }
  
  // 获取朝向对手的方向
  getDirectionToOpponent() {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const dx = oppPos.x - myPos.x
    const dy = oppPos.y - myPos.y
    
    // 优先移动较大的轴向
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left'
    } else {
      return dy > 0 ? 'down' : 'up'
    }
  }
  
  // 获取远离对手的方向
  getDirectionAwayFromOpponent() {
    const dir = this.getDirectionToOpponent()
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' }
    return opposite[dir]
  }
  
  // 检查某个方向是否可以移动
  canMoveInDirection(direction) {
    const myPos = this.getMyState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    const newX = myPos.x + offset.x
    const newY = myPos.y + offset.y
    
    // 检查边界
    if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) {
      return false
    }
    
    // 检查特色地形边界
    if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
      if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) {
        return false
      }
    }
    
    // 检查障碍物（非边界障碍物）
    const isBlocked = this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)
    if (isBlocked) return false
    
    // 检查对手位置
    const oppPos = this.getOpponentState().position
    if (oppPos.x === newX && oppPos.y === newY) return false
    
    return true
  }
  
  // 获取可移动的方向列表
  getMovableDirections() {
    return ['up', 'down', 'left', 'right'].filter(d => this.canMoveInDirection(d))
  }
  
  // 检查某个方向攻击是否能命中对手
  canAttackHitOpponent(direction, range = 1) {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    for (let i = 1; i <= range; i++) {
      const checkX = myPos.x + offset.x * i
      const checkY = myPos.y + offset.y * i
      
      // 超出地图
      if (checkX < 0 || checkX >= this.match.map.width || checkY < 0 || checkY >= this.match.map.height) break
      
      // 检查特色地形
      if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
        if (!this.match.map.shapeLayout[checkY] || this.match.map.shapeLayout[checkY][checkX] !== 1) break
      }
      
      // 遇到障碍物（非边界）则阻挡
      const isBlocked = this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)
      if (isBlocked) break
      
      // 命中对手
      if (checkX === oppPos.x && checkY === oppPos.y) return true
    }
    return false
  }
  
  // 选择能命中对手的攻击方向
  getBestAttackDirection(range = 1) {
    const directions = ['up', 'down', 'left', 'right']
    // 优先朝对手方向
    const preferredDir = this.getDirectionToOpponent()
    const orderedDirs = [preferredDir, ...directions.filter(d => d !== preferredDir)]
    
    for (const dir of orderedDirs) {
      if (this.canAttackHitOpponent(dir, range)) {
        return dir
      }
    }
    return null
  }
  
  // ========== 选牌策略 ==========
  
  // 从currentCards中选3张牌
  selectCards() {
    const currentCards = this.getMyState().currentCards
    const distance = this.getDistanceToOpponent()
    const myHp = this.getMyState().hp
    const maxHp = this.match.playerStates[this.playerIndex].hp
    
    // 评估每张牌的价值
    const cardValues = currentCards.map((card, index) => {
      let value = 0
      
      if (card.isSkillCard) {
        // 主动技能牌
        if (card.sealed) {
          value = 0  // 封印状态下不选
        } else {
          value = 8  // 技能牌优先级高
        }
      } else {
        switch (card.type) {
          case 'attack':
            // 距离近时攻击价值高
            if (this.getBestAttackDirection(card.range || 1)) {
              value = distance <= 2 ? 9 : 4
            } else {
              value = distance <= 3 ? 3 : 1
            }
            break
          case 'defense':
            // 血量低或对手可能攻击时防御价值高
            value = myHp <= 3 ? 8 : 5
            break
          case 'move':
            // 距离远时移动价值高
            value = distance > 2 ? 7 : 3
            break
          case 'scout':
            // 探查价值适中，远距离略高
            value = distance > 2 ? 6 : 4
            break
          default:
            value = 3
        }
      }
      
      // 添加随机性（根据难度调整）
      const randomness = this.difficulty === 'easy' ? 5 : (this.difficulty === 'hard' ? 1 : 3)
      value += Math.random() * randomness
      
      return { index, value, card }
    })
    
    // 按价值排序，选前3张
    cardValues.sort((a, b) => b.value - a.value)
    const selectedIndices = cardValues.slice(0, 3).map(cv => cv.index)
    
    console.log(`[AI] 选牌: ${selectedIndices}, 卡牌: ${selectedIndices.map(i => currentCards[i].name).join(', ')}`)
    return selectedIndices
  }
  
  // ========== 排序策略 ==========
  
  // 排列3张手牌的出牌顺序
  orderCards(handCards) {
    const distance = this.getDistanceToOpponent()
    const myHp = this.getMyState().hp
    
    // 评估每张牌在当前回合顺序中的优先级
    const cardPriorities = handCards.map((card, index) => {
      let priority = 0
      
      if (card.isSkillCard) {
        priority = 7
      } else {
        switch (card.type) {
          case 'attack':
            // 先手攻击优先
            priority = distance <= 2 ? 8 : 3
            break
          case 'defense':
            // 如果对手可能先攻击，防御优先
            priority = 6
            break
          case 'move':
            // 远距离时先移动
            priority = distance > 2 ? 7 : 2
            break
          case 'scout':
            // 探查通常先使用
            priority = 5
            break
          default:
            priority = 3
        }
      }
      
      // 低血量时防御优先级提升
      if (card.type === 'defense' && myHp <= 2) {
        priority += 3
      }
      
      // 添加随机性
      const randomness = this.difficulty === 'easy' ? 4 : (this.difficulty === 'hard' ? 0.5 : 2)
      priority += Math.random() * randomness
      
      return { index, priority, card }
    })
    
    // 按优先级排序（高的先出）
    cardPriorities.sort((a, b) => b.priority - a.priority)
    const orderedCards = cardPriorities.map(cp => cp.card)
    
    console.log(`[AI] 排序: ${orderedCards.map(c => c.name).join(' → ')}`)
    return orderedCards
  }
  
  // ========== 查看对手牌策略 ==========
  
  // 选择查看对手的第一张还是最后一张
  chooseViewOpponentCard() {
    // 随机选择，稍微偏向第一张
    const choice = Math.random() < 0.6 ? 'first' : 'last'
    console.log(`[AI] 选择查看对手${choice === 'first' ? '第一张' : '最后一张'}牌`)
    return choice
  }
  
  // ========== 执行AI回合 ==========
  
  // AI自动执行选牌流程（带延迟）
  executeSelectCards() {
    const delay = 1000 + Math.random() * 1500  // 1-2.5秒延迟
    setTimeout(() => {
      if (this.match.phase !== 'selecting_priority' && this.match.phase !== 'selecting_normal') {
        console.log(`[AI] 阶段已变更，跳过选牌`)
        return
      }
      
      const selectedIndices = this.selectCards()
      // 直接调用match的方法，用AI的socketId
      this.match.selectCards(this.aiSocketId, selectedIndices)
    }, delay)
  }
  
  // AI自动执行排序流程（带延迟）
  executeConfirmOrder() {
    const delay = 800 + Math.random() * 1200  // 0.8-2秒延迟
    setTimeout(() => {
      if (this.match.phase !== 'ordering_priority' && this.match.phase !== 'ordering_normal') {
        console.log(`[AI] 阶段已变更，跳过排序`)
        return
      }
      
      const handCards = this.getMyState().handCards
      if (!handCards || handCards.length === 0) {
        console.log(`[AI] 没有手牌可排序`)
        return
      }
      
      const orderedCards = this.orderCards([...handCards])
      this.match.confirmOrder(this.aiSocketId, orderedCards)
    }, delay)
  }
  
  // AI自动执行查看对手牌流程（带延迟）
  executeViewOpponentCard() {
    const delay = 500 + Math.random() * 1000  // 0.5-1.5秒延迟
    setTimeout(() => {
      const choice = this.chooseViewOpponentCard()
      this.match.viewOpponentCard(this.aiSocketId, choice)
    }, delay)
  }
  
  // AI自动执行出牌（带延迟）
  executePlayCard() {
    const delay = 300 + Math.random() * 700  // 0.3-1秒延迟
    setTimeout(() => {
      if (this.match.phase !== 'playing') {
        console.log(`[AI] 不在出牌阶段，跳过出牌`)
        return
      }
      
      // 检查是否轮到AI
      const priorityIndex = this.match.isPlayer1Priority ? 0 : 1
      const isPriorityTurn = this.match.turnIndex % 2 === 0
      const currentPlayerIndex = isPriorityTurn ? priorityIndex : (1 - priorityIndex)
      
      if (currentPlayerIndex !== this.playerIndex) {
        console.log(`[AI] 不是AI的回合`)
        return
      }
      
      this.match.playCard(this.aiSocketId)
    }, delay)
  }
  
  // AI设置地图配置（单人模式下由玩家配置，AI不需要）
  // 这个方法留空，因为单人模式只有玩家配置地图
  
  // AI处理再来一局
  executeRematch() {
    const delay = 1000 + Math.random() * 1000
    setTimeout(() => {
      this.match.requestRematch(this.aiSocketId)
    }, delay)
  }
}