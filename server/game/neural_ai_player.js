/**
 * 神经网络AI玩家 - 使用ONNX Runtime运行训练好的模型
 * 替代原有的规则AI，提供更强的对局能力
 * 
 * 使用方式:
 * 1. 在Python端训练模型: python train_ppo.py
 * 2. 导出ONNX: python export_onnx.py checkpoints/model_final.pt
 * 3. 将ONNX模型文件放到服务端可访问路径
 * 4. 在room.js或match.js中使用NeuralAIPlayer替代AIPlayer
 */

import { CARD_TYPES, DIRECTION_OFFSET, CHARACTER_SKILLS, GAME_CONFIG, MAP_THEMES, THEME_LIST, PROFESSIONS } from '../shared/constants.js'

// ONNX Runtime Node.js绑定
// 需要安装: npm install onnxruntime-node
let ort = null
try {
  ort = await import('onnxruntime-node')
} catch (e) {
  console.warn('[NeuralAI] onnxruntime-node 未安装，将回退到规则AI')
}

// ==================== 状态编码器 ====================

const CARD_TYPE_MAP = { move: 0, attack: 1, defense: 2, scout: 3, skill: 4 }
const DIRECTION_MAP = { up: 0, right: 1, down: 2, left: 3, null: 4 }
const SCOUT_TYPE_MAP = { row: 0, col: 1, around: 2, null: 3 }

// 主题ID到索引的映射（用于标量特征编码）
const THEME_ID_MAP = {}
THEME_LIST.forEach((id, idx) => { THEME_ID_MAP[id] = idx })

// 职业ID到索引的映射（用于角色编码）
const PROFESSION_ID_MAP = {}
PROFESSIONS.forEach((id, idx) => { PROFESSION_ID_MAP[id] = idx })

const MAX_MAP_SIZE = 11
const MAX_CARDS = 8
const MAX_OPP_CARDS = 3  // 最多查看3张对手牌
const HAND_SIZE = 3
const SCALAR_DIM = 55    // v3: 30→55维标量特征
const MAP_CHANNELS = 12  // v3: 10→12通道地图特征

/**
 * 编码单张卡牌为特征向量 (8维)
 */
function encodeCard(card) {
  const features = new Float32Array(8)
  features[0] = CARD_TYPE_MAP[card.type] ?? 0
  features[1] = DIRECTION_MAP[card.direction] ?? 4
  features[2] = card.range || 0
  features[3] = SCOUT_TYPE_MAP[card.scoutType] ?? 3
  features[4] = card.isSkillCard ? 1.0 : 0.0
  features[5] = card.invalidated ? 1.0 : 0.0
  features[6] = 0  // card_key index (简化)
  features[7] = 1.0  // 存在标记
  return features
}

/**
 * 编码地图格子 (10维)
 */
function encodeMapCell(x, y, map, playerStates) {
  const features = new Float32Array(10)
  
  // 有效位置
  if (map.isShapeMap && map.shapeLayout) {
    features[0] = (map.shapeLayout[y] && map.shapeLayout[y][x] === 1) ? 1.0 : 0.0
  } else {
    features[0] = (x >= 0 && x < map.width && y >= 0 && y < map.height) ? 1.0 : 0.0
  }
  
  // 障碍物
  features[1] = map.obstacles.some(o => o.x === x && o.y === y && !o.isBoundary) ? 1.0 : 0.0
  
  // 草丛（实际属性名为map.grass，不是map.grassAreas）
  features[2] = map.grass ? (map.grass.some(g => g.x === x && g.y === y) ? 1.0 : 0.0) : 0.0
  
  // 沙丘
  features[3] = map.sandDunes ? (map.sandDunes.some(s => s.x === x && s.y === y) ? 1.0 : 0.0) : 0.0
  
  // 传送门（结构为{entry:{x,y}, exit:{x,y}}，需同时检查入口和出口）
  features[4] = map.portals ? (map.portals.some(p => (p.entry.x === x && p.entry.y === y) || (p.exit.x === x && p.exit.y === y)) ? 1.0 : 0.0) : 0.0
  
  // 玩家位置和血量
  for (let i = 0; i < playerStates.length && i < 2; i++) {
    if (playerStates[i].position.x === x && playerStates[i].position.y === y) {
      features[5 + i] = 1.0
      features[7 + i] = playerStates[i].hp
    }
  }
  
  // 边界障碍物（与Python端channel 9对齐）
  features[9] = map.obstacles.some(o => o.x === x && o.y === y && o.isBoundary) ? 1.0 : 0.0
  
  return features
}

/**
 * 检查攻击能否命中对手（用于特征编码）
 */
function canAttackHit(game, playerIndex, direction, attackRange = 1) {
  const ps = game.playerStates
  const me = ps[playerIndex]
  const opp = ps[1 - playerIndex]
  const offset = DIRECTION_OFFSET[direction]
  if (!offset) return false
  // 女骑士攻击+1
  const skill = me.skill || {}
  if (skill.passiveEffect === 'tough_thrust') attackRange += 1
  for (let r = 1; r <= attackRange; r++) {
    const cx = me.position.x + offset.x * r
    const cy = me.position.y + offset.y * r
    if (cx < 0 || cx >= game.map.width || cy < 0 || cy >= game.map.height) break
    if (game.map.obstacles.some(o => o.x === cx && o.y === cy && !o.isBoundary)) break
    if (opp.position.x === cx && opp.position.y === cy) return true
  }
  return false
}

/**
 * 编码完整游戏状态为神经网络输入 (v3增强版)
 * 新增: 传送门配对+威胁地图(12通道), 扩展标量特征(55维)
 */
