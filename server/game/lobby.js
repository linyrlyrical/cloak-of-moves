/**
 * 大厅管理器 - 管理ID匹配模式的在线玩家和邀请系统
 */

// 玩家状态常量
const PLAYER_STATUS = {
  IDLE: 'idle',      // 在线空闲
  IN_GAME: 'in_game' // 正在对局
}

// 邀请状态常量
const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
}

// 邀请超时时间（毫秒）
const INVITATION_TIMEOUT = 30000 // 30秒

class LobbyManager {
  constructor() {
    // 在线玩家列表：playerId -> PlayerData
    this.onlinePlayers = new Map()
    
    // Socket ID 到玩家 ID 的映射
    this.socketToPlayer = new Map()
    
    // Socket ID 到玩家数据的直接映射（用于快速查找）
    this.socketToData = new Map()
    
    // 待处理的邀请：invitationId -> InvitationData
    this.pendingInvitations = new Map()
    
    // 玩家发送的邀请：playerId -> invitationId
    this.playerSentInvitations = new Map()
    
    // 玩家收到的邀请：playerId -> invitationId
    this.playerReceivedInvitations = new Map()
  }
  
  /**
   * 检查ID是否可用
   * @param {string} playerId - 玩家ID
   * @returns {boolean} - 是否可用
   */
  isIdAvailable(playerId) {
    return !this.onlinePlayers.has(playerId)
  }
  
  /**
   * 注册玩家
   * @param {string} socketId - Socket ID
   * @param {string} playerId - 玩家自定义ID
   * @param {string} avatarId - 角色形象ID
   * @returns {object} - { success: boolean, message: string }
   */
  registerPlayer(socketId, playerId, avatarId) {
    // 检查ID是否已被占用
    if (!this.isIdAvailable(playerId)) {
      return { success: false, message: 'ID已被占用，请重新输入' }
    }
    
    // 检查该socket是否已注册过
    if (this.socketToPlayer.has(socketId)) {
      // 先注销旧的
      this.unregisterPlayer(socketId)
    }
    
    const playerData = {
      id: playerId,
      socketId: socketId,
      avatarId: avatarId,
      status: PLAYER_STATUS.IDLE,
      registeredAt: Date.now()
    }
    
    this.onlinePlayers.set(playerId, playerData)
    this.socketToPlayer.set(socketId, playerId)
    this.socketToData.set(socketId, playerData)
    
    console.log(`[大厅] 玩家注册成功: ${playerId} (${socketId})`)
    
    return { success: true, message: '注册成功', player: playerData }
  }
  
  /**
   * 注销玩家
   * @param {string} socketId - Socket ID
   */
  unregisterPlayer(socketId) {
    const playerId = this.socketToPlayer.get(socketId)
    if (!playerId) return
    
    // 清理该玩家发送的邀请
    const sentInvitationId = this.playerSentInvitations.get(playerId)
    if (sentInvitationId) {
      this.cancelInvitation(sentInvitationId)
    }
    
    // 清理该玩家收到的邀请
    const receivedInvitationId = this.playerReceivedInvitations.get(playerId)
    if (receivedInvitationId) {
      this.cancelInvitation(receivedInvitationId)
    }
    
    // 移除玩家
    this.onlinePlayers.delete(playerId)
    this.socketToPlayer.delete(socketId)
    this.socketToData.delete(socketId)
    this.playerSentInvitations.delete(playerId)
    this.playerReceivedInvitations.delete(playerId)
    
    console.log(`[大厅] 玩家注销: ${playerId}`)
  }
  
  /**
   * 获取在线玩家列表
   * @returns {Array} - 玩家列表
   */
  getOnlinePlayers() {
    const players = []
    this.onlinePlayers.forEach((player, playerId) => {
      players.push({
        id: playerId,
        avatarId: player.avatarId,
        status: player.status
      })
    })
    return players
  }
  
  /**
   * 获取玩家数据（通过Socket ID）
   * @param {string} socketId - Socket ID
   * @returns {object|null} - 玩家数据
   */
  getPlayerBySocket(socketId) {
    return this.socketToData.get(socketId) || null
  }
  
  /**
   * 获取玩家数据（通过玩家ID）
   * @param {string} playerId - 玩家ID
   * @returns {object|null} - 玩家数据
   */
  getPlayerById(playerId) {
    return this.onlinePlayers.get(playerId) || null
  }
  
  /**
   * 设置玩家状态为对局中
   * @param {string} playerId - 玩家ID
   */
  setPlayerInGame(playerId) {
    const player = this.onlinePlayers.get(playerId)
    if (player) {
      player.status = PLAYER_STATUS.IN_GAME
      console.log(`[大厅] 玩家进入对局: ${playerId}`)
    }
  }
  
  /**
   * 设置玩家状态为空闲
   * @param {string} playerId - 玩家ID
   */
  setPlayerIdle(playerId) {
    const player = this.onlinePlayers.get(playerId)
    if (player) {
      player.status = PLAYER_STATUS.IDLE
      console.log(`[大厅] 玩家恢复空闲: ${playerId}`)
    }
  }
  
