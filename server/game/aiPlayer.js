import { CARD_TYPES, DIRECTION_OFFSET, CHARACTER_SKILLS } from '../shared/constants.js'

/**
 * AI玩家 - 单人模式的人工智能（增强版）
 * 负责自动执行选牌、排序、查看对手牌等决策
 * 
 * 难度说明：
 * - easy: 较多随机性，反应慢，策略简单
 * - normal: 平衡策略，适度随机性
 * - hard: 最优策略，最小随机性，考虑更多因素
 */
export class AIPlayer {
  constructor(playerIndex, match, difficulty = 'normal', fogEnabled = true) {
    this.playerIndex = playerIndex
    this.match = match
    this.difficulty = difficulty
    this.aiSocketId = `AI_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    this.avatarId = null
    
    // 难度相关参数配置（增强版）
    this.difficultyConfig = {
      easy: { randomness: 3, thinkDelay: 1200, predictionLevel: 1 },
      normal: { randomness: 1.5, thinkDelay: 800, predictionLevel: 2 },
      hard: { randomness: 0.3, thinkDelay: 300, predictionLevel: 3 }
    }
    
    this.selectRandomAvatar(fogEnabled)
    console.log(`[AI] AI玩家初始化, 索引: ${playerIndex}, 难度: ${difficulty}, 角色: ${this.avatarId}`)
  }
  
  selectRandomAvatar(fogEnabled = true) {
    const allAvatarIds = Object.values(CHARACTER_SKILLS).map(s => s.id)
    const excludedIds = ['thief_male']
    
    // 迷雾关闭时，排除阅读者角色（技能与迷雾相关）
    if (!fogEnabled) {
      excludedIds.push('reader_male', 'reader_female')
      console.log(`[AI] 迷雾已关闭，排除阅读者角色`)
    }
    
    const availableAvatarIds = allAvatarIds.filter(id => !excludedIds.includes(id))
    this.avatarId = availableAvatarIds[Math.floor(Math.random() * availableAvatarIds.length)]
    console.log(`[AI] 可选角色: ${availableAvatarIds.join(', ')}, 选中: ${this.avatarId}`)
  }
  
  getSocketId() { return this.aiSocketId }
  getOpponentIndex() { return this.playerIndex === 0 ? 1 : 0 }
  getMyState() { return this.match.playerStates[this.playerIndex] }
  getOpponentState() { return this.match.playerStates[this.getOpponentIndex()] }
  getDifficultyConfig() { return this.difficultyConfig[this.difficulty] || this.difficultyConfig.normal }
  
  // ========== 基础位置计算 ==========
  
  getDistanceToOpponent() {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    return Math.abs(myPos.x - oppPos.x) + Math.abs(myPos.y - oppPos.y)
  }
  
  getDirectionToOpponent() {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const dx = oppPos.x - myPos.x
    const dy = oppPos.y - myPos.y
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left'
    } else {
      return dy > 0 ? 'down' : 'up'
    }
  }
  
  getDirectionAwayFromOpponent() {
    const dir = this.getDirectionToOpponent()
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' }
    return opposite[dir]
  }
  
  canMoveInDirection(direction) {
    const myPos = this.getMyState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    const newX = myPos.x + offset.x
    const newY = myPos.y + offset.y
    
    if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) return false
    
    if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
      if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) return false
    }
    
    if (this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)) return false
    if (this.match.map.sandDunes?.some(d => d.x === newX && d.y === newY)) return false
    
    const oppPos = this.getOpponentState().position
    if (oppPos.x === newX && oppPos.y === newY) return false
    
    return true
  }
  
  getMovableDirections() {
    return ['up', 'down', 'left', 'right'].filter(d => this.canMoveInDirection(d))
  }
  
  // ========== 传送阵相关 ==========
  
  // 获取所有传送门
  getPortals() {
    return this.match.map.portals || []
  }
  
  // 获取指定位置传送门的出口
  getPortalExit(x, y) {
    const portals = this.getPortals()
    const portal = portals.find(p => p.x === x && p.y === y)
    if (!portal) return null
    
    // 找到配对的传送门
    const pairedPortal = portals.find(p => 
      p.color === portal.color && (p.x !== x || p.y !== y)
    )
    return pairedPortal || null
  }
  
  // 检查位置是否有传送门
  hasPortalAt(x, y) {
    return this.getPortals().some(p => p.x === x && p.y === y)
  }
  
  // 计算通过传送门到达目标的最短路径（考虑传送效果）
  findPathWithPortals(targetPos) {
    const myPos = this.getMyState().position
    
    // 1. 直接路径（不使用传送门）
    const directPath = this.findPathToPosition(targetPos)
    
    // 2. 通过传送门的路径
    const portals = this.getPortals()
    let bestPortalPath = null
    let bestPortalLength = Infinity
    
    for (const portal of portals) {
      // 到传送门入口的路径
      const pathToPortal = this.findPathToPosition({ x: portal.x, y: portal.y })
      if (pathToPortal.length === 0) continue
      
      // 获取出口
      const exit = this.getPortalExit(portal.x, portal.y)
      if (!exit) continue
      
      // 从出口到目标的路径
      const pathFromExit = this.findPathToPositionFrom(exit, targetPos)
      if (pathFromExit.length === 0) continue
      
      const totalLength = pathToPortal.length + pathFromExit.length
      if (totalLength < bestPortalLength) {
        bestPortalLength = totalLength
        bestPortalPath = { pathToPortal, exit, pathFromExit }
      }
    }
    
    // 比较直接路径和传送门路径
    if (bestPortalPath && bestPortalLength < directPath.length) {
      return { usePortal: true, path: bestPortalPath }
    }
    
    return { usePortal: false, path: directPath }
  }
  
  // 从指定位置到目标的路径
  findPathToPositionFrom(fromPos, targetPos) {
    const queue = [{ x: fromPos.x, y: fromPos.y, path: [] }]
    const visited = new Set([`${fromPos.x},${fromPos.y}`])
    const directions = ['up', 'down', 'left', 'right']
    
    while (queue.length > 0) {
      const current = queue.shift()
      if (current.x === targetPos.x && current.y === targetPos.y) return current.path
      
      for (const dir of directions) {
        const offset = DIRECTION_OFFSET[dir]
        const newX = current.x + offset.x
        const newY = current.y + offset.y
        const key = `${newX},${newY}`
        
        if (visited.has(key)) continue
        if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) continue
        if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
          if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) continue
        }
        if (this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)) continue
        if (this.match.map.sandDunes?.some(d => d.x === newX && d.y === newY)) continue
        
        visited.add(key)
        queue.push({ x: newX, y: newY, path: [...current.path, dir] })
      }
    }
    return []
  }
  
  // 判断是否应该利用传送门
  shouldUsePortal() {
    const distance = this.getDistanceToOpponent()
    const tactic = this.shouldChaseOrEscape()
    const config = this.getDifficultyConfig()
    
    // 困难模式才考虑传送门
    if (config.predictionLevel < 3) return false
    
    const portals = this.getPortals()
    if (portals.length < 2) return false
    
    const oppPos = this.getOpponentState().position
    const portalPath = this.findPathWithPortals(oppPos)
    
    // 如果传送门路径更短，考虑使用
    if (portalPath.usePortal && tactic === 'chase') {
      return true
    }
    
    // 逃跑时检查传送门是否能帮助逃脱
    if (tactic === 'escape') {
      for (const portal of portals) {
        const exit = this.getPortalExit(portal.x, portal.y)
        if (exit) {
          const exitDistance = Math.abs(exit.x - oppPos.x) + Math.abs(exit.y - oppPos.y)
          if (exitDistance > distance) return true
        }
      }
    }
    
    return false
  }
  
  // ========== 玩家技能分析 ==========
  
  // 获取对手技能威胁
  getOpponentSkillThreat() {
    const oppState = this.getOpponentState()
    const oppSkill = oppState.skill
    const isSealed = this.match.skillSealed
    
    if (!oppSkill || isSealed) return { threat: 0, type: null }
    
    const distance = this.getDistanceToOpponent()
    let threat = 0
    let type = null
    
    // 分析不同技能的威胁
    switch (oppSkill.id) {
      case 'mage_male': // 天降陨石 - 全图AOE威胁
        threat = 8
        type = 'aoe'
        break
      case 'knight_male': // 旋风斩 - 近距离威胁
        threat = distance <= 1 ? 10 : 2
        type = 'close_range'
        break
      case 'knight_female': // 坚韧突刺 - 攻击范围+1
        threat = distance <= 3 ? 7 : 3
        type = 'extended_range'
        break
      case 'archer_male': // 百步穿杨 - 远程穿透
        threat = 9
        type = 'piercing'
        break
      case 'archer_female': // 天降箭雨 - 随机AOE
        threat = 6
        type = 'random_aoe'
        break
      case 'mage_female': // 爆裂攻击 - 可摧毁障碍
        threat = 7
        type = 'destructive'
        break
    }
    
    return { threat, type }
  }
  
  // 获取己方技能优势
  getMySkillAdvantage() {
    const myState = this.getMyState()
    const mySkill = myState.skill
    const isSealed = this.match.skillSealed
    
    if (!mySkill || isSealed) return { advantage: 0, canUse: false }
    
    const distance = this.getDistanceToOpponent()
    const oppHp = this.getOpponentState().hp
    let advantage = 0
    let canUse = myState.skillCooldown === 0
    
    switch (mySkill.id) {
      case 'mage_male': // 天降陨石
        advantage = canUse ? 10 : 0
        break
      case 'knight_male': // 旋风斩
        advantage = canUse && distance <= 1 ? 12 : 0
        break
      case 'knight_female': // 坚韧突刺 - 被动，攻击范围+1
        advantage = distance <= 3 ? 5 : 2
        break
      case 'archer_male': // 百步穿杨
        advantage = canUse ? 9 : 0
        break
      case 'archer_female': // 天降箭雨 - 被动
        advantage = 4
        break
      case 'reader_female': // 深度求索 - 探查范围+1
        advantage = this.match.fogEnabled ? 5 : 1
        break
    }
    
    return { advantage, canUse }
  }
  
  // ========== 高级位置分析 ==========
  
  canAttackHitOpponent(direction, range = 1) {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    // 女骑士攻击范围+1
    const mySkill = this.getMyState().skill
    const isSkillSealed = this.match.skillSealed
    let actualRange = range
    if (mySkill?.id === 'knight_female' && !isSkillSealed) {
      actualRange = range + 1
    }
    
    for (let i = 1; i <= actualRange; i++) {
      const checkX = myPos.x + offset.x * i
      const checkY = myPos.y + offset.y * i
      
      if (checkX < 0 || checkX >= this.match.map.width || checkY < 0 || checkY >= this.match.map.height) break
      if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
        if (!this.match.map.shapeLayout[checkY] || this.match.map.shapeLayout[checkY][checkX] !== 1) break
      }
      if (this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)) break
      if (checkX === oppPos.x && checkY === oppPos.y) return true
    }
    return false
  }
  
  getBestAttackDirection(range = 1) {
    const directions = ['up', 'down', 'left', 'right']
    const preferredDir = this.getDirectionToOpponent()
    const orderedDirs = [preferredDir, ...directions.filter(d => d !== preferredDir)]
    
    for (const dir of orderedDirs) {
      if (this.canAttackHitOpponent(dir, range)) return dir
    }
    return null
  }
  
  // 计算对手能攻击到的格子
  getOpponentAttackRange() {
    const oppPos = this.getOpponentState().position
    const attackCells = new Set()
    const directions = ['up', 'down', 'left', 'right']
    
    for (const dir of directions) {
      const offset = DIRECTION_OFFSET[dir]
      for (let range = 1; range <= 2; range++) {
        const checkX = oppPos.x + offset.x * range
        const checkY = oppPos.y + offset.y * range
        
        if (checkX < 0 || checkX >= this.match.map.width || checkY < 0 || checkY >= this.match.map.height) break
        if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
          if (!this.match.map.shapeLayout[checkY] || this.match.map.shapeLayout[checkY][checkX] !== 1) break
        }
        if (this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)) break
        attackCells.add(`${checkX},${checkY}`)
      }
    }
    return attackCells
  }
  
  isInOpponentAttackRange() {
    const myPos = this.getMyState().position
    return this.getOpponentAttackRange().has(`${myPos.x},${myPos.y}`)
  }
  
  isSafeMove(direction) {
    const myPos = this.getMyState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    const newX = myPos.x + offset.x
    const newY = myPos.y + offset.y
    return !this.getOpponentAttackRange().has(`${newX},${newY}`)
  }
  
  // BFS路径规划
  findPathToPosition(targetPos) {
    const myPos = this.getMyState().position
    const queue = [{ x: myPos.x, y: myPos.y, path: [] }]
    const visited = new Set([`${myPos.x},${myPos.y}`])
    const directions = ['up', 'down', 'left', 'right']
    
    while (queue.length > 0) {
      const current = queue.shift()
      if (current.x === targetPos.x && current.y === targetPos.y) return current.path
      
      for (const dir of directions) {
        const offset = DIRECTION_OFFSET[dir]
        const newX = current.x + offset.x
        const newY = current.y + offset.y
        const key = `${newX},${newY}`
        
        if (visited.has(key)) continue
        if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) continue
        if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
          if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) continue
        }
        if (this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)) continue
        if (this.match.map.sandDunes?.some(d => d.x === newX && d.y === newY)) continue
        
        visited.add(key)
        queue.push({ x: newX, y: newY, path: [...current.path, dir] })
      }
    }
    return []
  }
  
  // ========== 战术决策 ==========
  
  // 判断应该追击还是逃跑（增强版 - 更激进）
  shouldChaseOrEscape() {
    const myHp = this.getMyState().hp
    const oppHp = this.getOpponentState().hp
    const distance = this.getDistanceToOpponent()
    const config = this.getDifficultyConfig()
    
    // 困难模式更激进追击
    if (config.predictionLevel >= 3) {
      // 血量相等或优势时主动追击
      if (myHp >= oppHp) return 'chase'
      // 对手血量低时果断追击终结
      if (oppHp <= 1) return 'chase'
    }
    
    // 血量优势时追击
    if (myHp > oppHp) return 'chase'
    // 对手血量低时追击（尝试终结）
    if (oppHp <= 1 && myHp >= 2) return 'chase'
    // 血量劣势且近距离时逃跑
    if (myHp < oppHp && distance <= 2) return 'escape'
    // 在对手攻击范围内且血量低时逃跑
    if (this.isInOpponentAttackRange() && myHp <= 1) return 'escape'
    // 中等距离主动进攻
    if (distance <= 3 && myHp >= oppHp) return 'chase'
    // 默认进攻（不再被动中立）
    return 'chase'
  }
  
  // ========== 智能选牌策略 ==========
  
  selectCards() {
    const currentCards = this.getMyState().currentCards
    const config = this.getDifficultyConfig()
    const distance = this.getDistanceToOpponent()
    const myHp = this.getMyState().hp
    const oppHp = this.getOpponentState().hp
    const isInDanger = this.isInOpponentAttackRange()
    const tactic = this.shouldChaseOrEscape()
    
    // 评估每张牌的价值
    const cardValues = currentCards.map((card, index) => {
      let value = this.evaluateCard(card, distance, myHp, oppHp, isInDanger, tactic)
      // 添加随机性
      value += Math.random() * config.randomness
      return { index, value, card }
    })
    
    // 按价值排序，选前3张
    cardValues.sort((a, b) => b.value - a.value)
    const selectedIndices = cardValues.slice(0, 3).map(cv => cv.index)
    
    console.log(`[AI] 选牌: ${selectedIndices.map(i => currentCards[i].name).join(', ')}, 战术: ${tactic}`)
    return selectedIndices
  }
  
  // 评估单张牌的价值
  evaluateCard(card, distance, myHp, oppHp, isInDanger, tactic) {
    if (card.isSkillCard) {
      if (card.sealed) return 0
      return this.evaluateSkillCard(card, distance, myHp, oppHp)
    }
    
    switch (card.type) {
      case 'attack':
        return this.evaluateAttackCard(card, distance, oppHp, tactic)
      case 'defense':
        return this.evaluateDefenseCard(myHp, isInDanger)
      case 'move':
        return this.evaluateMoveCard(card, distance, tactic, isInDanger)
      case 'scout':
        return this.evaluateScoutCard(distance)
      default:
        return 3
    }
  }
  
  evaluateAttackCard(card, distance, oppHp, tactic) {
    const range = card.range || 1
    const canHit = this.getBestAttackDirection(range) !== null
    const config = this.getDifficultyConfig()
    
    if (!canHit) {
      // 无法命中时，困难模式仍保留攻击牌期望接近后使用
      if (config.predictionLevel >= 3 && distance <= 3) return 5
      return distance <= 3 ? 2 : 1
    }
    
    let value = 0
    // 基础价值：能命中的攻击（增强基础价值）
    value = distance <= range ? 12 : 8
    
    // 2格攻击范围更灵活，价值更高
    if (range === 2) value += 3
    
    // 追击战术时攻击价值更高
    if (tactic === 'chase') value += 4
    
    // 对手血量低时攻击价值更高（可以终结）
    if (oppHp <= 1) value += 8
    else if (oppHp <= 2) value += 4
    
    // 困难模式额外加成
    if (config.predictionLevel >= 3) value += 2
    
    return value
  }
  
  evaluateDefenseCard(myHp, isInDanger) {
    let value = 5
    
    // 血量低时防御更重要
    if (myHp <= 2) value += 6
    else if (myHp <= 3) value += 3
    
    // 在对手攻击范围内时防御更重要
    if (isInDanger) value += 4
    
    return value
  }
  
  // 检查移动牌的方向是否有效
  isMoveCardDirectionValid(card) {
    if (!card || card.type !== 'move') return false
    const direction = card.direction
    if (!direction) return false
    return this.canMoveInDirection(direction)
  }
  
  evaluateMoveCard(card, distance, tactic, isInDanger) {
    const config = this.getDifficultyConfig()
    
    // 关键修复：检查移动牌的具体方向是否可行
    const direction = card.direction
    if (direction && !this.canMoveInDirection(direction)) {
      // 这个方向不可行（被边界/障碍阻挡）
      // 困难模式完全不选无效移动牌
      if (config.predictionLevel >= 2) {
        return 0
      }
      // 简单模式给予极低价值
      return 0.5
    }
    
    let value = 3
    
    // 逃跑战术时移动价值高
    if (tactic === 'escape') {
      value = isInDanger ? 9 : 7
    }
    // 追击战术时，距离远则移动价值高
    else if (tactic === 'chase') {
      value = distance > 3 ? 8 : 4
    }
    // 中立战术时
    else {
      value = distance > 2 ? 6 : 3
    }
    
    // 检查移动方向是否是最佳方向
    if (direction) {
      const tactic = this.shouldChaseOrEscape()
      let bestDir = tactic === 'escape' ? 
        this.getDirectionAwayFromOpponent() : 
        this.getDirectionToOpponent()
      
      if (direction === bestDir) {
        value += 3 // 最佳方向额外加成
      }
      
      // 检查是否是安全移动
      if (this.isSafeMove(direction)) {
        value += 1
      }
    }
    
    // 检查是否有安全的移动方向
    const movableDirs = this.getMovableDirections()
    const safeDirs = movableDirs.filter(d => this.isSafeMove(d))
    if (safeDirs.length === 0 && isInDanger) {
      // 无路可逃，防御可能更重要
      value -= 2
    }
    
    return value
  }
  
  evaluateScoutCard(distance) {
    // 迷雾关闭时探查牌无用
    if (!this.match.fogEnabled) return 0
    
    let value = 4
    // 远距离时探查更有用（需要找到对手）
    if (distance > 3) value += 2
    
    return value
  }
  
  evaluateSkillCard(card, distance, myHp, oppHp) {
    const skillId = card.skillId
    let value = 8
    
    // 根据不同技能调整价值
    switch (skillId) {
      case 'mage_male': // 天降陨石
        value = 10 // 高价值AOE
        break
      case 'knight_male': // 旋风斩
        value = distance <= 1 ? 10 : 3 // 近距离才有价值
        break
      case 'reader_male': // 回忆过去
        value = 5 // 查看历史视野，辅助性
        break
      case 'archer_male': // 百步穿杨
        // 远距离穿透攻击
        value = distance > 2 ? 9 : 6
        break
    }
    
    return value
  }
  
  // ========== 智能排序策略 ==========
  
  // 检查两个移动方向是否相反
  isOppositeMove(dir1, dir2) {
    const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' }
    return opposites[dir1] === dir2
  }
  
  // 模拟出牌顺序，检测最终位置和有效性
  simulateCardOrder(handCards) {
    const myPos = { ...this.getMyState().position }
    const oppPos = this.getOpponentState().position
    const moveSequence = []
    let attackCount = 0
    let defenseCount = 0
    
    for (const card of handCards) {
      if (card.isSkillCard) continue
      
      if (card.type === 'move') {
        // 模拟移动
        const tactic = this.shouldChaseOrEscape()
        let bestDir = null
        
        if (tactic === 'chase') {
          bestDir = this.getDirectionToOpponent()
        } else if (tactic === 'escape') {
          bestDir = this.getDirectionAwayFromOpponent()
        }
        
        // 检查这个方向是否可行
        const movableDirs = this.getMovableDirectionsFrom(myPos)
        if (movableDirs.includes(bestDir)) {
          const offset = DIRECTION_OFFSET[bestDir]
          myPos.x += offset.x
          myPos.y += offset.y
          moveSequence.push(bestDir)
        } else if (movableDirs.length > 0) {
          // 选择任意可行方向
          const dir = movableDirs[0]
          const offset = DIRECTION_OFFSET[dir]
          myPos.x += offset.x
          myPos.y += offset.y
          moveSequence.push(dir)
        }
      } else if (card.type === 'attack') {
        // 检查当前位置能否攻击到对手
        const range = card.range || 1
        const canHit = this.canAttackHitOpponentFromPos(myPos, oppPos, range)
        if (canHit) attackCount++
      } else if (card.type === 'defense') {
        defenseCount++
      }
    }
    
    return {
      finalPos: myPos,
      moveSequence,
      attackCount,
      defenseCount,
      netDistance: Math.abs(myPos.x - this.getOpponentState().position.x) + 
                   Math.abs(myPos.y - this.getOpponentState().position.y)
    }
  }
  
  // 从指定位置检查能否攻击到对手
  canAttackHitOpponentFromPos(fromPos, oppPos, range) {
    const directions = ['up', 'down', 'left', 'right']
    
    for (const dir of directions) {
      const offset = DIRECTION_OFFSET[dir]
      for (let i = 1; i <= range; i++) {
        const checkX = fromPos.x + offset.x * i
        const checkY = fromPos.y + offset.y * i
        
        if (checkX < 0 || checkX >= this.match.map.width || checkY < 0 || checkY >= this.match.map.height) break
        if (this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)) break
        if (checkX === oppPos.x && checkY === oppPos.y) return true
      }
    }
    return false
  }
  
  // 从指定位置获取可移动方向
  getMovableDirectionsFrom(fromPos) {
    const directions = ['up', 'down', 'left', 'right']
    return directions.filter(dir => {
      const offset = DIRECTION_OFFSET[dir]
      const newX = fromPos.x + offset.x
      const newY = fromPos.y + offset.y
      
      if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) return false
      if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
        if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) return false
      }
      if (this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)) return false
      if (this.match.map.sandDunes?.some(d => d.x === newX && d.y === newY)) return false
      
      const oppPos = this.getOpponentState().position
      if (oppPos.x === newX && oppPos.y === newY) return false
      
      return true
    })
  }
  
  // 优化移动牌顺序，避免无效组合（增强版）
  optimizeMoveOrder(handCards) {
    const config = this.getDifficultyConfig()
    
    // 简单模式不优化
    if (config.predictionLevel < 2) return handCards
    
    // 困难模式：完整模拟并优化
    if (config.predictionLevel >= 3) {
      // 1. 模拟当前位置
      let simulatedPos = { ...this.getMyState().position }
      const validCards = []
      const invalidCards = []
      
      // 2. 按顺序模拟每张牌
      for (let i = 0; i < handCards.length; i++) {
        const card = handCards[i]
        
        if (card.isSkillCard) {
          validCards.push(card)
          continue
        }
        
        if (card.type === 'move') {
          const direction = card.direction
          if (!direction) {
            invalidCards.push(card)
            continue
          }
          
          // 检查从当前模拟位置能否执行此移动
          const canMove = this.canMoveFromPosition(simulatedPos, direction)
          
          if (canMove) {
            // 更新模拟位置
            const offset = DIRECTION_OFFSET[direction]
            simulatedPos.x += offset.x
            simulatedPos.y += offset.y
            validCards.push(card)
          } else {
            // 无效移动牌，放到最后
            invalidCards.push(card)
            console.log(`[AI优化] 移动牌 ${card.name} 方向 ${direction} 在位置 (${simulatedPos.x},${simulatedPos.y}) 无效`)
          }
        } else {
          validCards.push(card)
        }
      }
      
      // 3. 检查是否有连续相反移动
      const moveCardsInValid = validCards.filter(c => !c.isSkillCard && c.type === 'move')
      if (moveCardsInValid.length >= 2) {
        // 检测相邻的相反方向移动
        for (let i = 0; i < moveCardsInValid.length - 1; i++) {
          const dir1 = moveCardsInValid[i].direction
          const dir2 = moveCardsInValid[i + 1].direction
          
          if (this.isOppositeMove(dir1, dir2)) {
            // 发现相邻相反移动，尝试调整顺序
            // 将相反方向的那张牌移到最后一张移动牌之后
            console.log(`[AI优化] 发现相邻相反移动: ${dir1} -> ${dir2}, 调整顺序`)
            
            // 找到这对相反移动牌在validCards中的位置
            const firstIndex = validCards.findIndex(c => c === moveCardsInValid[i])
            const secondIndex = validCards.findIndex(c => c === moveCardsInValid[i + 1])
            
            if (firstIndex !== -1 && secondIndex !== -1) {
              // 将第二张相反方向的牌移到所有移动牌之后
              const secondCard = validCards[secondIndex]
              validCards.splice(secondIndex, 1)
              
              // 找到最后一张移动牌的位置
              let lastMoveIndex = -1
              for (let j = validCards.length - 1; j >= 0; j--) {
                if (!validCards[j].isSkillCard && validCards[j].type === 'move') {
                  lastMoveIndex = j
                  break
                }
              }
              
              // 插入到最后一张移动牌之后
              if (lastMoveIndex !== -1) {
                validCards.splice(lastMoveIndex + 1, 0, secondCard)
              } else {
                validCards.push(secondCard)
              }
            }
            
            // 重新模拟确认调整后的顺序有效
            break // 只处理第一对相反移动
          }
        }
      }
      
      // 4. 合并有效牌和无效牌
      const optimizedCards = [...validCards, ...invalidCards]
      
      console.log(`[AI优化] 原顺序: ${handCards.map(c => c.name).join(' → ')}`)
      console.log(`[AI优化] 新顺序: ${optimizedCards.map(c => c.name).join(' → ')}`)
      
      return optimizedCards
    }
    
    // 普通模式：简单优化
    // 提取移动牌并过滤无效方向
    const validMoveCards = []
    const otherCards = []
    
    handCards.forEach((card) => {
      if (!card.isSkillCard && card.type === 'move') {
        const direction = card.direction
        if (direction && this.canMoveInDirection(direction)) {
          validMoveCards.push(card)
        } else {
          // 无效移动牌放到最后
          otherCards.push(card)
        }
      } else {
        otherCards.push(card)
      }
    })
    
    // 将有效移动牌按战术方向排序
    const tactic = this.shouldChaseOrEscape()
    const primaryDir = tactic === 'escape' ? 
      this.getDirectionAwayFromOpponent() : 
      this.getDirectionToOpponent()
    
    validMoveCards.sort((a, b) => {
      if (a.direction === primaryDir && b.direction !== primaryDir) return -1
      if (b.direction === primaryDir && a.direction !== primaryDir) return 1
      return 0
    })
    
    return [...validMoveCards, ...otherCards]
  }
  
  // 从指定位置检查能否移动
  canMoveFromPosition(pos, direction) {
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    const newX = pos.x + offset.x
    const newY = pos.y + offset.y
    
    // 检查边界
    if (newX < 0 || newX >= this.match.map.width || newY < 0 || newY >= this.match.map.height) {
      return false
    }
    
    // 检查形状地图
    if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
      if (!this.match.map.shapeLayout[newY] || this.match.map.shapeLayout[newY][newX] !== 1) {
        return false
      }
    }
    
    // 检查障碍物
    if (this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)) {
      return false
    }
    
    // 检查沙丘
    if (this.match.map.sandDunes?.some(d => d.x === newX && d.y === newY)) {
      return false
    }
    
    // 检查对手位置（使用当前对手位置）
    const oppPos = this.getOpponentState().position
    if (oppPos.x === newX && oppPos.y === newY) {
      return false
    }
    
    return true
  }
  
  orderCards(handCards) {
    const config = this.getDifficultyConfig()
    const distance = this.getDistanceToOpponent()
    const myHp = this.getMyState().hp
    const oppHp = this.getOpponentState().hp
    const isInDanger = this.isInOpponentAttackRange()
    const tactic = this.shouldChaseOrEscape()
    const isPriority = this.match.isPlayer1Priority ? (this.playerIndex === 0) : (this.playerIndex === 1)
    
    // 考虑对手技能威胁
    const skillThreat = this.getOpponentSkillThreat()
    
    // 考虑传送门
    const usePortal = this.shouldUsePortal()
    
    const cardPriorities = handCards.map((card, index) => {
      let priority = this.calculateCardPriority(card, distance, myHp, oppHp, isInDanger, tactic, isPriority)
      
      // 根据对手技能威胁调整优先级
      if (skillThreat.threat >= 7) {
        // 高威胁时，防御和移动优先
        if (card.type === 'defense') priority += 3
        if (card.type === 'move' && tactic === 'escape') priority += 2
      }
      
      // 传送门策略
      if (usePortal && card.type === 'move') {
        priority += 2
      }
      
      priority += Math.random() * config.randomness * 0.5
      return { index, priority, card }
    })
    
    cardPriorities.sort((a, b) => b.priority - a.priority)
    let orderedCards = cardPriorities.map(cp => cp.card)
    
    // 优化移动牌顺序（困难模式）
    if (config.predictionLevel >= 3) {
      orderedCards = this.optimizeMoveOrder(orderedCards)
    }
    
    console.log(`[AI] 排序: ${orderedCards.map(c => c.name).join(' → ')}, 战术: ${tactic}, 技能威胁: ${skillThreat.threat}`)
    return orderedCards
  }
  
  calculateCardPriority(card, distance, myHp, oppHp, isInDanger, tactic, isPriority) {
    // 技能牌优先级处理
    if (card.isSkillCard) {
      if (card.sealed) return 0
      
      // 根据技能类型决定优先级
      const skillId = card.skillId
      if (skillId === 'knight_male') {
        // 旋风斩需要近距离，距离合适时优先出
        return distance <= 1 ? 10 : 2
      }
      if (skillId === 'mage_male') {
        // 陨石开局先出
        return 9
      }
      return 7
    }
    
    let priority = 0
    
    switch (card.type) {
      case 'attack':
        const canHit = this.getBestAttackDirection(card.range || 1) !== null
        if (canHit) {
          // 先手时攻击优先
          if (isPriority) {
            priority = distance <= 2 ? 9 : 5
          } else {
            // 后手时，根据情况决定
            priority = tactic === 'chase' ? 8 : 6
          }
        } else {
          priority = 2
        }
        break
        
      case 'defense':
        // 血量低或处于危险时防御优先
        if (myHp <= 2 && isInDanger) {
          priority = isPriority ? 6 : 10 // 后手更需要防御
        } else if (myHp <= 3) {
          priority = 7
        } else {
          priority = 5
        }
        break
        
      case 'move':
        // 逃跑战术时移动高优先
        if (tactic === 'escape' && isInDanger) {
          priority = 10
        } else if (tactic === 'chase' && distance > 2) {
          // 追击时先移动接近
          priority = isPriority ? 8 : 6
        } else {
          priority = 3
        }
        break
        
      case 'scout':
        // 迷雾关闭时无用
        if (!this.match.fogEnabled) return 0
        priority = distance > 3 ? 6 : 4
        break
    }
    
    return priority
  }
  
  // ========== 查看对手牌策略 ==========
  
  chooseViewOpponentCard() {
    const config = this.getDifficultyConfig()
    
    if (config.predictionLevel >= 2) {
      // Hard难度：更智能的选择
      const distance = this.getDistanceToOpponent()
      // 近距离时第一张可能是攻击，远距离时可能是移动
      if (distance <= 2) {
        // 查看第一张（可能是攻击牌）
        console.log(`[AI] 选择查看对手第一张牌（预测攻击）`)
        return 'first'
      } else {
        // 查看最后一张（可能是移动或特殊牌）
        console.log(`[AI] 选择查看对手最后一张牌`)
        return 'last'
      }
    }
    
    // 简单策略：随机偏向第一张
    const choice = Math.random() < 0.6 ? 'first' : 'last'
    console.log(`[AI] 选择查看对手${choice === 'first' ? '第一张' : '最后一张'}牌`)
    return choice
  }
  
  // ========== 执行AI回合 ==========
  
  executeSelectCards() {
    const config = this.getDifficultyConfig()
    const delay = config.thinkDelay + Math.random() * 1000
    
    setTimeout(() => {
      if (this.match.phase !== 'selecting_priority' && this.match.phase !== 'selecting_normal') {
        console.log(`[AI] 阶段已变更，跳过选牌`)
        return
      }
      
      const selectedIndices = this.selectCards()
      this.match.selectCards(this.aiSocketId, selectedIndices)
    }, delay)
  }
  
  executeConfirmOrder() {
    const config = this.getDifficultyConfig()
    const delay = config.thinkDelay * 0.8 + Math.random() * 500
    
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
  
  executeViewOpponentCard() {
    const delay = 500 + Math.random() * 500
    
    setTimeout(() => {
      const choice = this.chooseViewOpponentCard()
      this.match.viewOpponentCard(this.aiSocketId, choice)
    }, delay)
  }
  
  executePlayCard() {
    const config = this.getDifficultyConfig()
    const delay = 200 + Math.random() * 300
    
    setTimeout(() => {
      if (this.match.phase !== 'playing') {
        console.log(`[AI] 不在出牌阶段，跳过出牌`)
        return
      }
      
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
  
  executeRematch() {
    const delay = 1000 + Math.random() * 500
    setTimeout(() => {
      this.match.requestRematch(this.aiSocketId)
    }, delay)
  }
}