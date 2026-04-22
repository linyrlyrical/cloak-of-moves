<template>
  <div class="chat-container" :class="{ 'expanded': isExpanded }">
    <!-- 展开/收起按钮 -->
    <div class="chat-toggle" @click="toggleExpand">
      <span class="toggle-icon">{{ isExpanded ? '✕' : '💬' }}</span>
    </div>
    
    <!-- 聊天面板 -->
    <transition name="slide">
      <div v-if="isExpanded" class="chat-panel">
        <!-- 标签切换 -->
        <div class="chat-tabs">
          <button 
            :class="['tab-btn', { active: activeTab === 'emoji' }]"
            @click="activeTab = 'emoji'"
          >😀 表情</button>
          <button 
            :class="['tab-btn', { active: activeTab === 'quick' }]"
            @click="activeTab = 'quick'"
          >💬 快捷</button>
          <button 
            :class="['tab-btn', { active: activeTab === 'text' }]"
            @click="activeTab = 'text'"
          >✏️ 输入</button>
        </div>
        
        <!-- 表情面板 -->
        <div v-if="activeTab === 'emoji'" class="emoji-grid">
          <button 
            v-for="emoji in CHAT_EMOJIS" 
            :key="emoji.id"
            class="emoji-btn"
            @click="sendEmoji(emoji)"
            :title="emoji.name"
          >{{ emoji.emoji }}</button>
        </div>
        
        <!-- 快捷消息面板 -->
        <div v-if="activeTab === 'quick'" class="quick-messages">
          <button 
            v-for="msg in CHAT_QUICK_MESSAGES" 
            :key="msg.id"
            class="quick-msg-btn"
            @click="sendQuickMessage(msg)"
          >
            <span class="msg-icon">{{ msg.icon }}</span>
            <span class="msg-text">{{ msg.text }}</span>
          </button>
        </div>
        
        <!-- 自定义输入面板 -->
        <div v-if="activeTab === 'text'" class="text-input-panel">
          <input 
            v-model="textInput"
            type="text"
            class="text-input"
            placeholder="输入消息..."
            maxlength="50"
            @keyup.enter="sendTextMessage"
          />
          <button class="send-btn" @click="sendTextMessage" :disabled="!textInput.trim()">
            发送
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { CHAT_EMOJIS, CHAT_QUICK_MESSAGES } from '../../../shared/constants.js'

const props = defineProps({
  socket: {
    type: Object,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send-message'])

const isExpanded = ref(false)
const activeTab = ref('emoji')
const textInput = ref('')

const toggleExpand = () => {
  if (!props.disabled) {
    isExpanded.value = !isExpanded.value
  }
}

const sendEmoji = (emoji) => {
  if (props.disabled) return
  emit('send-message', {
    type: 'emoji',
    content: emoji.emoji
  })
  isExpanded.value = false
}

const sendQuickMessage = (msg) => {
  if (props.disabled) return
  emit('send-message', {
    type: 'quick',
    content: msg.text
  })
  isExpanded.value = false
}

const sendTextMessage = () => {
  if (props.disabled || !textInput.value.trim()) return
  emit('send-message', {
    type: 'text',
    content: textInput.value.trim()
  })
  textInput.value = ''
  isExpanded.value = false
}
</script>

<style scoped>
.chat-container {
  position: relative;
  z-index: 100;
}

.chat-toggle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

.chat-toggle:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.toggle-icon {
  font-size: 20px;
  color: white;
}

.chat-panel {
  position: absolute;
  bottom: 54px;
  right: 0;
  width: 280px;
  background: rgba(30, 30, 50, 0.95);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.chat-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}

.tab-btn {
  flex: 1;
  padding: 8px 4px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.2);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.emoji-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.15);
}

.quick-messages {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.quick-msg-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.quick-msg-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
}

.msg-icon {
  font-size: 16px;
}

.msg-text {
  flex: 1;
}

.text-input-panel {
  display: flex;
  gap: 8px;
}

.text-input {
  flex: 1;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-size: 14px;
  outline: none;
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.send-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 滚动条样式 */
.emoji-grid::-webkit-scrollbar,
.quick-messages::-webkit-scrollbar {
  width: 4px;
}

.emoji-grid::-webkit-scrollbar-track,
.quick-messages::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.emoji-grid::-webkit-scrollbar-thumb,
.quick-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}
</style>
