<template>
  <div class="avatar-icon" :class="[sizeClass, cropModeClass, { 'with-ring': showRing }]" :style="avatarStyle">
    <!-- 外圈光环 -->
    <div v-if="showRing" class="avatar-ring" :style="ringStyle"></div>
    
    <!-- 角色图片 -->
    <img 
      v-if="avatarData.image" 
      :src="avatarData.image" 
      :alt="avatarData.name"
      class="avatar-image"
      :class="cropModeClass"
    />
    
    <!-- 默认占位（无图片时） -->
    <div v-else class="avatar-placeholder">
      <span class="placeholder-icon">?</span>
    </div>
    
    <!-- 选中标记 -->
    <div v-if="selected" class="selected-mark">
      <span class="check-icon">✓</span>
    </div>
  </div>
</template>

<script>
import { getAvatarById, getDefaultAvatar } from '../utils/avatarManager'

export default {
  name: 'AvatarIcon',
  props: {
    avatarId: {
      type: String,
      default: null
    },
    avatar: {
      type: Object,
      default: null
    },
    size: {
      type: String,
      default: 'medium', // small, medium, large, xlarge
      validator: (value) => ['small', 'medium', 'large', 'xlarge'].includes(value)
    },
    cropMode: {
      type: String,
      default: 'circle', // 'circle' 圆角正方形裁剪, 'full' 完整显示
      validator: (value) => ['circle', 'full'].includes(value)
    },
    showRing: {
      type: Boolean,
      default: false
    },
    selected: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    avatarData() {
      if (this.avatar) return this.avatar
      if (this.avatarId) return getAvatarById(this.avatarId)
      return getDefaultAvatar()
    },
    sizeClass() {
      return `size-${this.size}`
    },
    cropModeClass() {
      return `crop-${this.cropMode}`
    },
    avatarStyle() {
      return {
        '--primary-color': this.avatarData.primaryColor,
        '--secondary-color': this.avatarData.secondaryColor,
        '--accent-color': this.avatarData.accentColor,
        '--bg-gradient': this.avatarData.bgColor
      }
    },
    ringStyle() {
      return {
        borderColor: this.avatarData.accentColor
      }
    }
  }
}
</script>

<style scoped>
.avatar-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  overflow: hidden;
  background: var(--bg-gradient);
}

/* 尺寸 - 圆形裁剪模式 */
.avatar-icon.crop-circle {
  border-radius: 12px;
}

.avatar-icon.crop-circle.size-small {
  width: 36px;
  height: 36px;
}

.avatar-icon.crop-circle.size-medium {
  width: 50px;
  height: 50px;
}

.avatar-icon.crop-circle.size-large {
  width: 70px;
  height: 70px;
}

.avatar-icon.crop-circle.size-xlarge {
  width: 90px;
  height: 90px;
}

/* 尺寸 - 完整显示模式 (3:4比例) */
.avatar-icon.crop-full {
  border-radius: 12px;
}

.avatar-icon.crop-full.size-small {
  width: 36px;
  height: 48px;
}

.avatar-icon.crop-full.size-medium {
  width: 50px;
  height: 66.67px;
}

.avatar-icon.crop-full.size-large {
  width: 70px;
  height: 93.33px;
}

.avatar-icon.crop-full.size-xlarge {
  width: 90px;
  height: 120px;
}

/* 光环 */
.avatar-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 16px;
  border: 2px solid var(--accent-color);
  animation: ring-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes ring-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

/* 角色图片 */
.avatar-image {
  display: block;
}

/* 圆形裁剪模式 - 居中裁剪为正方形 */
.avatar-image.crop-circle {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

/* 完整显示模式 - 保持3:4比例 */
.avatar-image.crop-full {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
}

/* 默认占位 */
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-gradient);
}

.placeholder-icon {
  font-size: 1.5em;
  font-weight: bold;
  color: white;
}

/* 选中标记 */
.selected-mark {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 30%;
  height: 30%;
  min-width: 20px;
  min-height: 20px;
  background: #48bb78;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.check-icon {
  color: white;
  font-size: 0.7em;
  font-weight: bold;
}

/* 悬浮效果 */
.avatar-icon:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
}
</style>