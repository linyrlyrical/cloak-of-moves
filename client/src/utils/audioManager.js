// 音频管理器 - 管理游戏中的所有音频播放
import settingsManager from './settingsManager'

class AudioManager {
  constructor() {
    // 音频对象存储
    this.sounds = {}
    this.bgmusic = null
    
    // 音量设置 - 从设置管理器读取（使用 ?? 避免 0 被当作 falsy 值）
    this.bgmusicVolume = settingsManager.getSetting('bgmusicVolume') ?? 0.1
    this.sfxVolume = settingsManager.getSetting('sfxVolume') ?? 0.6
    
    // 是否已初始化
    this.initialized = false
    
    // 倒计时音效是否正在播放（防止重复播放）
    this.countdownPlaying = false
    
    // 监听设置变更
    this.setupSettingsListeners()
    
    // 音频文件路径
    this.soundPaths = {
      bgmusic: '/sounds/music/bgmusic.mp3',
      attack: '/sounds/sound_effects/attack.wav',
      cardslide: '/sounds/sound_effects/cardslide.wav',
      click: '/sounds/sound_effects/click.mp3',
      ding: '/sounds/sound_effects/ding.wav',
      fail: '/sounds/sound_effects/fail.wav',
      pickupcard: '/sounds/sound_effects/pickupcard.wav',
      slide: '/sounds/sound_effects/slide.wav',
      victory: '/sounds/sound_effects/victory.wav',
      // 新增音效
      defense: '/sounds/sound_effects/defense.wav',
      successfulDefense: '/sounds/sound_effects/successful-defense.wav',
      swordCrash: '/sounds/sound_effects/sword-crash.wav',
      hitAndDie: '/sounds/sound_effects/hit-and-die.mp3',
      countdown3s: '/sounds/sound_effects/3s-countdown.wav',
      scan: '/sounds/sound_effects/scan.mp3'
    }
  }
  
  // 初始化音频系统
  init() {
    if (this.initialized) return
    
    // 创建背景音乐音频对象
    this.bgmusic = new Audio(this.soundPaths.bgmusic)
    this.bgmusic.loop = true
    this.bgmusic.volume = this.bgmusicVolume
    
    // 创建音效音频对象
    Object.keys(this.soundPaths).forEach(key => {
      if (key !== 'bgmusic') {
        this.sounds[key] = new Audio(this.soundPaths[key])
        this.sounds[key].volume = this.sfxVolume
      }
    })
    
    this.initialized = true
    console.log('[AudioManager] 音频系统初始化完成')
  }
  
  // 播放背景音乐
  playBgmusic() {
    if (!this.initialized) this.init()
    
    if (this.bgmusic) {
      // 如果已经在播放，不重复播放
      if (!this.bgmusic.paused) return
      
      this.bgmusic.currentTime = 0
      this.bgmusic.play().catch(err => {
        console.warn('[AudioManager] 背景音乐播放失败（可能需要用户交互）:', err)
      })
      console.log('[AudioManager] 开始播放背景音乐')
    }
  }
  
  // 停止背景音乐
  stopBgmusic() {
    if (this.bgmusic) {
      this.bgmusic.pause()
      this.bgmusic.currentTime = 0
      console.log('[AudioManager] 停止背景音乐')
    }
  }
  
  // 暂停背景音乐
  pauseBgmusic() {
    if (this.bgmusic) {
      this.bgmusic.pause()
    }
  }
  
  // 恢复背景音乐
  resumeBgmusic() {
    if (this.bgmusic && this.bgmusic.paused) {
      this.bgmusic.play().catch(err => {
        console.warn('[AudioManager] 恢复背景音乐失败:', err)
      })
    }
  }
  
  // 设置背景音乐音量
  setBgmusicVolume(volume) {
    this.bgmusicVolume = Math.max(0, Math.min(1, volume))
    if (this.bgmusic) {
      this.bgmusic.volume = this.bgmusicVolume
    }
  }
  
  // 设置音效音量
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.sfxVolume
    })
  }
  
  // 播放音效
  playSound(name) {
    if (!this.initialized) this.init()
    
    const sound = this.sounds[name]
    if (sound) {
      // 重置播放位置并播放
      sound.currentTime = 0
      sound.play().catch(err => {
        console.warn(`[AudioManager] 播放音效 ${name} 失败:`, err)
      })
    } else {
      console.warn(`[AudioManager] 未找到音效: ${name}`)
    }
  }
  
  // 播放点击音效
  playClick() {
    this.playSound('click')
  }
  
  // 播放攻击音效
  playAttack() {
    this.playSound('attack')
  }
  
  // 播放发牌音效
  playCardslide() {
    this.playSound('cardslide')
  }
  
  // 播放加入房间成功音效
  playDing() {
    this.playSound('ding')
  }
  
  // 播放胜利音效
  playVictory() {
    this.playSound('victory')
  }
  
  // 播放失败音效
  playFail() {
    this.playSound('fail')
  }
  
  // 播放出牌音效
  playPickupcard() {
    this.playSound('pickupcard')
  }
  
  // 播放移动音效
  playSlide() {
    this.playSound('slide')
  }
  
  // 播放防御音效
  playDefense() {
    this.playSound('defense')
  }
  
  // 播放防御成功音效
  playSuccessfulDefense() {
    this.playSound('successfulDefense')
  }
  
  // 播放回合切换音效
  playSwordCrash() {
    this.playSound('swordCrash')
  }
  
  // 播放玩家死亡音效
  playHitAndDie() {
    this.playSound('hitAndDie')
  }
  
  // 播放3秒倒计时音效
  playCountdown3s() {
    // 防止重复播放
    if (this.countdownPlaying) return
    this.countdownPlaying = true
    this.playSound('countdown3s')
    // 1秒后重置状态，允许再次播放
    setTimeout(() => {
      this.countdownPlaying = false
    }, 1000)
  }
  
  // 重置倒计时状态（用于新的倒计时开始时）
  resetCountdown() {
    this.countdownPlaying = false
  }
  
  // 停止倒计时音效（用户提前确认时调用）
  stopCountdownSound() {
    const sound = this.sounds['countdown3s']
    if (sound) {
      sound.pause()
      sound.currentTime = 0
    }
    this.countdownPlaying = false
  }
  
  // 播放探查音效
  playScan() {
    this.playSound('scan')
  }
  
  // 设置变更监听器
  setupSettingsListeners() {
    // 监听背景音乐音量变更
    settingsManager.addListener('bgmusicVolume', (newValue) => {
      this.bgmusicVolume = newValue
      if (this.bgmusic) {
        this.bgmusic.volume = newValue
      }
    })
    
    // 监听音效音量变更
    settingsManager.addListener('sfxVolume', (newValue) => {
      this.sfxVolume = newValue
      Object.values(this.sounds).forEach(sound => {
        sound.volume = newValue
      })
    })
  }
  
  // 获取当前音量设置
  getVolumes() {
    return {
      bgmusicVolume: this.bgmusicVolume,
      sfxVolume: this.sfxVolume
    }
  }
  
  // 检查倒计时音效是否启用
  isCountdownSoundEnabled() {
    return settingsManager.getSetting('countdownSound')
  }
}

// 导出单例
export const audioManager = new AudioManager()
export default audioManager