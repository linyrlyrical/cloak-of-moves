<template>
  <div class="match-mode-overlay">
    <div class="match-mode-content">
      <h2>选择匹配模式</h2>
      
      <div class="mode-options">
        <div class="mode-option" @click="selectMode('solo')">
          <div class="mode-icon">🤖</div>
          <div class="mode-name">单人模式</div>
          <div class="mode-desc">与AI对战，随时开始</div>
        </div>
        
        <div class="mode-option" @click="selectMode('room')">
          <div class="mode-icon">🏠</div>
          <div class="mode-name">房间模式</div>
          <div class="mode-desc">创建/加入房间，与好友对战</div>
        </div>
        
        <div class="mode-option" @click="selectMode('id')">
          <div class="mode-icon">👤</div>
          <div class="mode-name">ID匹配</div>
          <div class="mode-desc">注册ID，在线邀请好友对战</div>
        </div>
      </div>
      
      <button class="btn btn-back" @click="$emit('close')">返回</button>
    </div>
  </div>
</template>

<script setup>
const emit = defineEmits(['select', 'close'])

const selectMode = (mode) => {
  emit('select', mode)
}
</script>

<style scoped>
.match-mode-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.match-mode-content {
  background: linear-gradient(145deg, #1e1e2e, #2a2a3e);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  max-width: 500px;
  width: 90%;
}

.match-mode-content h2 {
  color: #fff;
  margin-bottom: 24px;
  font-size: 24px;
}

.mode-options {
  display: flex;
  gap: 20px;
  margin-bottom: 24px;
}

.mode-option {
  flex: 1;
  background: linear-gradient(145deg, #2a2a3e, #1e1e2e);
  border: 2px solid #3a3a4e;
  border-radius: 12px;
  padding: 24px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-option:hover {
  border-color: #6c5ce7;
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(108, 92, 231, 0.3);
}

.mode-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.mode-name {
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 8px;
}

.mode-desc {
  color: #888;
  font-size: 14px;
}

.btn-back {
  background: transparent;
  border: 1px solid #555;
  color: #888;
  padding: 10px 24px;
  margin-top: 8px;
}

.btn-back:hover {
  border-color: #888;
  color: #fff;
}
</style>