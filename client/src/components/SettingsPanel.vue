<template>
  <div class="settings-overlay" :class="{ 'visible': visible }" @click.self="closePanel">
    <div class="settings-panel" :class="{ 'open': visible }">
      <!-- 标题栏 -->
      <div class="settings-header">
        <h2>⚙️ 设置</h2>
        <button class="close-btn" @click="closePanel">×</button>
      </div>

      <!-- 设置内容 -->
      <div class="settings-content">
        <!-- 玩家设置 -->
        <div class="settings-section">
          <h3 class="section-title">⚙️ 玩家设置</h3>
          <div class="setting-item">
            <label class="setting-label">昵称</label>
            <div class="nickname-input-wrapper">
              <input
                type="text"
                v-model="localSettings.nickname"
                placeholder="输入昵称"
                maxlength="10"
                class="nickname-input"
                @input="onNicknameInput"
              />
              <span class="char-count">{{ localSettings.nickname.length }}/10</span>
            </div>
            <p v-if="nicknameError" class="error-hint">{{ nicknameError }}</p>
          </div>
        </div>

        <!-- 音频设置 -->
        <div class="settings-section">
          <h3 class="section-title">🔊 音频设置</h3>

          <!-- 背景音乐音量 -->
          <div class="setting-item">
            <label class="setting-label">背景音乐</label>
            <div class="volume-control">
              <input
                type="range"
                min="0"
                max="100"
                :value="bgmusicVolumePercent"
                @input="onBgmusicVolumeChange"
                class="volume-slider"
              />
              <span class="volume-value">{{ bgmusicVolumePercent }}%</span>
            </div>
          </div>

          <!-- 音效音量 -->
          <div class="setting-item">
            <label class="setting-label">音效</label>
            <div class="volume-control">
              <input
                type="range"
                min="0"
                max="100"
                :value="sfxVolumePercent"
                @input="onSfxVolumeChange"
                class="volume-slider"
              />
              <span class="volume-value">{{ sfxVolumePercent }}%</span>
            </div>
          </div>

          <!-- 倒计时提示音开关 -->
          <div class="setting-item">
            <label class="setting-label">倒计时提示音</label>
            <div class="toggle-switch" @click="toggleCountdownSound">
              <div class="toggle-track" :class="{ 'active': localSettings.countdownSound }">
                <div class="toggle-thumb" :class="{ 'active': localSettings.countdownSound }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="settings-footer">
        <button class="btn btn-reset" @click="resetSettings">恢复默认</button>
        <button class="btn btn-save" @click="saveSettings">保存设置</button>
      </div>

      <!-- 保存成功提示 -->
      <Transition name="fade">
        <div v-if="showSaveSuccess" class="save-success-toast">
          ✓ 设置已保存
        </div>
      </Transition>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import settingsManager from '../utils/settingsManager'
import audioManager from '../utils/audioManager'

