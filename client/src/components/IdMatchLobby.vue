<template>
  <div class="lobby-overlay">
    <div class="lobby-content">
      <!-- 顶部：自己的ID显示 -->
      <div class="lobby-header">
        <h2>🎮 ID匹配大厅</h2>
        <div class="my-id-display">
          <span class="id-label">你的ID:</span>
          <span class="id-value">{{ myPlayerId }}</span>
          <button class="btn-copy-id" @click="copyMyId">📋</button>
        </div>
      </div>
      
      <!-- ID注册区域 -->
      <div v-if="!isRegistered" class="register-section">
        <div class="register-form">
          <input 
            v-model="inputPlayerId"
            placeholder="输入你的游戏ID"
            class="id-input"
            maxlength="20"
            @keyup.enter="registerId"
          />
          <button class="btn btn-primary" @click="registerId" :disabled="!inputPlayerId.trim()">
            注册ID
          </button>
        </div>
        <p v-if="registerError" class="error-message">{{ registerError }}</p>
        <p class="hint-text">ID只能包含中文、字母、数字和下划线，最长20字符</p>
      </div>
      
      <!-- 在线玩家列表 -->
      <div v-else class="lobby-main">
        <div class="online-section">
          <div class="section-header">
            <h3>在线玩家 ({{ onlinePlayers.length }})</h3>
            <button class="btn-refresh" @click="refreshPlayers">🔄</button>
          </div>
          
          <div class="players-list">
            <div 
              v-for="player in onlinePlayers" 
              :key="player.id"
              class="player-item"
              :class="{ 
                'is-me': player.id === myPlayerId,
                'in-game': player.status === 'in_game'
              }"
            >
              <div class="player-avatar">
                <AvatarIcon :avatar-id="player.avatarId" size="small" />
              </div>
              <div class="player-info">
                <span class="player-name">{{ player.id }}</span>
                <span v-if="player.id === myPlayerId" class="badge me-badge">我</span>
                <span v-if="player.status === 'in_game'" class="badge status-badge">对局中</span>
                <span v-else class="badge status-badge idle">空闲</span>
              </div>
              <button 
                v-if="player.id !== myPlayerId && player.status === 'idle'"
                class="btn btn-invite"
                @click="sendInvite(player.id)"
                :disabled="hasPendingInvitation"
              >
                邀请对战
              </button>
              <span v-else-if="player.id === myPlayerId" class="self-label">-</span>
              <span v-else class="busy-label">对局中</span>
            </div>
            
            <div v-if="onlinePlayers.length === 0" class="no-players">
              暂无其他在线玩家
            </div>
          </div>
        </div>
        
        <!-- 邀请状态显示 -->
        <div v-if="sentInvitation" class="invitation-status">
          <p>已向 <strong>{{ sentInvitation.toPlayerId }}</strong> 发送邀请...</p>
          <div class="loading-spinner small"></div>
          <button class="btn btn-cancel" @click="cancelInvitation">取消</button>
        </div>
      </div>
      
      <!-- 底部操作栏 -->
      <div class="lobby-footer">
        <button class="btn btn-back" @click="leaveLobby">离开大厅</button>
      </div>
    </div>
    
    <!-- 被拒绝提示 Toast -->
    <Transition name="toast">
      <div v-if="rejectedToast" class="rejected-toast">
        {{ rejectedToast }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AvatarIcon from './AvatarIcon.vue'

const props = defineProps({
  socket: Object,
  myAvatarId: String
})

const emit = defineEmits(['match-found', 'leave', 'invitation-received'])

// 状态
const inputPlayerId = ref('')
const myPlayerId = ref('')
const isRegistered = ref(false)
const registerError = ref('')
const onlinePlayers = ref([])
const sentInvitation = ref(null)
const receivedInvitation = ref(null)
const rejectedToast = ref(null) // 被拒绝的提示

// 计算属性
const hasPendingInvitation = computed(() => sentInvitation.value !== null)

// 方法
const registerId = () => {
  const id = inputPlayerId.value.trim()
  if (!id) return
  
  registerError.value = ''
  props.socket.emit('register_id', {
    playerId: id,
    avatarId: props.myAvatarId
  })
}

const refreshPlayers = () => {
  props.socket.emit('get_lobby_players')
}

const sendInvite = (toPlayerId) => {
  if (hasPendingInvitation.value) return
  
  props.socket.emit('send_invitation', { toPlayerId })
}

const cancelInvitation = () => {
  // 发送拒绝来取消（实际是服务端处理超时）
  sentInvitation.value = null
}

const copyMyId = () => {
  if (myPlayerId.value) {
    navigator.clipboard.writeText(myPlayerId.value)
    // 可以加个提示
  }
}

const leaveLobby = () => {
  props.socket.emit('leave_lobby')
  emit('leave')
}

// Socket事件处理
const handleIdRegistered = (data) => {
  myPlayerId.value = data.playerId
  isRegistered.value = true
  registerError.value = ''
}

const handleIdTaken = (data) => {
  registerError.value = data.message
}

const handleIdError = (data) => {
  registerError.value = data.message
}

const handleLobbyUpdate = (data) => {
  onlinePlayers.value = data.players
}

const handleInvitationSent = (data) => {
  sentInvitation.value = {
    invitationId: data.invitationId,
    toPlayerId: data.toPlayerId
  }
}

const handleInvitationAccepted = (data) => {
  sentInvitation.value = null
  // 匹配成功，通知父组件
  emit('match-found')
}

const handleInvitationRejected = (data) => {
  const wasInvitationTo = sentInvitation.value?.toPlayerId
  sentInvitation.value = null
  
  // 显示被拒绝的提示
  const message = data.reason === 'timeout' 
    ? '邀请超时，对方未响应' 
    : `${wasInvitationTo || '对方'} 拒绝了你的邀请`
  
  rejectedToast.value = message
  setTimeout(() => {
    rejectedToast.value = null
  }, 3000)
}

const handleInvitationExpired = (data) => {
  sentInvitation.value = null
}

const handleInvitationReceived = (data) => {
  // 收到邀请，通知父组件显示弹窗
  emit('invitation-received', {
    invitationId: data.invitationId,
    from: data.from
  })
}

  const handleMatchFound = (data) => {
    // 传递房间号和玩家身份给父组件
    emit('match-found', { 
      roomCode: data.roomCode,
      isPlayer1: data.isPlayer1
    })
  }

// 生命周期
onMounted(() => {
  // 注册事件监听
  props.socket.on('id_registered', handleIdRegistered)
  props.socket.on('id_taken', handleIdTaken)
  props.socket.on('id_error', handleIdError)
  props.socket.on('lobby_update', handleLobbyUpdate)
  props.socket.on('invitation_sent', handleInvitationSent)
  props.socket.on('invitation_accepted', handleInvitationAccepted)
  props.socket.on('invitation_rejected', handleInvitationRejected)
  props.socket.on('invitation_expired', handleInvitationExpired)
  props.socket.on('invitation_received', handleInvitationReceived)
  props.socket.on('match_found', handleMatchFound)
  
  // 如果已注册，获取在线列表
  if (isRegistered.value) {
    refreshPlayers()
  }
})

onUnmounted(() => {
  // 移除事件监听
  props.socket.off('id_registered', handleIdRegistered)
  props.socket.off('id_taken', handleIdTaken)
  props.socket.off('id_error', handleIdError)
  props.socket.off('lobby_update', handleLobbyUpdate)
  props.socket.off('invitation_sent', handleInvitationSent)
  props.socket.off('invitation_accepted', handleInvitationAccepted)
  props.socket.off('invitation_rejected', handleInvitationRejected)
  props.socket.off('invitation_expired', handleInvitationExpired)
  props.socket.off('invitation_received', handleInvitationReceived)
  props.socket.off('match_found', handleMatchFound)
})

// 暴露方法供父组件调用
defineExpose({
  acceptInvitation: (invitationId) => {
    props.socket.emit('accept_invitation', { invitationId })
  },
  rejectInvitation: (invitationId) => {
    props.socket.emit('reject_invitation', { invitationId })
  },
  getMyPlayerId: () => myPlayerId.value
})
</script>

<style scoped>
.lobby-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.lobby-content {
  background: linear-gradient(145deg, #6c5ce7, #5b4cdb);
  border-radius: 16px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 60px rgba(108, 92, 231, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.lobby-header {
  text-align: center;
  margin-bottom: 20px;
}

.lobby-header h2 {
  color: #fff;
  margin-bottom: 12px;
}

.my-id-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 20px;
}

.id-label {
  color: rgba(255, 255, 255, 0.7);
}

.id-value {
  color: #fff;
  font-weight: bold;
  font-size: 18px;
}

.btn-copy-id {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-copy-id:hover {
  opacity: 1;
}

.register-section {
  text-align: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(8px);
}

.register-form {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 12px;
}

.id-input {
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 16px;
  width: 200px;
  transition: all 0.2s ease;
}

.id-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.id-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.2);
}

.error-message {
  color: #e74c3c;
  margin-bottom: 8px;
}

.hint-text {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.lobby-main {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.online-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-header h3 {
  color: #fff;
  font-size: 16px;
}

.btn-refresh {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.btn-refresh:hover {
  opacity: 1;
}

.players-list {
  flex: 1;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 8px;
}

.player-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.player-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.player-item.is-me {
  background: rgba(108, 92, 231, 0.2);
  border: 1px solid rgba(108, 92, 231, 0.4);
}

.player-item.in-game {
  opacity: 0.6;
}

.player-avatar {
  margin-right: 12px;
}

.player-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-name {
  color: #fff;
  font-weight: 500;
}

.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
}

.me-badge {
  background: #6c5ce7;
  color: #fff;
}

.status-badge {
  background: #e74c3c;
  color: #fff;
}

.status-badge.idle {
  background: #27ae60;
}

.btn-invite {
  padding: 6px 12px;
  font-size: 12px;
  background: #6c5ce7;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-invite:hover:not(:disabled) {
  background: #5b4cdb;
}

.btn-invite:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.self-label,
.busy-label {
  color: #666;
  font-size: 12px;
}

.no-players {
  text-align: center;
  color: #666;
  padding: 20px;
}

.invitation-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(108, 92, 231, 0.2);
  border-radius: 8px;
  margin-top: 12px;
}

.invitation-status p {
  color: #fff;
  margin: 0;
  flex: 1;
}

.invitation-status strong {
  color: #6c5ce7;
}

.loading-spinner.small {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #6c5ce7;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-cancel {
  padding: 6px 12px;
  font-size: 12px;
  background: transparent;
  border: 1px solid #e74c3c;
  color: #e74c3c;
  border-radius: 6px;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e74c3c;
  color: #fff;
}

.lobby-footer {
  margin-top: 20px;
  text-align: center;
}

.btn-back {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.5);
  color: rgba(255, 255, 255, 0.9);
  padding: 10px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-back:hover {
  border-color: rgba(255, 255, 255, 0.8);
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.btn-primary {
  background: rgba(255, 255, 255, 0.95);
  color: #6c5ce7;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 被拒绝提示 Toast */
.rejected-toast {
  position: fixed;
  top: 20%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(231, 76, 60, 0.95);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 2000;
  white-space: nowrap;
}

/* Toast 动画 */
.toast-enter-active {
  animation: toast-in 0.3s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.3s ease-in;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }
}
</style>