  /**
   * 发送邀请
   * @param {string} fromSocketId - 发送者Socket ID
   * @param {string} toPlayerId - 接收者玩家ID
   * @param {object} io - Socket.IO实例
   * @returns {object} - { success: boolean, message: string }
   */
  sendInvitation(fromSocketId, toPlayerId, io) {
    const fromPlayer = this.getPlayerBySocket(fromSocketId)
    if (!fromPlayer) {
      return { success: false, message: '您尚未注册' }
    }
    
    // 检查是否已有待处理的邀请
    if (this.playerSentInvitations.has(fromPlayer.id)) {
      return { success: false, message: '您已有待处理的邀请' }
    }
    
    const toPlayer = this.getPlayerById(toPlayerId)
    if (!toPlayer) {
      return { success: false, message: '目标玩家不存在' }
    }
    
    // 不能邀请自己
    if (fromPlayer.id === toPlayerId) {
      return { success: false, message: '不能邀请自己' }
    }
    
    // 检查对方状态
    if (toPlayer.status === PLAYER_STATUS.IN_GAME) {
      return { success: false, message: '对方正在对局中' }
    }
    
    // 检查对方是否已有待处理的邀请
    if (this.playerReceivedInvitations.has(toPlayerId)) {
      return { success: false, message: '对方已有待处理的邀请' }
    }
    
    // 创建邀请
    const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const invitation = {
      id: invitationId,
      from: {
        id: fromPlayer.id,
        socketId: fromSocketId,
        avatarId: fromPlayer.avatarId
      },
      to: {
        id: toPlayerId,
        socketId: toPlayer.socketId,
        avatarId: toPlayer.avatarId
      },
      status: INVITATION_STATUS.PENDING,
      createdAt: Date.now()
    }
    
    this.pendingInvitations.set(invitationId, invitation)
    this.playerSentInvitations.set(fromPlayer.id, invitationId)
    this.playerReceivedInvitations.set(toPlayerId, invitationId)
    
    // 发送邀请通知给接收者
    io.to(toPlayer.socketId).emit('invitation_received', {
      invitationId: invitationId,
      from: {
        id: fromPlayer.id,
        avatarId: fromPlayer.avatarId
      }
    })
    
    console.log(`[大厅] 邀请发送: ${fromPlayer.id} -> ${toPlayerId}`)
    
    // 设置超时
    setTimeout(() => {
      this.expireInvitation(invitationId, io)
    }, INVITATION_TIMEOUT)
    
    return { success: true, message: '邀请已发送', invitationId }
  }
  
  /**
   * 接受邀请
   * @param {string} socketId - 接受者Socket ID
   * @param {string} invitationId - 邀请ID
   * @param {object} io - Socket.IO实例
   * @param {object} matchManager - 对局管理器
   * @param {object} roomManager - 房间管理器
   * @returns {object} - { success: boolean, message: string }
   */
  acceptInvitation(socketId, invitationId, io, matchManager, roomManager) {
    const invitation = this.pendingInvitations.get(invitationId)
    if (!invitation) {
      return { success: false, message: '邀请不存在或已过期' }
    }
    
    const toPlayer = this.getPlayerBySocket(socketId)
    if (!toPlayer || toPlayer.id !== invitation.to.id) {
      return { success: false, message: '无权处理此邀请' }
    }
    
    if (invitation.status !== INVITATION_STATUS.PENDING) {
      return { success: false, message: '邀请已失效' }
    }
    
    // 更新邀请状态
    invitation.status = INVITATION_STATUS.ACCEPTED
    
    // 清理邀请记录
    this.playerSentInvitations.delete(invitation.from.id)
    this.playerReceivedInvitations.delete(invitation.to.id)
    
    // 通知发送者邀请被接受
    io.to(invitation.from.socketId).emit('invitation_accepted', {
      invitationId: invitationId,
      to: {
        id: toPlayer.id,
        avatarId: toPlayer.avatarId
      }
    })
    
    // 设置双方为对局中状态
    this.setPlayerInGame(invitation.from.id)
    this.setPlayerInGame(invitation.to.id)
    
    // 广播在线列表更新
    this.broadcastOnlinePlayers(io)
    
    console.log(`[大厅] 邀请接受: ${invitation.from.id} <-> ${invitation.to.id}`)
    
    // 保存邀请双方信息（在删除邀请前）
    const fromSocketId = invitation.from.socketId
    const toSocketId = invitation.to.socketId
    
    // 创建房间和对局
    const roomCode = roomManager.createRoom(invitation.from.socketId)
    roomManager.joinRoom(invitation.to.socketId, roomCode)
    
    // 获取玩家形象
    const fromPlayerData = this.getPlayerById(invitation.from.id)
    const toPlayerData = this.getPlayerById(invitation.to.id)
    
    // 返回双方 socketId 和房间信息，让 index.js 处理 socket.join() 和 match 创建
    // 注意：必须先 socket.join() 再创建 match，否则 enter_configuring 事件无法送达
    
    // 移除邀请
    this.pendingInvitations.delete(invitationId)
    
    // 返回完整信息，让 index.js 处理后续流程
    return { 
      success: true, 
      message: '配对成功', 
      roomCode,
      fromSocketId,
      toSocketId,
      fromAvatarId: fromPlayerData?.avatarId || null,
      toAvatarId: toPlayerData?.avatarId || null
    }
  }
  
