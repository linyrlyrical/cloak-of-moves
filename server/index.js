import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GAME_CONFIG } from './shared/constants.js'
import { RoomManager } from './game/room.js'
import { MatchManager } from './game/match.js'
import { LobbyManager, PLAYER_STATUS } from './game/lobby.js'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// 房间管理器
const roomManager = new RoomManager()
// 对局管理器
const matchManager = new MatchManager()
// 大厅管理器（ID匹配）
const lobbyManager = new LobbyManager()
// 将io实例传给matchManager
matchManager.setIO(io)

// Socket连接处理
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id} 已连接`)
  
  // 创建房间
  socket.on('create_room', (data) => {
    console.log(`[事件] ${socket.id} 触发 create_room`)
    
    const avatarId = data?.avatarId || null
    
    const roomCode = roomManager.createRoom(socket.id)
    socket.join(roomCode)
    console.log(`[房间] ${socket.id} 创建了房间 ${roomCode}`)
    
    // 创建Match并设置第一个玩家
    const match = matchManager.createMatch(roomCode)
    console.log(`[Match] 为房间 ${roomCode} 创建Match`)
    
    matchManager.setPlayer(roomCode, socket.id, 0, avatarId) // 0 = 玩家1
    
    socket.emit('room_created', roomCode)
    console.log(`[发送] room_created 事件到 ${socket.id}`)
  })
  
  // 加入房间
  socket.on('join_room', (data) => {
    const roomCode = typeof data === 'string' ? data : data?.roomCode
    const avatarId = typeof data === 'object' ? data?.avatarId : null
    
    console.log(`[事件] ${socket.id} 触发 join_room，房间号: ${roomCode}`)
    
    const result = roomManager.joinRoom(socket.id, roomCode)
    console.log(`[房间] joinRoom 结果:`, result)
    
    if (result.success) {
      socket.join(roomCode)
      console.log(`[Socket] ${socket.id} 加入房间 ${roomCode}`)
      
      // 设置第二个玩家
      matchManager.setPlayer(roomCode, socket.id, 1, avatarId) // 1 = 玩家2
      console.log(`[Match] 设置玩家2: ${socket.id}`)
      
      socket.emit('room_joined', {
        room: roomCode,
        isPlayer1: result.isPlayer1
      })
      console.log(`[发送] room_joined 事件到 ${socket.id}`)
      
      // Match会在setPlayer中检测两个玩家都加入后进入地图配置阶段
      // 不再发送game_start，等待地图配置完成后再发送
      console.log(`[房间] ${socket.id} 加入了房间 ${roomCode}`)
    } else {
      console.log(`[错误] join_room 失败: ${result.message}`)
      socket.emit('room_error', result.message)
    }
  })
  
  // ========== 单人模式（AI对战）==========
  socket.on('start_solo_game', (data) => {
    console.log(`[单人] ${socket.id} 开始单人模式, 难度: ${data?.difficulty || 'normal'}`)
    
    const avatarId = data?.avatarId || null
    const difficulty = data?.difficulty || 'normal'
    
    // 创建房间和Match
    const roomCode = roomManager.createRoom(socket.id)
    socket.join(roomCode)
    
    const match = matchManager.createMatch(roomCode)
    
    // 设置人类玩家为玩家1
    matchManager.setPlayer(roomCode, socket.id, 0, avatarId)
    
    // 初始化AI为玩家2（只使用规则AI，不再支持神经网络AI选择）
    const aiSocketId = match.initAI(difficulty)
    
    // 单人模式：进入地图配置阶段，让玩家配置地图
    // 注意：setPlayer会检测两个玩家都加入后进入CONFIGURING阶段，
    // 但AI是通过initAI添加的，所以需要手动进入配置阶段
    match.phase = 'configuring'
    
    // 通知客户端进入地图配置阶段（玩家是房主，可以配置地图）
    socket.emit('solo_game_started', {
      roomCode: roomCode,
      isPlayer1: true
    })
    
    // 同时发送进入配置阶段的事件
    socket.emit('enter_configuring', {
      phase: 'configuring',
      mapSizeOptions: GAME_CONFIG.MAP_SIZE_OPTIONS,
      creatorId: socket.id  // 单人模式下玩家就是房主
    })
    
    console.log(`[单人] 房间 ${roomCode} 创建成功, 进入地图配置阶段`)
  })
  
  // 地图大小选择（房主）
  socket.on('map_size_selected', (data) => {
    console.log(`[事件] ${socket.id} 选择地图配置:`, data)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.setMapSize(socket.id, data)
    } else {
      console.log(`[事件] 未找到匹配的比赛，socket.id: ${socket.id}`)
    }
  })
  
  // 卡牌选择（统一处理技能牌和普通牌）
  socket.on('select_cards', (data) => {
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      // 统一处理：selectedCards 包含所有选中的牌（技能牌和普通牌一起计算）
      const selectedCards = Array.isArray(data) ? data : data.selectedCards
      match.selectCards(socket.id, selectedCards)
    }
  })
  
  // 确认手牌顺序
  socket.on('confirm_order', (handCards) => {
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.confirmOrder(socket.id, handCards)
    }
  })
  
  // 后手玩家选择查看先手的手牌（第一张或最后一张）
  socket.on('view_opponent_card', (choice) => {
    console.log(`[事件] ${socket.id} 选择查看先手${choice === 'first' ? '第一张' : '最后一张'}牌`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.viewOpponentCard(socket.id, choice)
    }
  })
  
  // 出牌
  socket.on('play_card', () => {
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.playCard(socket.id)
    }
  })
  
  // 再来一局请求
  socket.on('request_rematch', () => {
    console.log(`[事件] ${socket.id} 请求再来一局`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.requestRematch(socket.id)
    }
  })
  
  // 接受再来一局
  socket.on('accept_rematch', () => {
    console.log(`[事件] ${socket.id} 接受再来一局`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.acceptRematch(socket.id)
    }
  })
  
  // 拒绝再来一局
  socket.on('reject_rematch', () => {
    console.log(`[事件] ${socket.id} 拒绝再来一局`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.rejectRematch(socket.id)
    }
  })
  
  // 更换角色（在房间中实时更新）
  socket.on('update_avatar', (data) => {
    console.log(`[事件] ${socket.id} 更换角色: ${data.avatarId}`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.updatePlayerAvatar(socket.id, data.avatarId)
    }
  })
  
  // 离开房间
  socket.on('leave_room', (roomCode) => {
    console.log(`[事件] ${socket.id} 离开房间 ${roomCode}`)
    socket.leave(roomCode)
    
    // 清理match中的玩家
    const match = matchManager.getMatch(roomCode)
    if (match) {
      match.removePlayer(socket.id)
    }
    
    // 清理房间
    roomManager.removePlayerFromRoom(socket.id, roomCode)
  })
  
  // 单人模式退出
  socket.on('leave_solo_game', () => {
    console.log(`[单人] ${socket.id} 退出单人模式`)
    
    const match = matchManager.getMatchBySocket(socket.id)
    if (match && match.isSoloMode) {
      const roomCode = match.roomCode
      
      // 清理match（包括AI玩家）
      match.removePlayer(socket.id)
      matchManager.removeMatch(roomCode)
      
      // 离开Socket.IO房间
      socket.leave(roomCode)
      
      // 清理房间
      roomManager.removePlayerFromRoom(socket.id, roomCode)
      
      console.log(`[单人] 房间 ${roomCode} 已清理`)
    }
  })
  
  // ==================== 聊天系统 ====================
  
  // 发送聊天消息
  socket.on('send_chat_message', (data) => {
    console.log(`[聊天] ${socket.id} 发送消息:`, data)
    
    const match = matchManager.getMatchBySocket(socket.id)
    if (!match) {
      console.log(`[聊天] 未找到对局，socket.id: ${socket.id}`)
      return
    }
    
    // 单人模式（AI对战）不允许聊天
    if (match.isSoloMode) {
      console.log(`[聊天] 单人模式，禁止聊天`)
      return
    }
    
    // 获取发送者的玩家索引（0=玩家1，1=玩家2）
    const playerIndex = match.getPlayerIndex(socket.id)
    
    // 构建消息对象
    const message = {
      type: data.type,           // 'emoji' | 'quick' | 'text'
      content: data.content,     // 表情符号/快捷消息ID/自定义文字
      sender: socket.id,
      playerIndex: playerIndex,  // 玩家索引（用于确定消息显示位置）
      timestamp: Date.now()
    }
    
    // 转发给房间内所有玩家（包括自己）
    io.to(match.roomCode).emit('chat_message', message)
    console.log(`[聊天] 消息已转发至房间 ${match.roomCode}, 玩家索引: ${playerIndex}`)
  })
  
  // ==================== ID匹配 - 大厅相关事件 ====================
  
  // 注册玩家ID
  socket.on('register_id', (data) => {
    console.log(`[大厅] ${socket.id} 请求注册ID: ${data.playerId}`)
    
    const playerId = data?.playerId?.trim()
    const avatarId = data?.avatarId || null
    
    if (!playerId) {
      socket.emit('id_error', { message: 'ID不能为空' })
      return
    }
    
    // 检查ID长度限制
    if (playerId.length > 20) {
      socket.emit('id_error', { message: 'ID长度不能超过20个字符' })
      return
    }
    
    // 检查ID格式（只允许字母、数字、下划线、中文）
    const validIdPattern = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/
    if (!validIdPattern.test(playerId)) {
      socket.emit('id_error', { message: 'ID只能包含中文、字母、数字和下划线' })
      return
    }
    
    const result = lobbyManager.registerPlayer(socket.id, playerId, avatarId)
    
    if (result.success) {
      socket.emit('id_registered', {
        playerId: playerId,
        avatarId: avatarId
      })
      
      // 广播更新后的在线列表给所有玩家
      lobbyManager.broadcastOnlinePlayers(io)
    } else {
      socket.emit('id_taken', { message: result.message })
    }
  })
  
  // 获取在线玩家列表
  socket.on('get_lobby_players', () => {
    const players = lobbyManager.getOnlinePlayers()
    socket.emit('lobby_update', { players })
  })
  
  // 发送对战邀请
  socket.on('send_invitation', (data) => {
    console.log(`[大厅] ${socket.id} 邀请玩家: ${data.toPlayerId}`)
    
    const toPlayerId = data?.toPlayerId
    if (!toPlayerId) {
      socket.emit('invitation_error', { message: '请选择要邀请的玩家' })
      return
    }
    
    const result = lobbyManager.sendInvitation(socket.id, toPlayerId, io)
    
    if (result.success) {
      socket.emit('invitation_sent', { invitationId: result.invitationId, toPlayerId })
    } else {
      socket.emit('invitation_error', { message: result.message })
    }
  })
  
  // 接受邀请
  socket.on('accept_invitation', (data) => {
    console.log(`[大厅] ${socket.id} 接受邀请: ${data.invitationId}`)
    
    const invitationId = data?.invitationId
    if (!invitationId) {
      socket.emit('invitation_error', { message: '邀请不存在' })
      return
    }
    
    const result = lobbyManager.acceptInvitation(socket.id, invitationId, io, matchManager, roomManager)
    
    if (result.success) {
      // 重要：必须先让双方加入 Socket.IO 房间，再创建 match
      // 否则 match.setPlayer() 发送的 enter_configuring 事件无法送达
      
      // 被邀请者（当前socket）加入房间
      socket.join(result.roomCode)
      console.log(`[Socket] 被邀请者 ${socket.id} 加入房间 ${result.roomCode}`)
      
      // 邀请者加入房间
      const fromSocket = io.sockets.sockets.get(result.fromSocketId)
      if (fromSocket) {
        fromSocket.join(result.roomCode)
        console.log(`[Socket] 邀请者 ${result.fromSocketId} 加入房间 ${result.roomCode}`)
      }
      
      // 双方都已加入 Socket.IO 房间后，再创建 match 并设置玩家
      const match = matchManager.createMatch(result.roomCode)
      // 邀请者为玩家1（房主），被邀请者为玩家2
      match.setPlayer(result.fromSocketId, 0, result.fromAvatarId)
      match.setPlayer(result.toSocketId, 1, result.toAvatarId)
      
      // 发送匹配成功事件给双方（告知各自是玩家1还是玩家2）
      // 被邀请者是玩家2
      socket.emit('match_found', { roomCode: result.roomCode, isPlayer1: false })
      // 邀请者是玩家1（房主）
      io.to(result.fromSocketId).emit('match_found', { roomCode: result.roomCode, isPlayer1: true })
    } else {
      socket.emit('invitation_error', { message: result.message })
    }
  })
  
  // 拒绝邀请
  socket.on('reject_invitation', (data) => {
    console.log(`[大厅] ${socket.id} 拒绝邀请: ${data.invitationId}`)
    
    const invitationId = data?.invitationId
    if (!invitationId) {
      return
    }
    
    lobbyManager.rejectInvitation(socket.id, invitationId, io)
  })
  
  // 离开大厅
  socket.on('leave_lobby', () => {
    console.log(`[大厅] ${socket.id} 离开大厅`)
    lobbyManager.handleDisconnect(socket.id, io)
  })
  
  // 游戏结束 - 恢复玩家空闲状态
  socket.on('game_over_in_lobby', (data) => {
    console.log(`[大厅] ${socket.id} 游戏结束，恢复空闲状态`)
    const player = lobbyManager.getPlayerBySocket(socket.id)
    if (player) {
      lobbyManager.setPlayerIdle(player.id)
      lobbyManager.broadcastOnlinePlayers(io)
    }
  })
  
  // 断线处理
  socket.on('disconnect', () => {
    console.log(`[断开] ${socket.id} 已断开`)
    const match = matchManager.getMatchBySocket(socket.id)
    
    // 清理大厅中的玩家
    lobbyManager.handleDisconnect(socket.id, io)
    
    if (match) {
      // 先处理断开连接通知（发送opponent_disconnected事件）
      match.handleDisconnect(socket.id)
      
      // 延迟清理资源，确保事件能够发送
      setTimeout(() => {
        // 从所有房间中移除该玩家
        roomManager.removePlayerFromAllRooms(socket.id)
        
        // 清理match
        matchManager.removeMatchBySocket(socket.id)
      }, 500)
    } else {
      // 没有match的情况下直接清理
      roomManager.removePlayerFromAllRooms(socket.id)
    }
  })
})

// REST API
app.get('/', (req, res) => {
  res.json({
    name: 'Cloak of Moves Server',
    status: 'running',
    matches: matchManager.matches.size
  })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// 启动服务器 - 支持动态端口（云平台部署）
const PORT = process.env.PORT || GAME_CONFIG.SERVER_PORT
httpServer.listen(PORT, () => {
  console.log(`🎮 游戏服务器已启动: http://localhost:${PORT}`)
  console.log(`📡 端口: ${PORT}`)
})