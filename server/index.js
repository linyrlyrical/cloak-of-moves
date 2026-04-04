import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { GAME_CONFIG } from '../shared/constants.js'
import { RoomManager } from './game/room.js'
import { MatchManager } from './game/match.js'

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
// 将io实例传给matchManager
matchManager.setIO(io)

// Socket连接处理
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id} 已连接`)
  
  // 创建房间
  socket.on('create_room', () => {
    console.log(`[事件] ${socket.id} 触发 create_room`)
    
    const roomCode = roomManager.createRoom(socket.id)
    socket.join(roomCode)
    console.log(`[房间] ${socket.id} 创建了房间 ${roomCode}`)
    
    // 创建Match并设置第一个玩家
    const match = matchManager.createMatch(roomCode)
    console.log(`[Match] 为房间 ${roomCode} 创建Match`)
    
    matchManager.setPlayer(roomCode, socket.id, 0) // 0 = 玩家1
    
    socket.emit('room_created', roomCode)
    console.log(`[发送] room_created 事件到 ${socket.id}`)
  })
  
  // 加入房间
  socket.on('join_room', (roomCode) => {
    console.log(`[事件] ${socket.id} 触发 join_room，房间号: ${roomCode}`)
    
    const result = roomManager.joinRoom(socket.id, roomCode)
    console.log(`[房间] joinRoom 结果:`, result)
    
    if (result.success) {
      socket.join(roomCode)
      console.log(`[Socket] ${socket.id} 加入房间 ${roomCode}`)
      
      // 设置第二个玩家
      matchManager.setPlayer(roomCode, socket.id, 1) // 1 = 玩家2
      console.log(`[Match] 设置玩家2: ${socket.id}`)
      
      socket.emit('room_joined', {
        room: roomCode,
        isPlayer1: result.isPlayer1
      })
      console.log(`[发送] room_joined 事件到 ${socket.id}`)
      
      // 同时获取match并发送game_start
      const match = matchManager.getMatch(roomCode)
      if (match) {
        socket.emit('game_start', {
          ...match.getState(),
          isPlayer1Priority: match.isPlayer1Priority
        })
        console.log(`[发送] game_start 事件到 ${socket.id}`)
      }
      
      // Match会在setPlayer中检测两个玩家都加入后自动调用startGame
      console.log(`[房间] ${socket.id} 加入了房间 ${roomCode}`)
    } else {
      console.log(`[错误] join_room 失败: ${result.message}`)
      socket.emit('room_error', result.message)
    }
  })
  
  // 地图大小选择（房主）
  socket.on('map_size_selected', (size) => {
    console.log(`[事件] ${socket.id} 选择地图大小: ${size}`)
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
      match.setMapSize(socket.id, size)
    }
  })
  
  // 卡牌选择
  socket.on('select_cards', (selectedCards) => {
    const match = matchManager.getMatchBySocket(socket.id)
    if (match) {
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
  
  // 断线处理
  socket.on('disconnect', () => {
    console.log(`[断开] ${socket.id} 已断开`)
    const match = matchManager.getMatchBySocket(socket.id)
    
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