  /**
   * 拒绝邀请
   * @param {string} socketId - 拒绝者Socket ID
   * @param {string} invitationId - 邀请ID
   * @param {object} io - Socket.IO实例
   * @returns {object} - { success: boolean, message: string }
   */
  rejectInvitation(socketId, invitationId, io) {
    const invitation = this.pendingInvitations.get(invitationId)
    if (!invitation) {
      return { success: false, message: '邀请不存在或已过期' }
    }
    
    const toPlayer = this.getPlayerBySocket(socketId)
    if (!toPlayer || toPlayer.id !== invitation.to.id) {
      return { success: false, message: '无权处理此邀请' }
    }
    
    if (invitation.status !== INVITATION_STATUS.PENDING) {
      return { success: false, message: '邀请已失效' }
    }
    
    // 更新邀请状态
    invitation.status = INVITATION_STATUS.REJECTED
    
    // 清理邀请记录
    this.playerSentInvitations.delete(invitation.from.id)
    this.playerReceivedInvitations.delete(invitation.to.id)
    
    // 通知发送者邀请被拒绝
    io.to(invitation.from.socketId).emit('invitation_rejected', {
      invitationId: invitationId,
      by: toPlayer.id
    })
    
    // 移除邀请
    this.pendingInvitations.delete(invitationId)
    
    console.log(`[大厅] 邀请拒绝: ${invitation.from.id} <- ${invitation.to.id}`)
    
    return { success: true, message: '已拒绝邀请' }
  }
  
  /**
   * 取消邀请
   * @param {string} invitationId - 邀请ID
   */
  cancelInvitation(invitationId) {
    const invitation = this.pendingInvitations.get(invitationId)
    if (!invitation) return
    
    invitation.status = INVITATION_STATUS.EXPIRED
    this.playerSentInvitations.delete(invitation.from.id)
    this.playerReceivedInvitations.delete(invitation.to.id)
    this.pendingInvitations.delete(invitationId)
    
    console.log(`[大厅] 邀请取消: ${invitationId}`)
  }
  
  /**
   * 邀请超时处理
   * @param {string} invitationId - 邀请ID
   * @param {object} io - Socket.IO实例
   */
  expireInvitation(invitationId, io) {
    const invitation = this.pendingInvitations.get(invitationId)
    if (!invitation || invitation.status !== INVITATION_STATUS.PENDING) return
    
    // 超时视为拒绝
    invitation.status = INVITATION_STATUS.REJECTED
    
    // 清理邀请记录
    this.playerSentInvitations.delete(invitation.from.id)
    this.playerReceivedInvitations.delete(invitation.to.id)
    
    // 通知发送者邀请被拒绝（超时视为拒绝）
    io.to(invitation.from.socketId).emit('invitation_rejected', {
      invitationId: invitationId,
      reason: 'timeout'
    })
    
    // 通知接收者邀请已取消（因为超时了）
    io.to(invitation.to.socketId).emit('invitation_cancelled', {
      reason: 'timeout'
    })
    
    this.pendingInvitations.delete(invitationId)
    
    console.log(`[大厅] 邀请超时(视为拒绝): ${invitationId}`)
  }
  
  /**
   * 广播在线玩家列表
   * @param {object} io - Socket.IO实例
   */
  broadcastOnlinePlayers(io) {
    const players = this.getOnlinePlayers()
    io.emit('lobby_update', { players })
  }
  
  /**
   * 处理玩家断线
   * @param {string} socketId - Socket ID
   * @param {object} io - Socket.IO实例
   */
  handleDisconnect(socketId, io) {
    const player = this.getPlayerBySocket(socketId)
    if (player) {
      // 清理邀请
      const sentInvitationId = this.playerSentInvitations.get(player.id)
      if (sentInvitationId) {
        const invitation = this.pendingInvitations.get(sentInvitationId)
        if (invitation) {
          // 通知对方邀请已取消
          io.to(invitation.to.socketId).emit('invitation_cancelled', {
            reason: 'sender_disconnected'
          })
        }
        this.cancelInvitation(sentInvitationId)
      }
      
      const receivedInvitationId = this.playerReceivedInvitations.get(player.id)
      if (receivedInvitationId) {
        const invitation = this.pendingInvitations.get(receivedInvitationId)
        if (invitation) {
          // 通知对方邀请已被拒绝（因为接收者断线）
          io.to(invitation.from.socketId).emit('invitation_rejected', {
            reason: 'receiver_disconnected'
          })
        }
        this.cancelInvitation(receivedInvitationId)
      }
      
      // 注销玩家
      this.unregisterPlayer(socketId)
      
      // 广播列表更新
      this.broadcastOnlinePlayers(io)
    }
  }
  
  /**
   * 获取玩家状态常量
   */
  static get PLAYER_STATUS() {
    return PLAYER_STATUS
  }
}

export { LobbyManager, PLAYER_STATUS, INVITATION_STATUS }