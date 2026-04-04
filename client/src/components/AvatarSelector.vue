<template>
  <div class="avatar-selector-overlay" @click.self="$emit('close')">
    <div class="avatar-selector-modal">
      <!-- 标题栏 -->
      <div class="selector-header">
        <h2>选择你的角色形象</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <!-- 性别标签切换 -->
      <div class="gender-tabs">
        <button 
          class="gender-tab" 
          :class="{ active: activeGender === 'male' }"
          @click="activeGender = 'male'"
        >
          <span class="tab-icon">♂</span>
          <span class="tab-text">男性角色</span>
        </button>
        <button 
          class="gender-tab" 
          :class="{ active: activeGender === 'female' }"
          @click="activeGender = 'female'"
        >
          <span class="tab-icon">♀</span>
          <span class="tab-text">女性角色</span>
        </button>
      </div>
      
      <!-- 角色网格 -->
      <div class="avatars-grid">
        <div 
          v-for="avatar in currentAvatars" 
          :key="avatar.id"
          class="avatar-card"
          :class="{ selected: selectedAvatarId === avatar.id }"
          @click="selectAvatar(avatar)"
        >
          <div class="card-avatar">
            <AvatarIcon :avatar="avatar" size="xlarge" crop-mode="full" :selected="selectedAvatarId === avatar.id" />
          </div>
          <div class="card-info">
            <div class="card-name">{{ avatar.genderCn }}{{ avatar.name }}</div>
            <div class="card-desc">{{ avatar.description }}</div>
          </div>
          <div v-if="selectedAvatarId === avatar.id" class="selected-badge">
            <span>✓ 已选择</span>
          </div>
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <div class="selector-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-confirm" @click="confirmSelection" :disabled="!selectedAvatarId">
          确认选择
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { characterAvatars, getSelectedAvatar, saveSelectedAvatar } from '../utils/avatarManager'
import AvatarIcon from './AvatarIcon.vue'

export default {
  name: 'AvatarSelector',
  components: {
    AvatarIcon
  },
  emits: ['close', 'selected'],
  setup(props, { emit }) {
    const activeGender = ref('male')
    const selectedAvatarId = ref(null)
    
    // 当前显示的角色列表
    const currentAvatars = computed(() => {
      return characterAvatars[activeGender.value] || []
    })
    
    // 初始化时获取当前选中的形象
    onMounted(() => {
      const current = getSelectedAvatar()
      selectedAvatarId.value = current.id
      // 设置当前性别标签
      if (current.gender === 'female') {
        activeGender.value = 'female'
      }
    })
    
    // 选择角色
    const selectAvatar = (avatar) => {
      selectedAvatarId.value = avatar.id
    }
    
    // 确认选择
    const confirmSelection = () => {
      if (selectedAvatarId.value) {
        saveSelectedAvatar(selectedAvatarId.value)
        emit('selected', selectedAvatarId.value)
        emit('close')
      }
    }
    
    return {
      activeGender,
      selectedAvatarId,
      currentAvatars,
      selectAvatar,
      confirmSelection
    }
  }
}
</script>

<style scoped>
.avatar-selector-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.avatar-selector-modal {
  background: white;
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { 
    opacity: 0;
    transform: translateY(30px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

/* 标题栏 */
.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.selector-header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(90deg);
}

/* 性别标签 */
.gender-tabs {
  display: flex;
  padding: 1rem 1.5rem;
  gap: 1rem;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.gender-tab {
  flex: 1;
  padding: 0.8rem 1rem;
  border: 2px solid #dee2e6;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.gender-tab:hover {
  border-color: #667eea;
}

.gender-tab.active {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
}

.tab-icon {
  font-size: 1.2rem;
}

.tab-text {
  font-weight: 600;
  color: #333;
}

/* 角色网格 */
.avatars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.avatar-card {
  background: #f8f9fa;
  border: 3px solid transparent;
  border-radius: 16px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.avatar-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  border-color: #667eea;
}

.avatar-card.selected {
  border-color: #48bb78;
  background: linear-gradient(145deg, #e6fffa, #c6f6d5);
}

.card-avatar {
  margin-bottom: 0.5rem;
}

.card-info {
  text-align: center;
}

.card-name {
  font-weight: 600;
  color: #333;
  font-size: 0.95rem;
}

.card-desc {
  font-size: 0.75rem;
  color: #666;
  margin-top: 0.25rem;
}

.selected-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #48bb78;
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: bold;
}

/* 底部按钮 */
.selector-footer {
  display: flex;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 0.8rem 1.5rem;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: white;
  border: 2px solid #dee2e6;
  color: #666;
}

.btn-cancel:hover {
  border-color: #adb5bd;
  background: #f8f9fa;
}

.btn-confirm {
  background: linear-gradient(135deg, #48bb78, #38a169);
  border: none;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
}

.btn-confirm:disabled {
  background: #adb5bd;
  cursor: not-allowed;
}
</style>