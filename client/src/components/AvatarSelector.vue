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
          :ref="el => setAvatarCardRef(avatar.id, el)"
          class="avatar-card"
          :class="{ selected: selectedAvatarId === avatar.id }"
          @click="selectAvatar(avatar)"
          @mouseenter="handleMouseEnter(avatar)"
          @mouseleave="handleMouseLeave"
        >
          <div class="card-avatar">
            <AvatarIcon :avatar="avatar" size="xlarge" cropMode="full" :selected="selectedAvatarId === avatar.id" />
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
    
    <!-- 技能提示卡片 - 使用 Teleport 渲染到 body -->
    <Teleport to="body">
      <Transition name="skill-tooltip">
        <div 
          v-if="showSkillTooltip && hoveredAvatarId && currentSkill" 
          class="skill-tooltip-card"
          :class="currentSkill.skillType === 'active' ? 'active-skill' : 'passive-skill'"
          :style="tooltipStyle"
        >
          <div class="skill-tooltip-icon">{{ currentSkill.skillIcon }}</div>
          <div class="skill-tooltip-name">{{ currentSkill.skillName }}</div>
          <div class="skill-tooltip-type-label">
            {{ currentSkill.skillType === 'active' ? '主动' : '被动' }}
          </div>
          <div v-if="currentSkill.skillType === 'active'" class="skill-tooltip-cooldown">
            冷却: {{ currentSkill.cooldown }}回合
          </div>
          <div class="skill-tooltip-description">{{ currentSkill.description }}</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { characterAvatars, getSelectedAvatar, saveSelectedAvatar } from '../utils/avatarManager.js'
import { CHARACTER_SKILLS } from '@shared/constants.js'
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
    
    // 悬停技能提示相关
    const hoveredAvatarId = ref(null)
    const showSkillTooltip = ref(false)
    let hoverTimeout = null
    
    // 存储角色卡片DOM引用
    const avatarCardRefs = reactive({})
    
    // 技能卡片位置样式
    const tooltipStyle = ref({})
    
    // 当前显示的角色列表
    const currentAvatars = computed(() => {
      return characterAvatars[activeGender.value] || []
    })
    
    // 设置角色卡片DOM引用
    const setAvatarCardRef = (avatarId, el) => {
      if (el) {
        avatarCardRefs[avatarId] = el
      }
    }
    
    // 根据avatar获取技能信息
    // avatar.id格式与技能ID格式一致，都是 '职业_性别' 如 'mage_male'
    const getSkillByAvatar = (avatar) => {
      if (!avatar) return null
      return CHARACTER_SKILLS[avatar.id] || null
    }
    
    // 获取当前悬停的角色对象
    const getHoveredAvatar = () => {
      if (!hoveredAvatarId.value) return null
      return currentAvatars.value.find(a => a.id === hoveredAvatarId.value)
    }
    
    // 当前悬停角色的技能
    const currentSkill = computed(() => {
      const avatar = getHoveredAvatar()
      return avatar ? getSkillByAvatar(avatar) : null
    })
    
    // 计算技能卡片位置
    const calculateTooltipPosition = () => {
      if (!hoveredAvatarId.value) return
      
      const cardEl = avatarCardRefs[hoveredAvatarId.value]
      if (!cardEl) return
      
      const rect = cardEl.getBoundingClientRect()
      const tooltipWidth = 140 // 技能卡片宽度
      const tooltipGap = 12 // 间距
      const viewportWidth = window.innerWidth
      
      // 判断是否靠近右边缘
      const isNearRightEdge = rect.right + tooltipWidth + tooltipGap > viewportWidth - 20
      
      if (isNearRightEdge) {
        // 显示在左侧
        tooltipStyle.value = {
          position: 'fixed',
          left: `${rect.left - tooltipWidth - tooltipGap}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translateY(-50%)'
        }
      } else {
        // 显示在右侧
        tooltipStyle.value = {
          position: 'fixed',
          left: `${rect.right + tooltipGap}px`,
          top: `${rect.top + rect.height / 2}px`,
          transform: 'translateY(-50%)'
        }
      }
    }
    
    // 鼠标进入角色卡片
    const handleMouseEnter = (avatar) => {
      // 清除之前的定时器
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
      hoveredAvatarId.value = avatar.id
      // 计算位置
      calculateTooltipPosition()
      // 0.5秒后显示技能提示
      hoverTimeout = setTimeout(() => {
        showSkillTooltip.value = true
      }, 500)
    }
    
    // 鼠标离开角色卡片
    const handleMouseLeave = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }
      showSkillTooltip.value = false
      hoveredAvatarId.value = null
    }
    
    // 初始化时获取当前选中的形象
    onMounted(() => {
      const current = getSelectedAvatar()
      selectedAvatarId.value = current.id
      // 设置当前性别标签
      if (current.gender === 'female') {
        activeGender.value = 'female'
      }
    })
    
    // 组件卸载时清理定时器
    onUnmounted(() => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
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
      confirmSelection,
      hoveredAvatarId,
      showSkillTooltip,
      getSkillByAvatar,
      handleMouseEnter,
      handleMouseLeave,
      setAvatarCardRef,
      tooltipStyle,
      currentSkill
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
  z-index: 10;
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

<style>
/* ========== 技能提示卡片样式（全局，因为使用了 Teleport） ========== */
.skill-tooltip-card {
  width: 140px;
  min-height: 100px;
  padding: 0.6rem;
  border-radius: 12px;
  cursor: default;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  overflow: hidden;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

/* 主动技能 - 金色渐变 */
.skill-tooltip-card.active-skill {
  background: linear-gradient(145deg, #fff9e6, #fff3cc);
  border: 2px solid #ffd700;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

/* 被动技能 - 银色渐变 */
.skill-tooltip-card.passive-skill {
  background: linear-gradient(145deg, #f0f0f0, #e8e8e8);
  border: 2px solid #c0c0c0;
  box-shadow: 0 4px 15px rgba(192, 192, 192, 0.3);
}

.skill-tooltip-icon {
  font-size: 1.8rem;
  margin-bottom: 0.3rem;
}

.skill-tooltip-name {
  font-size: 0.85rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.2rem;
}

.skill-tooltip-type-label {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
  margin-bottom: 0.2rem;
}

.active-skill .skill-tooltip-type-label {
  background: linear-gradient(135deg, #ffd700, #ffcc00);
  color: #8b4513;
}

.passive-skill .skill-tooltip-type-label {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #333;
}

.skill-tooltip-cooldown {
  font-size: 0.7rem;
  color: #666;
  margin-bottom: 0.2rem;
}

.skill-tooltip-description {
  font-size: 0.6rem;
  color: #888;
  line-height: 1.3;
  max-width: 100%;
  word-wrap: break-word;
}

/* 技能提示卡片过渡动画 */
.skill-tooltip-enter-active {
  animation: tooltipFadeIn 0.3s ease-out;
}

.skill-tooltip-leave-active {
  animation: tooltipFadeOut 0.2s ease-in;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
}

@keyframes tooltipFadeOut {
  from {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
  to {
    opacity: 0;
    transform: translateY(-50%) translateX(-10px);
  }
}
</style>