function encodeState(match, playerIndex) {
  const opponentIndex = playerIndex === 0 ? 1 : 0
  const myState = match.playerStates[playerIndex]
  const oppState = match.playerStates[opponentIndex]
  const map = match.map
  
  // 1. 地图编码 (12, max_map_size, max_map_size) — v3: +portal pairs +threat map
  const mapFeatures = new Float32Array(MAP_CHANNELS * MAX_MAP_SIZE * MAX_MAP_SIZE)
  for (let y = 0; y < Math.min(map.height, MAX_MAP_SIZE); y++) {
    for (let x = 0; x < Math.min(map.width, MAX_MAP_SIZE); x++) {
      const cellFeatures = encodeMapCell(x, y, map, match.playerStates)
      for (let c = 0; c < 10; c++) {
        mapFeatures[c * MAX_MAP_SIZE * MAX_MAP_SIZE + y * MAX_MAP_SIZE + x] = cellFeatures[c]
      }
    }
  }
  // 通道10: 传送门配对标记
  if (map.portals) {
    for (let idx = 0; idx < map.portals.length; idx++) {
      const val = (idx + 1) / Math.max(map.portals.length, 1)
      const p = map.portals[idx]
      const ey = p.entry.y, ex = p.entry.x, ay = p.exit.y, ax = p.exit.x
      if (ey >= 0 && ey < MAX_MAP_SIZE && ex >= 0 && ex < MAX_MAP_SIZE)
        mapFeatures[10 * MAX_MAP_SIZE * MAX_MAP_SIZE + ey * MAX_MAP_SIZE + ex] = val
      if (ay >= 0 && ay < MAX_MAP_SIZE && ax >= 0 && ax < MAX_MAP_SIZE)
        mapFeatures[10 * MAX_MAP_SIZE * MAX_MAP_SIZE + ay * MAX_MAP_SIZE + ax] = val
    }
  }
  // 通道11: 对手攻击威胁地图
  const oppSkill = oppState.skill || {}
  const oppBonusRange = oppSkill.passiveEffect === 'tough_thrust' ? 1 : 0
  const dirs = ['up', 'down', 'left', 'right']
  for (const d of dirs) {
    const offset = DIRECTION_OFFSET[d]
    if (!offset) continue
    for (let r = 1; r <= 2 + oppBonusRange; r++) {
      const cx = oppState.position.x + offset.x * r
      const cy = oppState.position.y + offset.y * r
      if (cx < 0 || cx >= map.width || cy < 0 || cy >= map.height) break
      if (cy >= 0 && cy < MAX_MAP_SIZE && cx >= 0 && cx < MAX_MAP_SIZE)
        mapFeatures[11 * MAX_MAP_SIZE * MAX_MAP_SIZE + cy * MAX_MAP_SIZE + cx] = 1.0
      if (map.obstacles.some(o => o.x === cx && o.y === cy && !o.isBoundary)) break
    }
  }
  
  // 2. 己方卡牌编码 (max_cards, 8)
  const cardFeatures = new Float32Array(MAX_CARDS * 8)
  const currentCards = myState.currentCards || []
  for (let i = 0; i < Math.min(currentCards.length, MAX_CARDS); i++) {
    const cardFeat = encodeCard(currentCards[i])
    cardFeatures.set(cardFeat, i * 8)
  }
  
  // 3. 对手可见牌编码 (max_opp_cards, 8) - 新增v2
  const oppCardFeatures = new Float32Array(MAX_OPP_CARDS * 8)
  const oppHand = oppState.handCards || []
  const oppCurrent = oppState.currentCards || []
  // 使用通过探查技能看到的对手牌
  const seenCards = match[`oppCardsSeen_${playerIndex}`] || []
  if (seenCards.length > 0) {
    for (let i = 0; i < Math.min(seenCards.length, MAX_OPP_CARDS); i++) {
      const cardFeat = encodeCard(seenCards[i])
      oppCardFeatures.set(cardFeat, i * 8)
    }
  } else if (oppHand.length > 0) {
    // 推断：选牌后对手手牌可能有信息（如女盗贼隔墙有眼可见）
    // 简化处理：如果有对手手牌信息，编码前几张
    for (let i = 0; i < Math.min(oppHand.length, MAX_OPP_CARDS); i++) {
      if (oppHand[i] && !oppHand[i].faceDown) {
        const cardFeat = encodeCard(oppHand[i])
        oppCardFeatures.set(cardFeat, i * 8)
      }
    }
  }
  
  // 4. 标量特征 (55) - v3: 原30维 + 25维新增
  const scalarFeatures = new Float32Array(SCALAR_DIM)
  const myMaxHp = GAME_CONFIG.INITIAL_HP + (myState.skill?.bonusHp || 0)
  const oppMaxHp = GAME_CONFIG.INITIAL_HP + (oppState.skill?.bonusHp || 0)
  
  // 原有20维
  scalarFeatures[0] = (match.currentRound || 1) / 20.0
  scalarFeatures[1] = match.isPlayer1Priority ? 1.0 : 0.0
  scalarFeatures[2] = playerIndex === (match.isPlayer1Priority ? 0 : 1) ? 1.0 : 0.0
  scalarFeatures[3] = myState.hp / Math.max(myMaxHp, 1)
  scalarFeatures[4] = oppState.hp / Math.max(oppMaxHp, 1)
  scalarFeatures[5] = myState.isDefending ? 1.0 : 0.0
  scalarFeatures[6] = oppState.isDefending ? 1.0 : 0.0
  scalarFeatures[7] = myState.isHidden ? 1.0 : 0.0
  scalarFeatures[8] = match.frozenThisRound ? 1.0 : 0.0
  scalarFeatures[9] = match.skillSealed ? 1.0 : 0.0
  scalarFeatures[10] = (myState.skillCooldown || 0) / 5.0
  scalarFeatures[11] = match.theme ? (THEME_ID_MAP[match.theme.id] ?? 0) / Math.max(THEME_LIST.length, 1) : 0
  scalarFeatures[12] = map.width / MAX_MAP_SIZE
  scalarFeatures[13] = map.height / MAX_MAP_SIZE
  scalarFeatures[14] = map.isSingleRow ? 1.0 : 0.0
  scalarFeatures[15] = map.isShapeMap ? 1.0 : 0.0
  scalarFeatures[16] = (oppMaxHp - oppState.hp) / Math.max(oppMaxHp, 1)
  scalarFeatures[17] = (myMaxHp - myState.hp) / Math.max(myMaxHp, 1)
  const myProfession = myState.skill?.id ? myState.skill.id.split('_')[0] : null
  scalarFeatures[18] = myProfession ? (PROFESSION_ID_MAP[myProfession] ?? 0) / Math.max(PROFESSIONS.length, 1) : 0
  const oppProfession = oppState.skill?.id ? oppState.skill.id.split('_')[0] : null
  scalarFeatures[19] = oppProfession ? (PROFESSION_ID_MAP[oppProfession] ?? 0) / Math.max(PROFESSIONS.length, 1) : 0
  
  // ===== 新增10维标量特征 (20-29) =====
  // 20: 与对手的曼哈顿距离（归一化）
  const manhattan = Math.abs(myState.position.x - oppState.position.x) + Math.abs(myState.position.y - oppState.position.y)
  scalarFeatures[20] = Math.min(manhattan, 10) / 10.0
  
  // 21: 己方能否攻击到对手（检查4个方向）
  const canIHit = ['up', 'down', 'left', 'right'].some(d => canAttackHit(match, playerIndex, d))
  scalarFeatures[21] = canIHit ? 1.0 : 0.0
  
  // 22: 对手能否攻击到己方
  const canOppHit = ['up', 'down', 'left', 'right'].some(d => canAttackHit(match, opponentIndex, d))
  scalarFeatures[22] = canOppHit ? 1.0 : 0.0
  
  // 23: 己方与对手间障碍物数量（简化：取主方向上的障碍物数）
  let obstaclesBetween = 0
  const dx = oppState.position.x - myState.position.x
  const dy = oppState.position.y - myState.position.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    const step = dx > 0 ? 1 : -1
    for (let x = myState.position.x; x !== oppState.position.x; x += step) {
      const midY = myState.position.y + Math.round(dy * (x - myState.position.x) / (Math.abs(dx) || 1))
      if (map.obstacles.some(o => o.x === x && o.y === midY && !o.isBoundary)) obstaclesBetween++
    }
  } else {
    const step = dy > 0 ? 1 : -1
    for (let y = myState.position.y; y !== oppState.position.y; y += step) {
      const midX = myState.position.x + Math.round(dx * (y - myState.position.y) / (Math.abs(dy) || 1))
      if (map.obstacles.some(o => o.x === midX && o.y === y && !o.isBoundary)) obstaclesBetween++
    }
  }
  scalarFeatures[23] = Math.min(obstaclesBetween, 5) / 5.0
  
  // 24: 到最近传送门入口的距离
  if (map.portals && map.portals.length > 0) {
    const minPortalDist = Math.min(...map.portals.map(p => 
      Math.abs(myState.position.x - p.entry.x) + Math.abs(myState.position.y - p.entry.y)
    ))
    scalarFeatures[24] = Math.min(minPortalDist, 10) / 10.0
  } else {
    scalarFeatures[24] = 1.0  // 无传送门
  }
  
  // 25-29: 对手手牌类型概率分布（基于已查看的牌）
  const cardTypeCounts = [0, 0, 0, 0, 0] // move/attack/defense/scout/skill
  let totalSeen = 0
  for (let i = 0; i < MAX_OPP_CARDS; i++) {
    if (oppCardFeatures[i * 8 + 7] > 0) {  // 存在标记
      cardTypeCounts[Math.floor(oppCardFeatures[i * 8])]++
      totalSeen++
    }
  }
  if (totalSeen > 0) {
    for (let t = 0; t < 5; t++) cardTypeCounts[t] /= totalSeen
  } else {
    for (let t = 0; t < 5; t++) cardTypeCounts[t] = 0.2  // 未知时均匀分布
  }
  scalarFeatures[25] = cardTypeCounts[0]  // move
  scalarFeatures[26] = cardTypeCounts[1]  // attack
  scalarFeatures[27] = cardTypeCounts[2]  // defense
  scalarFeatures[28] = cardTypeCounts[3]  // scout
  scalarFeatures[29] = cardTypeCounts[4]  // skill
  
  // ===== v3新增25维标量特征 (30-54) =====
  // 30: 传送门对数
  scalarFeatures[30] = (map.portals ? map.portals.length : 0) / 3.0
  
  // 31: 到最近传送门对的距离
  scalarFeatures[31] = scalarFeatures[24]  // 复用已计算的值
  
  // 32-35: 技能详情
  const mySkill = myState.skill || {}
  scalarFeatures[32] = mySkill.skillType === 'active' ? 1.0 : 0.0
  scalarFeatures[33] = mySkill.skillType === 'passive' ? 1.0 : 0.0
  scalarFeatures[34] = (mySkill.skillType === 'active' && (myState.skillCooldown || 0) === 0) ? 1.0 : 0.0
  const effectMap = { explosive_attack: 0.2, tough_thrust: 0.4, arrow_rain: 0.6, deep_seeker: 0.8, wall_has_eyes: 1.0 }
  scalarFeatures[35] = effectMap[mySkill.passiveEffect] || 0.0
  
  // 36: 对手是否在草丛中
  scalarFeatures[36] = oppState.isHidden ? 1.0 : 0.0
  
  // 37: 对手是否可见
  scalarFeatures[37] = oppState.isHidden ? 0.0 : 1.0
  
  // 38-41: 对手上轮动作推断
  scalarFeatures[38] = oppState.isDefending ? 1.0 : 0.0
  scalarFeatures[39] = oppState.isHidden ? 1.0 : 0.0
  scalarFeatures[40] = 0.0  // reserved
  scalarFeatures[41] = 0.0  // reserved
  
  // 42: 回合紧迫性
  scalarFeatures[42] = Math.min((match.currentRound || 1) / 50.0, 1.0)
  
  // 43: HP优势
  scalarFeatures[43] = (myState.hp - oppState.hp) / Math.max(myMaxHp, 1)
  
  // 44: 手牌组合价值
  const myHand = myState.handCards || myState.currentCards || []
  const handTypes = myHand.map(c => c.type)
  const hasMove = handTypes.includes('move')
  const hasAttack = handTypes.includes('attack')
  const hasDefense = handTypes.includes('defense')
  let comboValue = 0
  if (hasMove && hasAttack) comboValue += 0.4
  if (hasAttack && hasDefense) comboValue += 0.3
  if (hasMove && hasDefense) comboValue += 0.2
  if (hasAttack) comboValue += 0.1
  scalarFeatures[44] = Math.min(comboValue, 1.0)
  
  // 45: 当前位置可移动方向数
  let moveDirs = 0
  for (const d of dirs) {
    const offset = DIRECTION_OFFSET[d]
    if (!offset) continue
    const nx = myState.position.x + offset.x
    const ny = myState.position.y + offset.y
    if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height) {
      if (!map.obstacles.some(o => o.x === nx && o.y === ny && !o.isBoundary)) {
        if (!(oppState.position.x === nx && oppState.position.y === ny)) {
          if (!map.sandDunes || !map.sandDunes.some(s => s.x === nx && s.y === ny))
            moveDirs++
        }
      }
    }
  }
  scalarFeatures[45] = moveDirs / 4.0
  
  // 46: 威胁等级（对手能从几个方向打到我）
  let threatCount = 0
  for (const d of dirs) { if (canAttackHit(match, opponentIndex, d)) threatCount++ }
  scalarFeatures[46] = threatCount / 4.0
  
  // 47-48: 附近草丛/传送门数量
  let nearbyGrass = 0, nearbyPortal = 0
  const radius = 2
  if (map.grass) { for (const g of map.grass) { if (Math.abs(g.x - myState.position.x) + Math.abs(g.y - myState.position.y) <= radius) nearbyGrass++ } }
  if (map.portals) { for (const p of map.portals) { if (Math.abs(p.entry.x - myState.position.x) + Math.abs(p.entry.y - myState.position.y) <= radius) nearbyPortal++; if (Math.abs(p.exit.x - myState.position.x) + Math.abs(p.exit.y - myState.position.y) <= radius) nearbyPortal++ } }
  scalarFeatures[47] = Math.min(nearbyGrass, 3) / 3.0
  scalarFeatures[48] = Math.min(nearbyPortal, 3) / 3.0
  
  // 49-52: 共享牌池推算对手牌类型分布（简化：均匀分布）
  scalarFeatures[49] = 0.25  // opp_move_prob (简化)
  scalarFeatures[50] = 0.25  // opp_attack_prob
  scalarFeatures[51] = 0.25  // opp_defense_prob
  scalarFeatures[52] = 0.25  // opp_scout_prob
  
  // 53: 主题特效概率提醒
  const themeId = match.theme ? match.theme.id : ''
  let themeDanger = 0
  if (themeId === 'ice') themeDanger = 0.15
  else if (themeId === 'volcano') themeDanger = 0.2
  else if (themeId === 'ruins') themeDanger = 0.5
  scalarFeatures[53] = themeDanger
  
  // 54: 对手技能信息
  const oppSkill2 = oppState.skill || {}
  scalarFeatures[54] = effectMap[oppSkill2.passiveEffect] || 0.0
  
  return { mapFeatures, cardFeatures, oppCardFeatures, scalarFeatures }
}

