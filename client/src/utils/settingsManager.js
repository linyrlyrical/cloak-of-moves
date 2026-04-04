// 设置管理器 - 管理游戏设置和持久化存储

const STORAGE_KEY = 'cloak_of_moves_settings'

// 默认设置
const DEFAULT_SETTINGS = {
  nickname: '\u73a9\u5bb6',  // "玩家"（使用 Unicode 转义避免编码问题）
  bgmusicVolume: 0.1,    // 背景音乐音量 (0-1)
  sfxVolume: 0.6,        // 音效音量 (0-1)
  countdownSound: true   // 倒计时提示音开关
}

class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS }
    this.listeners = new Map() // 设置变更监听器
    this.loadSettings()
  }

  // 从 localStorage 加载设置
  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 合并保存的设置和默认设置（处理新增设置项的情况）
        this.settings = { ...DEFAULT_SETTINGS, ...parsed }
        console.log('[SettingsManager] 设置已加载:', this.settings)
      }
    } catch (error) {
      console.error('[SettingsManager] 加载设置失败:', error)
    }
  }

  // 保存设置到 localStorage
  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
      console.log('[SettingsManager] 设置已保存:', this.settings)
    } catch (error) {
      console.error('[SettingsManager] 保存设置失败:', error)
    }
  }

  // 获取所有设置
  getSettings() {
    return { ...this.settings }
  }

  // 获取单个设置
  getSetting(key) {
    return this.settings[key]
  }

  // 保存单个设置
  saveSetting(key, value) {
    if (key in DEFAULT_SETTINGS) {
      const oldValue = this.settings[key]
      this.settings[key] = value
      this.saveSettings()
      
      // 触发变更监听器
      if (oldValue !== value) {
        this.notifyListeners(key, value, oldValue)
      }
      
      return true
    }
    console.warn(`[SettingsManager] 未知的设置项: ${key}`)
    return false
  }

  // 保存多个设置
  saveAllSettings(newSettings) {
    const oldSettings = { ...this.settings }
    this.settings = { ...DEFAULT_SETTINGS, ...newSettings }
    this.saveSettings()
    
    // 触发所有变更的监听器
    Object.keys(newSettings).forEach(key => {
      if (oldSettings[key] !== newSettings[key]) {
        this.notifyListeners(key, newSettings[key], oldSettings[key])
      }
    })
  }

  // 重置为默认设置
  resetToDefault() {
    const oldSettings = { ...this.settings }
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
    
    // 触发所有变更的监听器
    Object.keys(DEFAULT_SETTINGS).forEach(key => {
      if (oldSettings[key] !== DEFAULT_SETTINGS[key]) {
        this.notifyListeners(key, DEFAULT_SETTINGS[key], oldSettings[key])
      }
    })
  }

  // 添加设置变更监听器
  addListener(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set())
    }
    this.listeners.get(key).add(callback)
  }

  // 移除设置变更监听器
  removeListener(key, callback) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).delete(callback)
    }
  }

  // 通知监听器
  notifyListeners(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => {
        try {
          callback(newValue, oldValue)
        } catch (error) {
          console.error(`[SettingsManager] 监听器执行错误 (${key}):`, error)
        }
      })
    }
  }

  // 获取默认设置（用于重置或显示默认值）
  getDefaultSettings() {
    return { ...DEFAULT_SETTINGS }
  }

  // 验证昵称
  validateNickname(nickname) {
    const trimmed = nickname.trim()
    if (trimmed.length < 2) {
      return { valid: false, message: '昵称至少需要2个字符' }
    }
    if (trimmed.length > 10) {
      return { valid: false, message: '昵称最多10个字符' }
    }
    return { valid: true, value: trimmed }
  }
}

// 导出单例
export const settingsManager = new SettingsManager()
export default settingsManager