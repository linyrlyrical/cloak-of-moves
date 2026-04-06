<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="invitation-dialog-overlay">
        <div class="invitation-dialog">
          <div class="dialog-header">
            <span class="dialog-icon">🎮</span>
            <h3>对战邀请</h3>
          </div>
          
          <div class="dialog-content">
            <div class="inviter-info">
              <AvatarIcon :avatar-id="invitation?.from?.avatarId" size="medium" />
              <span class="inviter-name">{{ invitation?.from?.id }}</span>
            </div>
            <p class="invite-text">邀请你进行对战！</p>
            <p class="time-left">剩余时间: {{ timeLeft }}秒</p>
          </div>
          
          <div class="dialog-actions">
            <button class="btn btn-accept" @click="accept">
              ✓ 接受
            </button>
            <button class="btn btn-reject" @click="reject">
              ✗ 拒绝
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import AvatarIcon from './AvatarIcon.vue'

const props = defineProps({
  visible: Boolean,
  invitation: Object // { invitationId, from: { id, avatarId } }
})

const emit = defineEmits(['accept', 'reject'])

const timeLeft = ref(30)
let timer = null

// 倒计时
watch(() => props.visible, (newVal) => {
  if (newVal) {
    timeLeft.value = 30
    timer = setInterval(() => {
      timeLeft.value--
      if (timeLeft.value <= 0) {
        // 超时自动拒绝
        reject()
      }
    }, 1000)
  } else {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

const accept = () => {
  emit('accept', props.invitation?.invitationId)
}

const reject = () => {
  emit('reject', props.invitation?.invitationId)
}
</script>

<style scoped>
.invitation-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.invitation-dialog {
  background: linear-gradient(145deg, #2a2a3e, #1e1e2e);
  border-radius: 16px;
  padding: 24px;
  min-width: 300px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  border: 2px solid #6c5ce7;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
}

.dialog-icon {
  font-size: 32px;
}

.dialog-header h3 {
  color: #fff;
  font-size: 20px;
  margin: 0;
}

.dialog-content {
  margin-bottom: 24px;
}

.inviter-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.inviter-name {
  color: #6c5ce7;
  font-size: 24px;
  font-weight: bold;
}

.invite-text {
  color: #fff;
  font-size: 16px;
  margin-bottom: 12px;
}

.time-left {
  color: #f39c12;
  font-size: 14px;
}

.dialog-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn-accept {
  padding: 12px 32px;
  background: #27ae60;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-accept:hover {
  background: #2ecc71;
  transform: translateY(-2px);
}

.btn-reject {
  padding: 12px 32px;
  background: transparent;
  color: #e74c3c;
  border: 2px solid #e74c3c;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reject:hover {
  background: #e74c3c;
  color: #fff;
}

/* 过渡动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: all 0.3s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .invitation-dialog,
.dialog-fade-leave-to .invitation-dialog {
  transform: scale(0.9);
}
</style>