// ==================== 神经网络AI玩家 ====================

export class NeuralAIPlayer {
  /**
   * @param {number} playerIndex - AI在match中的玩家索引(0或1)
   * @param {object} match - Match实例引用
   * @param {string} modelPath - ONNX模型文件路径
   * @param {object} options - 配置选项
   */
  constructor(playerIndex, match, modelPath = './model.onnx', options = {}) {
    this.playerIndex = playerIndex
    this.match = match
    this.modelPath = modelPath
    this.temperature = options.temperature || 0.5  // 推理时用较低温度
    this.fallbackToRuleBased = options.fallbackToRuleBased !== false
    this.difficulty = options.difficulty || 'hard'
    
    this.aiSocketId = `NEURAL_AI_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    this.avatarId = null
    this.session = null
    this.modelLoaded = false
    
    // 随机选择角色
    this.selectRandomAvatar()
    
    // 异步加载模型
    this._loadModel()
    
    console.log(`[NeuralAI] 神经网络AI初始化, 索引: ${playerIndex}, 角色: ${this.avatarId}`)
  }
  
  // 随机选择角色
  selectRandomAvatar() {
    const avatarIds = Object.values(CHARACTER_SKILLS).map(s => s.id)
    this.avatarId = avatarIds[Math.floor(Math.random() * avatarIds.length)]
  }
  
  getSocketId() {
    return this.aiSocketId
  }
  
  getOpponentIndex() {
    return this.playerIndex === 0 ? 1 : 0
  }
  
  getMyState() {
    return this.match.playerStates[this.playerIndex]
  }
  
  getOpponentState() {
    return this.match.playerStates[this.getOpponentIndex()]
  }
  
  // 异步加载ONNX模型
  async _loadModel() {
    if (!ort) {
      console.warn('[NeuralAI] ONNX Runtime不可用，将使用规则AI回退')
      return
    }
    
    try {
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all',
      })
      this.modelLoaded = true
      console.log('[NeuralAI] ONNX模型加载成功')
    } catch (error) {
      console.error('[NeuralAI] ONNX模型加载失败:', error.message)
      console.warn('[NeuralAI] 将使用规则AI回退')
    }
  }
  
  // 使用神经网络进行推理 (v2: 4输入)
  async _infer(match, playerIndex) {
    if (!this.modelLoaded || !this.session) {
      return null
    }
    
    try {
      const state = encodeState(match, playerIndex)
      
      // 创建ONNX输入张量 (4个输入)
      const mapTensor = new ort.Tensor('float32', state.mapFeatures, [1, MAP_CHANNELS, MAX_MAP_SIZE, MAX_MAP_SIZE])
      const cardTensor = new ort.Tensor('float32', state.cardFeatures, [1, MAX_CARDS, 8])
      const oppCardTensor = new ort.Tensor('float32', state.oppCardFeatures, [1, MAX_OPP_CARDS, 8])
      const scalarTensor = new ort.Tensor('float32', state.scalarFeatures, [1, SCALAR_DIM])
      
      // 运行推理
      const results = await this.session.run({
        map_input: mapTensor,
        card_input: cardTensor,
        opp_card_input: oppCardTensor,
        scalar_input: scalarTensor,
      })
      
      return {
        cardLogits: results.card_logits.data,
        orderLogits: results.order_logits.data,
        value: results.value.data[0],
      }
    } catch (error) {
      console.error('[NeuralAI] 推理失败:', error.message)
      return null
    }
  }
  
  // ==================== 智能辅助方法 ====================
  
  // 判断当前地图主题
  isTheme(themeId) {
    return this.match.theme && this.match.theme.id === themeId
  }
  
  // 获取己方技能ID（不含性别后缀的职业部分）
  getMySkillId() {
    return this.getMyState().skill?.id || null
  }
  
  // 获取对手技能ID
  getOpponentSkillId() {
    return this.getOpponentState().skill?.id || null
  }
  
  // 获取己方职业
  getMyProfession() {
    const skillId = this.getMySkillId()
    return skillId ? skillId.split('_')[0] : null
  }
  
  // 获取对手职业
  getOpponentProfession() {
    const skillId = this.getOpponentSkillId()
    return skillId ? skillId.split('_')[0] : null
  }
  
  // 检查位置是否有传送门入口（返回传送门对象或null）
  getPortalEntryAt(x, y) {
    if (!this.match.map.portals) return null
    return this.match.map.portals.find(p => p.entry.x === x && p.entry.y === y) || null
  }
  
  // 检查位置是否有传送门出口
  getPortalExitAt(x, y) {
    if (!this.match.map.portals) return null
    return this.match.map.portals.find(p => p.exit.x === x && p.exit.y === y) || null
  }
  
  // 检查位置是否有传送门（入口或出口）
  getPortalAt(x, y) {
    return this.getPortalEntryAt(x, y) || this.getPortalExitAt(x, y)
  }
  
  // 检查位置是否是草丛
  isGrassAt(x, y) {
    if (!this.match.map.grass) return false
    return this.match.map.grass.some(g => g.x === x && g.y === y)
  }
  
  // 检查位置是否是沙丘
  isSandDuneAt(x, y) {
    if (!this.match.map.sandDunes) return false
    return this.match.map.sandDunes.some(s => s.x === x && s.y === y)
  }
  
  // 计算两点间的曼哈顿距离
  getDistance(pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y)
  }
  
  // 评估移动到某位置后的传送门效益
  // 返回：如果移动到传送门入口，返回传送后与对手的距离变化
  evaluatePortalBenefit(targetX, targetY) {
    const portal = this.getPortalEntryAt(targetX, targetY)
    if (!portal) return 0
    
    const oppPos = this.getOpponentState().position
    const myPos = this.getMyState().position
    
    // 当前与对手的距离
    const currentDist = this.getDistance(myPos, oppPos)
    // 传送后与对手的距离
    const afterTeleportDist = this.getDistance(portal.exit, oppPos)
    
    // 传送门效益：距离缩短越多，价值越高
    const benefit = currentDist - afterTeleportDist
    return benefit // 正值=接近对手，负值=远离对手
  }
  
  // 评估移动到某位置的传送门风险（对手可能利用出口传送到我附近）
  evaluatePortalRisk(targetX, targetY) {
    const portal = this.getPortalExitAt(targetX, targetY)
    if (!portal) return 0
    
    const oppPos = this.getOpponentState().position
    // 对手如果踩到入口，会传送到出口（即targetX,targetY附近）
    const entryToOpponent = this.getDistance(portal.entry, oppPos)
    // 对手距离入口越近，风险越大
    return Math.max(0, 5 - entryToOpponent) * 0.5
  }
  
  // 获取安全距离（考虑对手攻击范围加成后的最小安全距离）
  getSafeDistance() {
    let safeDist = 2 // 基础安全距离
    
    const oppProfession = this.getOpponentProfession()
    if (oppProfession === 'knight' && this.getOpponentSkillId() === 'knight_female' && !this.match.skillSealed) {
      safeDist = 3 // 女骑士攻击+1，安全距离+1
    }
    
    return safeDist
  }
  
  // 计算移动到某位置后的综合价值
  evaluateMoveTarget(direction) {
    const myPos = this.getMyState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return -100
    
    const newX = myPos.x + offset.x
    const newY = myPos.y + offset.y
    
    // 基本合法性检查
    if (!this.canMoveInDirection(direction)) return -100
    
    let value = 0
    const oppPos = this.getOpponentState().position
    const currentDist = this.getDistance(myPos, oppPos)
    const newDist = this.getDistance({ x: newX, y: newY }, oppPos)
    
    // 1. 距离变化：接近对手有价值（攻击范围外时），远离对手有价值（太近时）
    const safeDist = this.getSafeDistance()
    if (currentDist > safeDist + 1) {
      // 还远，接近有价值
      value += (currentDist - newDist) * 2
    } else if (currentDist <= safeDist) {
      // 太近了，远离有价值
      value += (newDist - currentDist) * 2
    }
    
    // 2. 传送门效益：移动到传送门入口可以瞬移
    const portalBenefit = this.evaluatePortalBenefit(newX, newY)
    value += portalBenefit * 3 // 传送门效益权重高
    
    // 3. 传送门出口风险：踩到出口附近可能被对手利用
    const portalRisk = this.evaluatePortalRisk(newX, newY)
    value -= portalRisk
    
    // 4. 森林主题：草丛隐蔽
    if (this.isTheme('forest') && this.isGrassAt(newX, newY)) {
      value += 3 // 进入草丛获得隐蔽优势
    }
    
    // 5. 沙漠主题：避免沙丘（已被canMoveInDirection阻挡，这里无需额外处理）
    
    // 6. 冰原主题：考虑寒流风险（移动到传送门入口可快速拉开距离）
    if (this.isTheme('ice')) {
      // 冰原上更倾向靠近对手后快速攻击（因为寒流可能冻结）
      if (newDist <= 2 && currentDist > 2) {
        value += 1 // 进入攻击范围更有价值（趁没被冻结赶紧攻击）
      }
    }
    
    return value
  }
  
  // 评估攻击牌的实际效果
  evaluateAttackCard(card) {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const oppState = this.getOpponentState()
    const distance = this.getDistanceToOpponent()
    
    let value = 0
    const baseRange = card.range || 1
    
    // 计算实际攻击范围（考虑女骑士被动）
    let actualRange = baseRange
    if (this.getMySkillId() === 'knight_female' && !this.match.skillSealed) {
      actualRange = baseRange + 1
    }
    
    // 检查是否能命中对手
    const canHit = this.canAttackHitOpponent(card.direction, actualRange)
    
    if (canHit) {
      // 能命中对手
      value = 9
      
      // 对手有防御时，攻击会破防而非造成伤害
      if (oppState.isDefending) {
        value = 6 // 破防有价值但不如直接伤害
      }
      
      // 女法师爆裂攻击：攻击命中障碍物也能摧毁
      if (this.getMySkillId() === 'mage_female' && !this.match.skillSealed) {
        // 即使被障碍挡也能穿过去，攻击更有价值
        value += 2
      }
    } else {
      // 不能命中对手
      value = 1
      
      // 女法师：攻击即使被障碍挡也能摧毁障碍，有额外价值
      if (this.getMySkillId() === 'mage_female' && !this.match.skillSealed) {
        // 检查攻击路径上是否有障碍物可摧毁
        const offset = DIRECTION_OFFSET[card.direction]
        for (let i = 1; i <= actualRange; i++) {
          const checkX = myPos.x + offset.x * i
          const checkY = myPos.y + offset.y * i
          const hasObstacle = this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)
          if (hasObstacle) {
            value += 3 // 摧毁障碍物有价值
            break
          }
        }
      }
      
      // 距离近时攻击价值稍高（可能下一轮就能命中）
      if (distance <= 3) value += 1
    }
    
    return value
  }
  
  // 评估防御牌的价值
  evaluateDefenseCard() {
    const myHp = this.getMyState().hp
    const myMaxHp = GAME_CONFIG.INITIAL_HP + (this.getMyState().skill?.bonusHp || 0)
    const hpRatio = myHp / Math.max(myMaxHp, 1)
    
    let value = 4
    
    // 血量低时防御更有价值
    if (hpRatio <= 0.5) value += 4
    else if (hpRatio <= 0.7) value += 2
    
    // 火山主题：火球随机伤害，防御可以抵挡
    if (this.isTheme('volcano')) {
      value += 2
    }
    
    // 冰原主题：寒流冻结所有牌，但防御状态在冻结前就生效
    if (this.isTheme('ice')) {
      value += 1
    }
    
    // 对手是女弓箭手（天降箭雨），防御更有价值
    if (this.getOpponentSkillId() === 'archer_female' && !this.match.skillSealed) {
      value += 2
    }
    
    // 对手近距离（可能攻击命中），防御更有价值
    const distance = this.getDistanceToOpponent()
    if (distance <= 2) value += 2
    
    return value
  }
  
  // 评估移动牌的价值
  evaluateMoveCard(card) {
    const distance = this.getDistanceToOpponent()
    
    // 基础移动价值
    let value = distance > 2 ? 5 : 2
    
    // 检查移动方向的传送门效益
    const moveValue = this.evaluateMoveTarget(card.direction)
    value += moveValue
    
    // 检查移动后是否能到达攻击位置
    const myPos = this.getMyState().position
    const offset = DIRECTION_OFFSET[card.direction]
    if (offset) {
      const newX = myPos.x + offset.x
      const newY = myPos.y + offset.y
      
      // 如果移动后传送门可以让我瞬移到对手旁边
      const portal = this.getPortalEntryAt(newX, newY)
      if (portal) {
        const teleportDist = this.getDistance(portal.exit, this.getOpponentState().position)
        if (teleportDist <= 2) {
          value += 6 // 传送后可以攻击，非常有价值
        } else if (teleportDist < distance) {
          value += 3 // 传送后更接近对手
        }
      }
      
      // 森林主题：移动到草丛获得隐蔽
      if (this.isTheme('forest') && this.isGrassAt(newX, newY)) {
        value += 2
      }
    }
    
    // 冰原主题：如果可能被冻结，移动牌价值略低（可能被冻结无效）
    if (this.isTheme('ice')) {
      value -= 0.5
    }
    
    return value
  }
  
  // 评估探查牌的价值
  evaluateScoutCard(card) {
    let value = 3
    
    // 迷雾关闭时探查无用
    if (!this.match.fogEnabled) {
      return 0
    }
    
    const distance = this.getDistanceToOpponent()
    
    // 距离远时探查更有价值（不知道对手位置）
    if (distance > 3) value += 2
    else if (distance > 2) value += 1
    
    // 对手在草丛中隐藏时，探查很有价值
    if (this.isTheme('forest') && this.getOpponentState().isHidden) {
      value += 4
    }
    
    // 女阅读者被动：环绕探查范围+1，更有价值
    if (this.getMySkillId() === 'reader_female' && card.scoutType === 'around' && !this.match.skillSealed) {
      value += 2
    }
    
    return value
  }
  
  // 评估技能牌的价值
  evaluateSkillCard(card) {
    // 古城封印：技能无效
    if (card.sealed || this.match.skillSealed) return 0
    
    const skillId = card.skillId
    const distance = this.getDistanceToOpponent()
    const oppState = this.getOpponentState()
    
    let value = 0
    
    switch (skillId) {
      case 'mage_male': {
        // 天降陨石：随机攻击m个格子，必定命中一些东西
        value = 7
        // 对手血量低时陨石更可能终结比赛
        if (oppState.hp <= 1) value += 2
        break
      }
      case 'knight_male': {
        // 旋风斩：攻击周围8格
        const myPos = this.getMyState().position
        const oppPos = oppState.position
        const dx = Math.abs(oppPos.x - myPos.x)
        const dy = Math.abs(oppPos.y - myPos.y)
        if (dx <= 1 && dy <= 1) {
          value = 10 // 对手在周围8格，必中
          if (oppState.isDefending) value = 7 // 破防而非伤害
        } else {
          value = 2 // 对手不在范围
        }
        break
      }
      case 'reader_male': {
        // 回忆过去：查看历史视野
        value = 4
        // 迷雾下更有价值
        if (this.match.fogEnabled) value += 2
        break
      }
      case 'archer_male': {
        // 百步穿杨：四向穿透攻击
        // 检查四个方向是否能命中对手
        const dirs = ['up', 'down', 'left', 'right']
        let canHitAny = false
        for (const dir of dirs) {
          if (this.canAttackHitOpponent(dir, Math.max(this.match.map.width, this.match.map.height))) {
            canHitAny = true
            break
          }
        }
        // 百步穿杨穿透到障碍物为止，需要更精确的检查
        const myPos = this.getMyState().position
        const oppPos = oppState.position
        let canPierce = false
        for (const dir of dirs) {
          const offset = DIRECTION_OFFSET[dir]
          for (let i = 1; i < Math.max(this.match.map.width, this.match.map.height); i++) {
            const tx = myPos.x + offset.x * i
            const ty = myPos.y + offset.y * i
            if (tx < 0 || tx >= this.match.map.width || ty < 0 || ty >= this.match.map.height) break
            if (this.match.map.obstacles.some(o => o.x === tx && o.y === ty && !o.isBoundary)) break
            if (tx === oppPos.x && ty === oppPos.y) { canPierce = true; break }
          }
          if (canPierce) break
        }
        value = canPierce ? 9 : 2
        if (canPierce && oppState.isDefending) value = 6
        break
      }
      case 'thief_male': {
        // 盗为己用：复制对手第一张牌
        value = 6
        // 距离近时更有价值（复制的牌可能是攻击）
        if (distance <= 2) value += 2
        break
      }
      default:
        value = 5
    }
    
    return value
  }
  
  // ==================== 选牌策略 ====================
  
  // 自回归选牌：逐张选择手牌（与训练一致）
  async selectCards() {
    const currentCards = this.getMyState().currentCards
    const nCards = currentCards.length
    
    // 尝试神经网络推理
    const inference = await this._infer(this.match, this.playerIndex)
    
    if (inference && nCards > 0) {
      // 检查神经网络输出是否有足够区分度（最大logit-最小logit > 0.3）
      const cardLogits = Array.from(inference.cardLogits).slice(0, nCards)
      const maxLogit = Math.max(...cardLogits)
      const minLogit = Math.min(...cardLogits)
      const logitSpread = maxLogit - minLogit
      
      // 如果神经网络输出足够有区分度，使用神经网络结果
      if (logitSpread > 0.3) {
        const selectedIndices = []
        const maskedLogits = [...Array.from(inference.cardLogits)]
        
        for (let pick = 0; pick < Math.min(HAND_SIZE, nCards); pick++) {
          // Mask不存在的牌
          for (let i = 0; i < MAX_CARDS; i++) {
            if (i >= nCards) {
              maskedLogits[i] = -Infinity
            }
          }
          // Mask已选的牌
          for (const idx of selectedIndices) {
            maskedLogits[idx] = -Infinity
          }
          
          // 温度缩放 + softmax
          const scaledLogits = maskedLogits.map(l => l / this.temperature)
          const maxL = Math.max(...scaledLogits.filter(l => l !== -Infinity))
          const expLogits = scaledLogits.map(l => l === -Infinity ? 0 : Math.exp(l - maxL))
          const sumExp = expLogits.reduce((a, b) => a + b, 0)
          const probs = expLogits.map(e => e / sumExp)
          
          // 选择概率最高的牌（推理时用greedy，训练时采样）
          let bestIdx = -1
          let bestProb = -1
          for (let i = 0; i < nCards; i++) {
            if (probs[i] > bestProb && !selectedIndices.includes(i)) {
              bestProb = probs[i]
              bestIdx = i
            }
          }
          
          if (bestIdx >= 0) {
            selectedIndices.push(bestIdx)
          }
        }
        
        console.log(`[NeuralAI] 神经网络选牌: ${selectedIndices}, 卡牌: ${selectedIndices.map(i => currentCards[i].name).join(', ')}, 价值: ${inference.value.toFixed(3)}, 区分度: ${logitSpread.toFixed(3)}`)
        return selectedIndices
      }
      
      // 神经网络输出太平坦，融合规则策略
      console.log(`[NeuralAI] 神经网络输出平坦(区分度: ${logitSpread.toFixed(3)})，融合规则策略`)
    }
    
    // 回退到规则AI
    return this._ruleBasedSelectCards()
  }
  
  // 规则AI选牌（增强版回退方案）
  _ruleBasedSelectCards() {
    const currentCards = this.getMyState().currentCards
    const distance = this.getDistanceToOpponent()
    
    const cardValues = currentCards.map((card, index) => {
      let value = 0
      
      if (card.isSkillCard) {
        value = this.evaluateSkillCard(card)
      } else {
        switch (card.type) {
          case 'attack':
            value = this.evaluateAttackCard(card)
            break
          case 'defense':
            value = this.evaluateDefenseCard()
            break
          case 'move':
            value = this.evaluateMoveCard(card)
            break
          case 'scout':
            value = this.evaluateScoutCard(card)
            break
          default:
            value = 2
        }
      }
      
      // 很小的随机性（hard难度）
      value += Math.random() * 0.5
      
      return { index, value, card }
    })
    
    // 按价值排序，选前3张
    cardValues.sort((a, b) => b.value - a.value)
    const selectedIndices = cardValues.slice(0, HAND_SIZE).map(cv => cv.index)
    
    console.log(`[NeuralAI] 规则选牌: ${selectedIndices}, 卡牌: ${selectedIndices.map(i => currentCards[i].name).join(', ')}, 评分: ${cardValues.slice(0, HAND_SIZE).map(cv => `${cv.card.name}=${cv.value.toFixed(1)}`).join(', ')}`)
    return selectedIndices
  }
  
  // ==================== 排序策略 ====================
  
  async orderCards(handCards) {
    const inference = await this._infer(this.match, this.playerIndex)
    
    if (inference && handCards.length > 0) {
      // 检查神经网络输出区分度
      const orderLogits = Array.from(inference.orderLogits)
      const nCards = Math.min(handCards.length, HAND_SIZE)
      const relevantLogits = orderLogits.slice(0, nCards)
      const maxLogit = Math.max(...relevantLogits)
      const minLogit = Math.min(...relevantLogits)
      const logitSpread = maxLogit - minLogit
      
      if (logitSpread > 0.2) {
        // 对order_logits应用温度缩放和softmax得到概率
        const scaledLogits = relevantLogits.map(l => l / this.temperature)
        const maxL = Math.max(...scaledLogits)
        const expLogits = scaledLogits.map(l => Math.exp(l - maxL))
        const sumExp = expLogits.reduce((a, b) => a + b, 0)
        const probs = expLogits.map(e => e / sumExp)
        
        // 按概率从高到低排序（概率高的先出）
        const indices = Array.from({ length: nCards }, (_, i) => i)
        indices.sort((a, b) => probs[b] - probs[a])
        
        // 按排序后的顺序返回手牌
        const orderedCards = indices.map(i => handCards[i])
        
        console.log(`[NeuralAI] 神经网络排序: ${indices.map(i => handCards[i].name).join(' → ')}, 价值: ${inference.value.toFixed(3)}, 区分度: ${logitSpread.toFixed(3)}`)
        return orderedCards
      }
      
      console.log(`[NeuralAI] 排序输出平坦(区分度: ${logitSpread.toFixed(3)})，使用规则排序`)
    }
    
    // 回退到规则排序
    return this._ruleBasedOrderCards(handCards)
  }
  
  _ruleBasedOrderCards(handCards) {
    const distance = this.getDistanceToOpponent()
    const myHp = this.getMyState().hp
    const oppState = this.getOpponentState()
    const myState = this.getMyState()
    const safeDist = this.getSafeDistance()
    
    const cardPriorities = handCards.map((card, index) => {
      let priority = 0
      
      if (card.isSkillCard) {
        // 技能牌的排序优先级取决于技能类型
        const skillId = card.skillId
        switch (skillId) {
          case 'knight_male':
            // 旋风斩：对手在旁边时优先出
            priority = distance <= 1 ? 10 : 3
            break
          case 'archer_male':
            // 百步穿杨：可以远距离命中时优先
            priority = 7
            break
          case 'mage_male':
            // 天降陨石：任何时候都有价值
            priority = 7
            break
          case 'thief_male':
            // 盗为己用：越早出越好（让对手牌无效）
            priority = 9
            break
          case 'reader_male':
            // 回忆过去：尽早探查
            priority = 6
            break
          default:
            priority = 6
        }
      } else {
        switch (card.type) {
          case 'attack': {
            // 攻击牌优先级
            const canHit = this.canAttackHitOpponent(card.direction, card.range || 1)
            if (canHit && !oppState.isDefending) {
              // 能命中且对手无防御 → 最高优先
              priority = 9
            } else if (canHit && oppState.isDefending) {
              // 能命中但对手有防御 → 稍后出（让其他牌先破防）
              priority = 4
            } else {
              // 不能命中 → 低优先
              priority = 2
            }
            break
          }
          case 'defense': {
            // 防御牌优先级
            priority = 5
            // 血量低时防御优先
            if (myHp <= 1) priority += 4
            else if (myHp <= 2) priority += 2
            // 对手近距离（可能攻击）时防御优先
            if (distance <= safeDist) priority += 2
            // 火山/冰原主题防御更有价值
            if (this.isTheme('volcano') || this.isTheme('ice')) priority += 1
            break
          }
          case 'move': {
            // 移动牌优先级
            const moveValue = this.evaluateMoveTarget(card.direction)
            if (distance > safeDist + 1) {
              // 远距离：先移动接近
              priority = 7 + moveValue
            } else if (distance <= safeDist && moveValue > 0) {
              // 太近且移动能拉开距离：先移动
              priority = 7 + moveValue
            } else {
              // 其他情况：后移动
              priority = 3 + moveValue
            }
            
            // 传送门移动：高优先
            const myPos = myState.position
            const offset = DIRECTION_OFFSET[card.direction]
            if (offset) {
              const newX = myPos.x + offset.x
              const newY = myPos.y + offset.y
              if (this.getPortalEntryAt(newX, newY)) {
                const portalBenefit = this.evaluatePortalBenefit(newX, newY)
                if (portalBenefit > 2) {
                  priority += 4 // 传送门效益大时优先移动
                }
              }
            }
            break
          }
          case 'scout': {
            // 探查牌优先级
            priority = 4
            // 对手在草丛中隐藏时优先探查
            if (this.isTheme('forest') && oppState.isHidden) priority += 3
            // 迷雾下且远距离时优先探查
            if (this.match.fogEnabled && distance > 3) priority += 2
            break
          }
          default:
            priority = 3
        }
      }
      
      // ===== 冰原寒流特殊处理 =====
      // 寒流可能冻结所有牌，所以最重要的牌排最前面
      if (this.isTheme('ice')) {
        // 不额外调整，但如果有高优先级牌，确保排最前
        // （上面已经在计算了，这里确保不会因为随机性打乱）
      }
      
      // ===== 对手防御状态特殊处理 =====
      // 如果对手有防御，且我们有非攻击牌能先出，让非攻击牌先出
      // （攻击牌打防御只破防不伤血，不如先出其他牌等防御消失）
      if (oppState.isDefending && card.type === 'attack') {
        // 有其他牌可破防（如旋风斩等技能），攻击排后面
        const hasSkillCard = handCards.some(c => c.isSkillCard)
        if (hasSkillCard) {
          priority -= 2 // 让技能牌先出
        }
      }
      
      // 很小的随机性
      priority += Math.random() * 0.3
      
      return { index, priority, card }
    })
    
    cardPriorities.sort((a, b) => b.priority - a.priority)
    const orderedCards = cardPriorities.map(cp => cp.card)
    
    console.log(`[NeuralAI] 规则排序: ${orderedCards.map(c => c.name).join(' → ')}, 优先级: ${cardPriorities.map(cp => `${cp.card.name}=${cp.priority.toFixed(1)}`).join(', ')}`)
    return orderedCards
  }
  
  // ==================== 辅助方法 ====================
  
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
    const isBlocked = this.match.map.obstacles.some(o => o.x === newX && o.y === newY && !o.isBoundary)
    if (isBlocked) return false
    // 检查沙丘
    if (this.isSandDuneAt(newX, newY)) return false
    const oppPos = this.getOpponentState().position
    if (oppPos.x === newX && oppPos.y === newY) return false
    return true
  }
  
  canAttackHitOpponent(direction, range = 1) {
    const myPos = this.getMyState().position
    const oppPos = this.getOpponentState().position
    const offset = DIRECTION_OFFSET[direction]
    if (!offset) return false
    
    // 女骑士攻击范围+1
    let actualRange = range
    if (this.getMySkillId() === 'knight_female' && !this.match.skillSealed) {
      actualRange = range + 1
    }
    
    for (let i = 1; i <= actualRange; i++) {
      const checkX = myPos.x + offset.x * i
      const checkY = myPos.y + offset.y * i
      if (checkX < 0 || checkX >= this.match.map.width || checkY < 0 || checkY >= this.match.map.height) break
      if (this.match.map.isShapeMap && this.match.map.shapeLayout) {
        if (!this.match.map.shapeLayout[checkY] || this.match.map.shapeLayout[checkY][checkX] !== 1) break
      }
      // 女法师爆裂攻击穿透障碍物
      if (this.getMySkillId() === 'mage_female' && !this.match.skillSealed) {
        // 穿透障碍物，不中断
      } else {
        const isBlocked = this.match.map.obstacles.some(o => o.x === checkX && o.y === checkY && !o.isBoundary)
        if (isBlocked) break
      }
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
  
  // ==================== 查看对手牌策略 ====================
  
  chooseViewOpponentCard() {
    const oppProfession = this.getOpponentProfession()
    
    // 根据对手职业智能选择查看哪张牌
    switch (oppProfession) {
      case 'mage':
        // 法师可能有技能牌（男法师陨石），看第一张
        return 'first'
      case 'knight':
        // 骑士倾向先出攻击，看第一张
        return 'first'
      case 'archer':
        // 弓箭手可能先移动再攻击，看最后一张
        return Math.random() < 0.4 ? 'first' : 'last'
      case 'thief':
        // 盗贼可能有盗为己用，看第一张
        return 'first'
      case 'reader':
        // 阅读者可能先探查，看第一张
        return 'first'
      default:
        return Math.random() < 0.6 ? 'first' : 'last'
    }
  }
  
  // ==================== 执行AI回合 ====================
  
  async executeSelectCards() {
    const delay = 1000 + Math.random() * 1500
    setTimeout(async () => {
      if (this.match.phase !== 'selecting_priority' && this.match.phase !== 'selecting_normal') {
        console.log('[NeuralAI] 阶段已变更，跳过选牌')
        return
      }
      
      const selectedIndices = await this.selectCards()
      this.match.selectCards(this.aiSocketId, selectedIndices)
    }, delay)
  }
  
  async executeConfirmOrder() {
    const delay = 800 + Math.random() * 1200
    setTimeout(async () => {
      if (this.match.phase !== 'ordering_priority' && this.match.phase !== 'ordering_normal') {
        console.log('[NeuralAI] 阶段已变更，跳过排序')
        return
      }
      
      const handCards = this.getMyState().handCards
      if (!handCards || handCards.length === 0) {
        console.log('[NeuralAI] 没有手牌可排序')
        return
      }
      
      const orderedCards = await this.orderCards([...handCards])
      this.match.confirmOrder(this.aiSocketId, orderedCards)
    }, delay)
  }
  
  executeViewOpponentCard() {
    const delay = 500 + Math.random() * 1000
    setTimeout(() => {
      const choice = this.chooseViewOpponentCard()
      this.match.viewOpponentCard(this.aiSocketId, choice)
    }, delay)
  }
  
  executePlayCard() {
    const delay = 300 + Math.random() * 700
    setTimeout(() => {
      if (this.match.phase !== 'playing') {
        console.log('[NeuralAI] 不在出牌阶段，跳过出牌')
        return
      }
      
      const priorityIndex = this.match.isPlayer1Priority ? 0 : 1
      const isPriorityTurn = this.match.turnIndex % 2 === 0
      const currentPlayerIndex = isPriorityTurn ? priorityIndex : (1 - priorityIndex)
      
      if (currentPlayerIndex !== this.playerIndex) {
        console.log('[NeuralAI] 不是AI的回合')
        return
      }
      
      this.match.playCard(this.aiSocketId)
    }, delay)
  }
  
  executeRematch() {
    const delay = 1000 + Math.random() * 1000
    setTimeout(() => {
      this.match.requestRematch(this.aiSocketId)
    }, delay)
  }
}