export default {
  name: 'SettingsPanel',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  setup(props, { emit }) {
    // 本地设置状态（编辑中的值）
    const localSettings = ref(settingsManager.getSettings())
    const nicknameError = ref('')
    const showSaveSuccess = ref(false)

    // 计算音量百分比
    const bgmusicVolumePercent = computed(() => Math.round(localSettings.value.bgmusicVolume * 100))
    const sfxVolumePercent = computed(() => Math.round(localSettings.value.sfxVolume * 100))

    // 监听面板显示，重新加载设置
    watch(() => props.visible, (newVal) => {
      console.log('[SettingsPanel] visible changed:', newVal)
      if (newVal) {
        localSettings.value = settingsManager.getSettings()
        nicknameError.value = ''
      }
    })

    // 昵称输入处理
    const onNicknameInput = () => {
      const result = settingsManager.validateNickname(localSettings.value.nickname)
      if (!result.valid) {
        nicknameError.value = result.message
      } else {
        nicknameError.value = ''
        // 自动保存昵称
        localSettings.value.nickname = result.value
        settingsManager.saveAllSettings(localSettings.value)
      }
    }

    // 背景音乐音量变化
    const onBgmusicVolumeChange = (event) => {
      const percent = parseInt(event.target.value)
      localSettings.value.bgmusicVolume = percent / 100
      // 实时预览音量变化
      audioManager.setBgmusicVolume(localSettings.value.bgmusicVolume)
      // 自动保存
      settingsManager.saveAllSettings(localSettings.value)
    }

    // 音效音量变化
    const onSfxVolumeChange = (event) => {
      const percent = parseInt(event.target.value)
      localSettings.value.sfxVolume = percent / 100
      // 实时预览音量变化
      audioManager.setSfxVolume(localSettings.value.sfxVolume)
      // 播放一个音效让用户听到效果
      audioManager.playClick()
      // 自动保存
      settingsManager.saveAllSettings(localSettings.value)
    }

    // 切换倒计时提示音
    const toggleCountdownSound = () => {
      localSettings.value.countdownSound = !localSettings.value.countdownSound
      audioManager.playClick()
      // 自动保存
      settingsManager.saveAllSettings(localSettings.value)
    }

    // 保存设置
    const saveSettings = () => {
      // 验证昵称
      const result = settingsManager.validateNickname(localSettings.value.nickname)
      if (!result.valid) {
        nicknameError.value = result.message
        return
      }

      // 保存设置
      localSettings.value.nickname = result.value
      settingsManager.saveAllSettings(localSettings.value)

      // 显示保存成功提示
      showSaveSuccess.value = true
      setTimeout(() => {
        showSaveSuccess.value = false
      }, 2000)

      // 播放点击音效
      audioManager.playClick()
    }

    // 重置设置
    const resetSettings = () => {
      const defaults = settingsManager.getDefaultSettings()
      localSettings.value = { ...defaults }
      // 实时应用音量
      audioManager.setBgmusicVolume(defaults.bgmusicVolume)
      audioManager.setSfxVolume(defaults.sfxVolume)
      audioManager.playClick()
      // 自动保存
      settingsManager.saveAllSettings(localSettings.value)
    }

    // 关闭面板
    const closePanel = () => {
      emit('close')
    }

    return {
      localSettings,
      nicknameError,
      showSaveSuccess,
      bgmusicVolumePercent,
      sfxVolumePercent,
      onNicknameInput,
      onBgmusicVolumeChange,
      onSfxVolumeChange,
      toggleCountdownSound,
      saveSettings,
      resetSettings,
      closePanel
    }
  }
}
</script>

<style scoped>
/* 遮罩层 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0);
  z-index: 9999;
  pointer-events: none;
  transition: background 0.3s ease;
}

.settings-overlay.visible {
  background: rgba(0, 0, 0, 0.5);
  pointer-events: auto;
}

/* 设置面板 */
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 360px;
  max-width: 90vw;
  height: 100%;
  background: linear-gradient(180deg, #2d3748 0%, #1a202c 100%);
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}

.settings-panel.open {
  transform: translateX(0);
}

/* 标题栏 */
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-header h2 {
  color: #fff;
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
}

.close-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 107, 107, 0.2);
  border: none;
  color: #ff6b6b;
  font-size: 1.5rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 107, 107, 0.8);
  transform: rotate(90deg);
}

/* 设置内容 */
.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem;
}

/* 设置分区 */
.settings-section {
  margin-bottom: 1.5rem;
}

.section-title {
  color: #a0aec0;
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

/* 设置项 */
.setting-item {
  margin-bottom: 1.2rem;
}

.setting-label {
  display: block;
  color: #e2e8f0;
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

/* 昵称输入 */
.nickname-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.nickname-input {
  flex: 1;
  padding: 0.7rem 1rem;
  padding-right: 50px;
  font-size: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  transition: all 0.2s;
}

.nickname-input:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.15);
}

.nickname-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.char-count {
  position: absolute;
  right: 12px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
}

.error-hint {
  color: #ff6b6b;
  font-size: 0.8rem;
  margin-top: 0.3rem;
}

/* 音量控制 */
.volume-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.volume-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.volume-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.volume-value {
  min-width: 45px;
  color: #a0aec0;
  font-size: 0.9rem;
  text-align: right;
}

/* 开关样式 */
.toggle-switch {
  cursor: pointer;
}

.toggle-track {
  width: 50px;
  height: 26px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 13px;
  position: relative;
  transition: background 0.3s;
}

.toggle-track.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.3s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.toggle-thumb.active {
  transform: translateX(24px);
}

/* 底部按钮 */
.settings-footer {
  display: flex;
  gap: 1rem;
  padding: 1.2rem 1.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn {
  flex: 1;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset {
  background: rgba(255, 255, 255, 0.1);
  color: #a0aec0;
}

.btn-reset:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.btn-save {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-save:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* 保存成功提示 */
.save-success-toast {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: #48bb78;
  color: #fff;
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(72, 187, 120, 0.4);
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 响应式 */
@media (max-width: 480px) {
  .settings-panel {
    width: 100%;
    max-width: 100%;
  }

  .settings-footer {
    flex-direction: column;
  }
}
</style>