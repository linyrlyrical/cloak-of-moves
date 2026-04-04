// 房间管理
export class RoomManager {
  constructor() {
    this.rooms = new Map()
  }
  
  // 生成随机房间号
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }
  
  // 创建房间
  createRoom(playerId) {
    let roomCode
    do {
      roomCode = this.generateRoomCode()
    } while (this.rooms.has(roomCode))
    
    this.rooms.set(roomCode, {
      code: roomCode,
      players: [playerId],
      createdAt: Date.now()
    })
    
    return roomCode
  }
  
  // 加入房间
  joinRoom(playerId, roomCode) {
    const room = this.rooms.get(roomCode)
    
    if (!room) {
      return { success: false, message: '房间不存在' }
    }
    
    if (room.players.length >= 2) {
      return { success: false, message: '房间已满' }
    }
    
    if (room.players.includes(playerId)) {
      return { success: false, message: '已在房间中' }
    }
    
    room.players.push(playerId)
    const isPlayer1 = room.players[0] === playerId
    
    return { success: true, isPlayer1 }
  }
  
  // 获取房间
  getRoom(roomCode) {
    return this.rooms.get(roomCode)
  }
  
  // 删除房间
  deleteRoom(roomCode) {
    this.rooms.delete(roomCode)
  }
  
  // 从指定房间移除玩家
  removePlayerFromRoom(playerId, roomCode) {
    const room = this.rooms.get(roomCode)
    if (room) {
      const index = room.players.indexOf(playerId)
      if (index > -1) {
        room.players.splice(index, 1)
        console.log(`[房间] 玩家 ${playerId} 已从房间 ${roomCode} 移除`)
      }
      
      // 如果房间空了，删除房间
      if (room.players.length === 0) {
        this.rooms.delete(roomCode)
        console.log(`[房间] 房间 ${roomCode} 已删除（无玩家）`)
      }
    }
  }
  
  // 从所有房间移除玩家
  removePlayerFromAllRooms(playerId) {
    for (const [roomCode, room] of this.rooms) {
      const index = room.players.indexOf(playerId)
      if (index > -1) {
        room.players.splice(index, 1)
        console.log(`[房间] 玩家 ${playerId} 已从房间 ${roomCode} 移除`)
        
        // 如果房间空了，标记删除
        if (room.players.length === 0) {
          this.rooms.delete(roomCode)
          console.log(`[房间] 房间 ${roomCode} 已删除（无玩家）`)
        }
      }
    }
  }
}
