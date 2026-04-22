<template>
  <transition name="bubble-pop">
    <div v-if="visible" class="chat-bubble" :class="position">
      <div class="bubble-content">
        <!-- 表情消息 -->
        <span v-if="message.type === 'emoji'" class="emoji-content">{{ message.content }}</span>
        <!-- 文字消息 -->
        <span v-else class="text-content">{{ message.content }}</span>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  position: {
    type: String,
    default: 'left' // 'left' | 'right'
  },
  duration: {
    type: Number,
    default: 5000 // 显示持续时间(ms)
  }
})

const visible = ref(true)

onMounted(() => {
  // 自动隐藏
  if (props.duration > 0) {
    setTimeout(() => {
      visible.value = false
    }, props.duration)
  }
})
</script>

<style scoped>
.chat-bubble {
  position: relative;
  max-width: 180px;
  margin: 6px 0;
}

.chat-bubble.left {
  align-self: flex-start;
}

.chat-bubble.right {
  align-self: flex-end;
}

.bubble-content {
  padding: 10px 14px;
  border-radius: 16px;
  background: rgba(102, 126, 234, 0.9);
  color: white;
  font-size: 14px;
  word-wrap: break-word;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
}

.chat-bubble.left .bubble-content {
  border-bottom-left-radius: 4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.chat-bubble.right .bubble-content {
  border-bottom-right-radius: 4px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.emoji-content {
  font-size: 28px;
  line-height: 1;
}

.text-content {
  line-height: 1.4;
}

/* 弹出动画 */
.bubble-pop-enter-active {
  animation: bubble-pop-in 0.3s ease-out;
}

.bubble-pop-leave-active {
  animation: bubble-pop-out 0.3s ease-in;
}

@keyframes bubble-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.5) translateY(10px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes bubble-pop-out {
  0% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  100% {
    opacity: 0;
    transform: scale(0.5) translateY(-10px);
  }
}
</style>