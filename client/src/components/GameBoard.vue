<template>
  <div class="game-board-wrapper" :class="themeClass" :style="themeStyle">
    <!-- 主题背景装饰层 -->
    <div class="theme-background">
      <!-- 装饰粒子 -->
      <div class="theme-particles">
        <span v-for="i in 15" :key="'particle-' + i" class="theme-particle" :class="`particle-${i}`"></span>
      </div>
      <!-- 环境光效 -->
      <div class="theme-ambient"></div>
      <!-- 主题装饰贴图 -->
      <div class="theme-decorations">
        <span v-for="i in 6" :key="'deco-' + i" class="decoration-item" :class="`deco-${i}`"></span>
      </div>
    </div>
    
    <div class="game-board">
      <div 
        class="grid"
        :style="{
          gridTemplateColumns: `repeat(${map.width || map.size}, 40px)`,
          gridTemplateRows: `repeat(${map.height || map.size}, 40px)`
        }"
      >
        <div 
          v-for="(cell, index) in cells" 
          :key="index"
          class="cell"
          :class="{
            'obstacle': cell.isObstacle,
            'player1': cell.hasPlayer1,
            'player2': cell.hasPlayer2,
            'highlight': cell.isHighlighted,
            'attack-path': cell.inAttackPath,
            'attack-hit': cell.isAttackTarget && attackEffect?.hit,
            'attack-miss': cell.isAttackTarget && !attackEffect?.hit
          }"
        >
          <!-- 传送门进口 - 增强视觉效果 -->
          <span v-if="cell.portalEntry" class="portal portal-entry" :class="`portal-${cell.portalEntry}`">
            <span class="portal-outer-ring"></span>
            <span class="portal-inner-ring"></span>
            <span class="portal-core"></span>
            <span class="portal-spiral"></span>
            <span class="portal-arrow">◉</span>
          </span>
          <!-- 传送门出口 - 独立条件，允许与玩家共存 -->
          <span v-if="cell.portalExit" class="portal portal-exit" :class="`portal-${cell.portalExit}`">
            <span class="portal-inner"></span>
            <span class="portal-symbol">○</span>
          </span>
          <!-- 障碍物 - 根据主题显示不同形状 -->
          <span v-if="cell.isObstacle && !cell.hasPlayer1 && !cell.hasPlayer2" class="obstacle-mark" :class="getObstacleClass(cell)">
            <span class="obstacle-shape" :class="getObstacleShape(cell)"></span>
          </span>
          <!-- 玩家标记 - 独立条件，与传送门出口共存 -->
          <span v-if="cell.hasPlayer1" class="player-mark player1-mark" :class="{ 'attacked': cell.isAttackTarget && attackEffect?.hit, 'on-portal-exit': cell.portalExit }">1</span>
          <span v-if="cell.hasPlayer2" class="player-mark player2-mark" :class="{ 'attacked': cell.isAttackTarget && attackEffect?.hit, 'on-portal-exit': cell.portalExit }">2</span>
        </div>
      </div>
    </div>
    
    <!-- 攻击特效层 - 能量闪光 -->
    <div v-if="attackEffect" class="attack-effect-layer" :style="getAttackEffectStyle()">
      <!-- 能量闪光线条 -->
      <div class="energy-beam" :class="[attackEffect.direction, `range-${attackEffect.range}`]"></div>
      
      <!-- 目标处闪光扩散 -->
      <div v-if="showExplosion" class="explosion-flash" :style="getExplosionStyle()"></div>
    </div>
    
    <!-- 移动拖尾特效层 - 方形残影 -->
    <div v-if="moveEffect" class="move-trail-overlay">
      <div 
        v-for="(trail, idx) in moveTrails" 
        :key="idx"
        class="move-trail"
        :class="[`trail-${idx}`, moveEffect.playerIndex === 0 ? 'player1-trail' : 'player2-trail']"
        :style="getTrailStyle(trail)"
      ></div>
    </div>
    
    <!-- 护盾特效层 -->
    <template v-for="playerIdx in [0, 1]" :key="'shield-' + playerIdx">
      <div 
        v-if="defenseStatus[playerIdx]" 
        class="shield-overlay"
        :class="{ 'breaking': defenseBreaking === playerIdx }"
        :style="getShieldStyle(playerIdx)"
      >
        <!-- 金色盾牌主体 -->
        <div class="shield-shape">
          <div class="shield-inner"></div>
          <div class="shield-sun-pattern"></div>
          <div class="shield-highlight"></div>
        </div>
        
        <!-- 半透明玻璃层 -->
        <div class="shield-glass"></div>
        
        <!-- 能量波纹 -->
        <div class="shield-ripple"></div>
        <div class="shield-ripple ripple-2"></div>
        
        <!-- 破碎粒子效果 - 简化版 -->
        <div v-if="defenseBreaking === playerIdx" class="shield-break-particles">
          <!-- 少量金色粒子 -->
          <span v-for="i in 12" :key="'particle-' + i" class="gold-particle" :class="`particle-${i}`"></span>
          <!-- 闪光环 -->
          <div class="flash-ring"></div>
          <div class="flash-ring ring-2"></div>
        </div>
      </div>
    </template>
    
<!-- 全局迷雾遮罩层 - 覆盖在所有特效之上 -->
    <div class="global-fog-container" :style="{ ...getGlobalFogStyle(), ...fogClearMaskStyle }">
<!-- SVG 噪音滤镜定义 - 统一风格，差异化颗粒 -->
      <svg class="fog-noise-svg">
        <!-- 大颗粒噪音 - 慢速层 -->
        <filter id="fog-noise-large">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="1" result="noise"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncG type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncB type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncA type="linear" slope="0.6" intercept="0"/>
          </feComponentTransfer>
        </filter>
        
        <!-- 中颗粒噪音 - 中速层 -->
        <filter id="fog-noise-medium">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="5" result="noise"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncG type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncB type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncA type="linear" slope="0.5" intercept="0"/>
          </feComponentTransfer>
        </filter>
        
        <!-- 小颗粒噪音 - 较快层 -->
        <filter id="fog-noise-small">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="9" result="noise"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncR type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncG type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncB type="linear" slope="1.5" intercept="-0.1"/>
            <feFuncA type="linear" slope="0.4" intercept="0"/>
          </feComponentTransfer>
        </filter>
      </svg>
<!-- 深灰色底层 - 兜底遮挡，确保无孔洞 -->
      <div class="global-fog-base"></div>
      <!-- 大颗粒噪音层 - 慢速漂移 -->
      <div class="fog-noise-layer fog-layer-large"></div>
      <!-- 中颗粒噪音层 - 中速漂移 -->
      <div class="fog-noise-layer fog-layer-medium"></div>
      <!-- 小颗粒噪音层 - 快速漂移 -->
      <div class="fog-noise-layer fog-layer-small"></div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue'

export default {
  name: 'GameBoard',
  props: {
    map: {
      type: Object,
      required: true
    },
    players: {
      type: Array,
      default: () => []
    },
    isPlayer1: {
      type: Boolean,
      default: true
    },
    theme: {
      type: Object,
      default: null
    }
  },
  setup(props) {
    const attackEffect = ref(null)
    const showExplosion = ref(false)
    const moveEffect = ref(null)
    const defenseStatus = ref({ 0: false, 1: false })
    const defenseBreaking = ref(null)
    const scoutEffects = ref([])  // 探查效果数组
    
    // 移动拖尾位置计算
    const moveTrails = computed(() => {
      if (!moveEffect.value) return []
      const trails = []
      const { from, to, direction } = moveEffect.value
      
      for (let i = 0; i < 4; i++) {
        const progress = (i + 1) / 5
        trails.push({
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
          opacity: 1 - (i * 0.2)
        })
      }
      return trails
    })
    
    // 获取拖尾样式
    const getTrailStyle = (trail) => {
      const cellSize = 42
      const padding = 16
      return {
        left: `${trail.x * cellSize + padding + 20}px`,
        top: `${trail.y * cellSize + padding + 20}px`,
        opacity: trail.opacity
      }
    }
    
    // 获取攻击特效位置
    const getAttackEffectStyle = () => {
      if (!attackEffect.value) return {}
      const { from } = attackEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${from.x * cellSize + padding}px`,
        top: `${from.y * cellSize + padding}px`
      }
    }
    
    // 获取爆炸位置
    const getExplosionStyle = () => {
      if (!attackEffect.value) return {}
      const { from, direction, range } = attackEffect.value
      const offset = direction === 'up' ? {x: 0, y: -range} :
                    direction === 'down' ? {x: 0, y: range} :
                    direction === 'left' ? {x: -range, y: 0} :
                    {x: range, y: 0}
      const cellSize = 42
      return {
        '--explosion-x': `${offset.x * cellSize + 20}px`,
        '--explosion-y': `${offset.y * cellSize + 20}px`
      }
    }
    
    // 获取护盾位置样式
    const getShieldStyle = (playerIdx) => {
      const player = props.players[playerIdx]
      if (!player?.position) return {}
      
      const cellSize = 42
      const padding = 18  // 1rem(16px) + grid padding(2px) = 18px
      return {
        left: `${player.position.x * cellSize + padding}px`,
        top: `${player.position.y * cellSize + padding}px`
      }
    }
    
    // 设置攻击特效
    const setAttackEffect = (effect) => {
      attackEffect.value = effect
      showExplosion.value = false
      
      // 延迟显示爆炸效果（等长枪刺到目标）
      setTimeout(() => {
        showExplosion.value = true
      }, 300)
      
      // 清除特效
      setTimeout(() => {
        attackEffect.value = null
        showExplosion.value = false
      }, 800)
    }
    
    // 设置移动特效
    const setMoveEffect = (effect) => {
      moveEffect.value = effect
      setTimeout(() => {
        moveEffect.value = null
      }, 600)
    }
    
    // 设置防御激活
    const setDefenseActivated = (data) => {
      defenseStatus.value[data.playerIndex] = true
      defenseBreaking.value = null
    }
    
    // 设置防御破碎
    const setDefenseBroken = (data) => {
      defenseBreaking.value = data.playerIndex
      setTimeout(() => {
        defenseStatus.value[data.playerIndex] = false
        defenseBreaking.value = null
      }, 1000)
    }
    
    // 清除所有防御状态 - 触发破碎效果
    const clearDefense = () => {
      // 对每个有护盾的玩家触发破碎效果
      if (defenseStatus.value[0]) {
        defenseBreaking.value = 0
        setTimeout(() => {
          defenseStatus.value[0] = false
          if (defenseBreaking.value === 0) {
            defenseBreaking.value = null
          }
        }, 800)
      }
      if (defenseStatus.value[1]) {
        defenseBreaking.value = 1
        setTimeout(() => {
          defenseStatus.value[1] = false
          if (defenseBreaking.value === 1) {
            defenseBreaking.value = null
          }
        }, 800)
      }
    }
    
    // 设置探查效果
    const setScoutEffect = (data) => {
      scoutEffects.value.push({
        type: data.scoutType,
        position: data.position,
        playerIndex: data.playerIndex
      })
    }
    
    // 清除探查效果
    const clearScoutEffect = () => {
      scoutEffects.value = []
    }
    
    const cells = computed(() => {
      const result = []
      const width = props.map.width || props.map.size
      const height = props.map.height || props.map.size
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const isObstacle = props.map.obstacles?.some(o => o.x === x && o.y === y)
          const hasPlayer1 = props.players[0]?.position?.x === x && props.players[0]?.position?.y === y
          const hasPlayer2 = props.players[1]?.position?.x === x && props.players[1]?.position?.y === y
          
          // 检查传送门进口
          const portalEntry = props.map.portals?.find(p => p.entry.x === x && p.entry.y === y)
          // 检查传送门出口
          const portalExit = props.map.portals?.find(p => p.exit.x === x && p.exit.y === y)
          
          let inAttackPath = false
          let isAttackTarget = false
          if (attackEffect.value) {
            const from = attackEffect.value.from
            const range = attackEffect.value.range
            const offset = attackEffect.value.direction === 'up' ? {x: 0, y: -1} :
                          attackEffect.value.direction === 'down' ? {x: 0, y: 1} :
                          attackEffect.value.direction === 'left' ? {x: -1, y: 0} :
                          {x: 1, y: 0}
            
            for (let i = 0; i <= range; i++) {
              const pathX = from.x + offset.x * i
              const pathY = from.y + offset.y * i
              if (pathX === x && pathY === y) {
                inAttackPath = true
                if (i === range) {
                  isAttackTarget = true
                }
                break
              }
            }
          }
          
          result.push({
            x,
            y,
            isObstacle,
            hasPlayer1,
            hasPlayer2,
            isHighlighted: false,
            inAttackPath,
            isAttackTarget,
            portalEntry: portalEntry?.color || null,
            portalExit: portalExit?.color || null
          })
        }
      }
      return result
    })
    
    // 获取当前玩家位置
    const myPosition = computed(() => {
      const myPlayerIndex = props.isPlayer1 ? 0 : 1
      return props.players[myPlayerIndex]?.position
    })
    
    // 全局迷雾容器样式
    const getGlobalFogStyle = () => {
      const width = props.map.width || props.map.size
      const height = props.map.height || props.map.size
      const cellSize = 42 // 40px格子 + 2px间距
      const padding = 16 // 1rem padding
      
      return {
        width: `${width * cellSize}px`,
        height: `${height * cellSize}px`,
        left: `${padding}px`,
        top: `${padding}px`
      }
    }
    
    // 清晰区域遮罩样式 - 使用径向渐变实现迷雾
    // mask-image: transparent = 迷雾层透明（能看到下面），black = 迷雾层可见（遮挡下面）
    const fogClearMaskStyle = computed(() => {
      // 如果没有玩家位置，返回完全透明的遮罩（不遮挡地图）
      if (!myPosition.value) {
        return {
          maskImage: 'linear-gradient(transparent, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, transparent)'
        }
      }
      
      const cellSize = 42
      const mapWidth = props.map.width || props.map.size
      const mapHeight = props.map.height || props.map.size
      
      // 玩家位置转换为像素坐标（格子中心）
      const centerX = myPosition.value.x * cellSize + cellSize / 2
      const centerY = myPosition.value.y * cellSize + cellSize / 2
      
      // 基础可视范围：距离≤1格清晰，距离≥2格完全迷雾
      let clearRadius = 1 * cellSize  // 42px 内完全清晰
      let fogRadius = 2 * cellSize    // 84px 外完全迷雾
      
      // 环绕探查：扩大可视范围到1.5倍
      if (scoutEffects.value.some(e => e.type === 'around')) {
        clearRadius = 1.5 * cellSize  // 63px 内完全清晰
        fogRadius = 2.5 * cellSize    // 105px 外完全迷雾
      }
      
      // 收集所有遮罩层
      let masks = []
      
      // 1. 基础径向渐变（周围一圈可见）
      masks.push(`radial-gradient(circle at ${centerX}px ${centerY}px, 
        transparent 0%, 
        transparent ${clearRadius}px, 
        black ${fogRadius}px)`)
      
      // 2. 行探查：在整行每个格子添加光圈照亮效果（支持叠加）
      if (scoutEffects.value.some(e => e.type === 'row')) {
        const rowY = myPosition.value.y
        for (let x = 0; x < mapWidth; x++) {
          const cellCenterX = x * cellSize + cellSize / 2
          const cellCenterY = rowY * cellSize + cellSize / 2
          // 每个格子一个小光圈
          masks.push(`radial-gradient(circle at ${cellCenterX}px ${cellCenterY}px, 
            transparent 0%, 
            transparent ${cellSize * 0.6}px, 
            black ${cellSize}px)`)
        }
      }
      
      // 3. 列探查：在整列每个格子添加光圈照亮效果（支持叠加）
      if (scoutEffects.value.some(e => e.type === 'col')) {
        const colX = myPosition.value.x
        for (let y = 0; y < mapHeight; y++) {
          const cellCenterX = colX * cellSize + cellSize / 2
          const cellCenterY = y * cellSize + cellSize / 2
          // 每个格子一个小光圈
          masks.push(`radial-gradient(circle at ${cellCenterX}px ${cellCenterY}px, 
            transparent 0%, 
            transparent ${cellSize * 0.6}px, 
            black ${cellSize}px)`)
        }
      }
      
      return {
        maskImage: masks.join(', '),
        WebkitMaskImage: masks.join(', '),
        // 使用 intersect 让多个遮罩透明区域合并（乘法组合）
        // 透明(0) × 黑色(1) = 透明(0)，这样基础光圈和探查光圈会正确叠加
        maskComposite: masks.length > 1 ? 'intersect' : 'add',
        WebkitMaskComposite: masks.length > 1 ? 'source-in' : 'source-over'
      }
    })
    
    // 动态雾气粒子样式
    const getParticleStyle = (index) => {
      const width = (props.map.width || props.map.size) * 42
      const height = (props.map.height || props.map.size) * 42
      
      // 随机位置和动画延迟
      const seed = index * 137.5 // 伪随机种子
      const x = (Math.sin(seed) * 0.5 + 0.5) * width
      const y = (Math.cos(seed * 1.3) * 0.5 + 0.5) * height
      const size = 15 + (index % 5) * 8
      const delay = (index * 0.4) % 8
      const duration = 6 + (index % 3) * 2
      
      return {
        left: `${x}px`,
        top: `${y}px`,
        width: `${size}px`,
        height: `${size * 0.7}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`
      }
    }
    
    // 主题相关计算属性
    const themeClass = computed(() => {
      if (!props.theme) return ''
      return `theme-${props.theme.id}`
    })
    
    const themeStyle = computed(() => {
      if (!props.theme) return {}
      return {
        '--theme-primary': props.theme.primaryColor,
        '--theme-secondary': props.theme.secondaryColor,
        '--theme-accent': props.theme.accentColor,
        '--theme-bg': props.theme.bgColor,
        '--theme-obstacle': props.theme.obstacleColor
      }
    })
    
    // 获取障碍物类型样式类
    const getObstacleClass = (cell) => {
      if (!props.theme || !cell.isObstacle) return ''
      const obstacle = props.map.obstacles?.find(o => o.x === cell.x && o.y === cell.y)
      return obstacle?.type ? `obstacle-${obstacle.type}` : ''
    }
    
    // 获取障碍物形状
    const getObstacleShape = (cell) => {
      if (!props.theme || !cell.isObstacle) return 'shape-x'
      const obstacle = props.map.obstacles?.find(o => o.x === cell.x && o.y === cell.y)
      if (!obstacle?.type) return 'shape-x'
      
      // 根据障碍物类型返回不同形状
      const shapes = {
        'rock': 'shape-rock',
        'tree': 'shape-tree',
        'water': 'shape-water',
        'wall': 'shape-wall',
        'ice': 'shape-ice',
        'lava': 'shape-lava',
        'sand': 'shape-sand',
        'mushroom': 'shape-mushroom',
        'crystal': 'shape-crystal',
        'bone': 'shape-bone',
        'snow': 'shape-snow',
        'cactus': 'shape-cactus',
        // 添加更多障碍物类型
        'dune': 'shape-sand',
        'ice-crystal': 'shape-ice',
        'snow-pile': 'shape-snow',
        'burning-rock': 'shape-lava',
        'pillar': 'shape-wall',
        'rubble': 'shape-rock'
      }
      return shapes[obstacle.type] || 'shape-x'
    }
    
    return {
      cells,
      attackEffect,
      showExplosion,
      moveEffect,
      moveTrails,
      defenseStatus,
      defenseBreaking,
      scoutEffects,
      setAttackEffect,
      setMoveEffect,
      setDefenseActivated,
      setDefenseBroken,
      clearDefense,
      setScoutEffect,
      clearScoutEffect,
      getTrailStyle,
      getShieldStyle,
      getAttackEffectStyle,
      getExplosionStyle,
      // 全局迷雾相关
      myPosition,
      getGlobalFogStyle,
      fogClearMaskStyle,
      getParticleStyle,
      // 主题相关
      themeClass,
      themeStyle,
      getObstacleClass,
      getObstacleShape
    }
  }
}
</script>

<style scoped>
.game-board {
  background: white;
  padding: 1rem;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
  position: relative;
}

.grid {
  display: grid;
  gap: 2px;
  background: #dee2e6;
  padding: 2px;
  border-radius: 8px;
}

.cell {
  width: 40px;
  height: 40px;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  position: relative;
  border-radius: 4px;
  transition: all 0.2s;
}

.cell:hover {
  background: #e9ecef;
}

.cell.obstacle {
  background: #343a40;
}

.cell.player1 {
  background: #4dabf7;
}

.cell.player2 {
  background: #ff6b6b;
}

.cell.highlight {
  background: #ffe066;
  animation: highlight-pulse 1s infinite;
}

.obstacle-mark {
  color: white;
  font-weight: bold;
}

.player-mark {
  color: white;
  font-weight: bold;
  font-size: 1rem;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  position: relative;
  z-index: 5;
}

.player1-mark {
  background: #1971c2;
}

.player2-mark {
  background: #c92a2a;
}

@keyframes highlight-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.cell.attack-path {
  background: rgba(255, 100, 100, 0.3);
}

.cell.attack-hit {
  background: rgba(255, 0, 0, 0.5);
  animation: attack-hit-anim 0.3s ease-out;
}

.cell.attack-miss {
  background: rgba(150, 150, 150, 0.4);
  animation: attack-miss-anim 0.3s ease-out;
}

@keyframes attack-hit-anim {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); background: rgba(255, 0, 0, 0.8); }
  100% { transform: scale(1); }
}

@keyframes attack-miss-anim {
  0% { transform: scale(1); }
  50% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

.player-mark.attacked {
  animation: shake 0.3s ease-out;
  background: #c92a2a !important;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* ========== 能量闪光攻击特效 ========== */
.attack-effect-layer {
  position: absolute;
  width: 40px;
  height: 40px;
  pointer-events: none;
  z-index: 25;
}

/* 能量闪光线条 - 基础样式 */
.energy-beam {
  position: absolute;
  height: 4px;
  border-radius: 2px;
  box-shadow: 
    0 0 10px rgba(255, 200, 100, 0.8),
    0 0 20px rgba(255, 150, 50, 0.5);
}

/* 向右攻击 - 从格子中心向右延伸 */
.energy-beam.right {
  left: 50%;
  top: 50%;
  transform-origin: left center;
  transform: translateY(-50%);
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 200, 100, 0.8) 30%,
    rgba(255, 150, 50, 0.6) 60%,
    transparent 100%
  );
}

.energy-beam.right.range-1 {
  width: 40px;
  animation: beam-right 0.4s ease-out forwards;
}

.energy-beam.right.range-2 {
  width: 84px;
  animation: beam-right-long 0.5s ease-out forwards;
}

@keyframes beam-right {
  0% { transform: translateY(-50%) scaleX(0); opacity: 0; }
  20% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  50% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  100% { transform: translateY(-50%) scaleX(1); opacity: 0; }
}

@keyframes beam-right-long {
  0% { transform: translateY(-50%) scaleX(0); opacity: 0; }
  15% { transform: translateY(-50%) scaleX(0.5); opacity: 1; }
  35% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  60% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  100% { transform: translateY(-50%) scaleX(1); opacity: 0; }
}

/* 向左攻击 - 从格子中心向左延伸 */
.energy-beam.left {
  right: 50%;
  top: 50%;
  transform-origin: right center;
  transform: translateY(-50%);
  background: linear-gradient(270deg, 
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 200, 100, 0.8) 30%,
    rgba(255, 150, 50, 0.6) 60%,
    transparent 100%
  );
}

.energy-beam.left.range-1 {
  width: 40px;
  animation: beam-left 0.4s ease-out forwards;
}

.energy-beam.left.range-2 {
  width: 84px;
  animation: beam-left-long 0.5s ease-out forwards;
}

@keyframes beam-left {
  0% { transform: translateY(-50%) scaleX(0); opacity: 0; }
  20% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  50% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  100% { transform: translateY(-50%) scaleX(1); opacity: 0; }
}

@keyframes beam-left-long {
  0% { transform: translateY(-50%) scaleX(0); opacity: 0; }
  15% { transform: translateY(-50%) scaleX(0.5); opacity: 1; }
  35% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  60% { transform: translateY(-50%) scaleX(1); opacity: 1; }
  100% { transform: translateY(-50%) scaleX(1); opacity: 0; }
}

/* 向上攻击 - 从格子中心向上延伸（垂直光线） */
.energy-beam.up {
  left: 50%;
  bottom: 50%;
  width: 4px;
  transform-origin: center bottom;
  transform: translateX(-50%);
  background: linear-gradient(0deg, 
    transparent 0%,
    rgba(255, 150, 50, 0.6) 40%,
    rgba(255, 200, 100, 0.8) 70%,
    rgba(255, 255, 255, 0.9) 100%
  );
}

.energy-beam.up.range-1 {
  height: 40px;
  animation: beam-up 0.4s ease-out forwards;
}

.energy-beam.up.range-2 {
  height: 84px;
  animation: beam-up-long 0.5s ease-out forwards;
}

@keyframes beam-up {
  0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  20% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  50% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  100% { transform: translateX(-50%) scaleY(1); opacity: 0; }
}

@keyframes beam-up-long {
  0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  15% { transform: translateX(-50%) scaleY(0.5); opacity: 1; }
  35% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  60% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  100% { transform: translateX(-50%) scaleY(1); opacity: 0; }
}

/* 向下攻击 - 从格子中心向下延伸（垂直光线） */
.energy-beam.down {
  left: 50%;
  top: 50%;
  width: 4px;
  transform-origin: center top;
  transform: translateX(-50%);
  background: linear-gradient(180deg, 
    transparent 0%,
    rgba(255, 150, 50, 0.6) 40%,
    rgba(255, 200, 100, 0.8) 70%,
    rgba(255, 255, 255, 0.9) 100%
  );
}

.energy-beam.down.range-1 {
  height: 40px;
  animation: beam-down 0.4s ease-out forwards;
}

.energy-beam.down.range-2 {
  height: 84px;
  animation: beam-down-long 0.5s ease-out forwards;
}

@keyframes beam-down {
  0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  20% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  50% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  100% { transform: translateX(-50%) scaleY(1); opacity: 0; }
}

@keyframes beam-down-long {
  0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
  15% { transform: translateX(-50%) scaleY(0.5); opacity: 1; }
  35% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  60% { transform: translateX(-50%) scaleY(1); opacity: 1; }
  100% { transform: translateX(-50%) scaleY(1); opacity: 0; }
}

/* ========== 闪光扩散特效 ========== */
.explosion-flash {
  position: absolute;
  left: var(--explosion-x, 20px);
  top: var(--explosion-y, 20px);
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  z-index: 30;
  border-radius: 4px;
  background: radial-gradient(circle, 
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 200, 100, 0.7) 30%,
    rgba(255, 150, 50, 0.4) 60%,
    transparent 100%
  );
  animation: flash-expand 0.4s ease-out forwards;
}

@keyframes flash-expand {
  0% {
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

/* ========== 移动拖尾特效（方形残影） ========== */
.move-trail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 15;
}

.move-trail {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  transform: translate(-50%, -50%);
  animation: trail-fade 0.6s ease-out forwards;
}

/* 玩家1残影 - 蓝色 */
.move-trail.player1-trail {
  background: rgba(25, 113, 194, 0.5);
  box-shadow: 0 0 8px rgba(74, 171, 247, 0.4);
}

/* 玩家2残影 - 红色 */
.move-trail.player2-trail {
  background: rgba(201, 42, 42, 0.5);
  box-shadow: 0 0 8px rgba(255, 107, 107, 0.4);
}

.move-trail.trail-0 { animation-delay: 0s; }
.move-trail.trail-1 { animation-delay: 0.05s; }
.move-trail.trail-2 { animation-delay: 0.1s; }
.move-trail.trail-3 { animation-delay: 0.15s; }

@keyframes trail-fade {
  0% { 
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% { 
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 0;
  }
}

/* ========== 金色护盾特效 ========== */
.shield-overlay {
  position: absolute;
  width: 40px;
  height: 40px;
  pointer-events: none;
  z-index: 20;
}

/* 金色盾牌主体 - 更大更透明 */
.shield-shape {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 48px;
  height: 56px;
  transform: translate(-50%, -50%);
  
  /* 盾牌形状 - 上方尖角，下方圆弧 */
  clip-path: polygon(
    50% 0%,
    100% 8%,
    100% 55%,
    85% 100%,
    50% 100%,
    15% 100%,
    0% 55%,
    0% 8%
  );
  
  /* 金色渐变 - 金属质感，更透明 */
  background: linear-gradient(180deg, 
    rgba(255, 215, 0, 0.5) 0%,
    rgba(255, 193, 37, 0.45) 15%,
    rgba(255, 184, 12, 0.4) 30%,
    rgba(255, 165, 0, 0.35) 50%,
    rgba(255, 140, 0, 0.4) 70%,
    rgba(255, 127, 0, 0.45) 85%,
    rgba(255, 102, 0, 0.5) 100%
  );
  
  border: 2px solid rgba(255, 248, 220, 0.6);
  box-shadow: 
    0 0 20px rgba(255, 215, 0, 0.5),
    0 0 40px rgba(255, 165, 0, 0.3),
    0 0 60px rgba(255, 140, 0, 0.2),
    inset 0 0 15px rgba(255, 255, 255, 0.2);
  
  animation: shield-breathe 2.5s ease-in-out infinite;
}

/* 盾牌内部装饰 */
.shield-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 24px;
  height: 28px;
  transform: translate(-50%, -50%);
  
  clip-path: polygon(
    50% 5%,
    90% 12%,
    90% 50%,
    78% 88%,
    50% 95%,
    22% 88%,
    10% 50%,
    10% 12%
  );
  
  background: linear-gradient(180deg, 
    rgba(255, 255, 255, 0.25) 0%,
    rgba(255, 248, 220, 0.15) 50%,
    rgba(255, 215, 0, 0.1) 100%
  );
}

/* 太阳纹装饰 */
.shield-sun-pattern {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, 
    rgba(255, 255, 255, 0.5) 0%,
    rgba(255, 215, 0, 0.3) 40%,
    transparent 70%
  );
  border-radius: 50%;
}

.shield-sun-pattern::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: translate(-50%, -50%);
}

.shield-sun-pattern::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 20px;
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: translate(-50%, -50%);
}

/* 高光效果 */
.shield-highlight {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 10px;
  height: 8px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  filter: blur(3px);
}

/* 半透明玻璃层 - 蒙上去的感觉 */
.shield-glass {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36px;
  height: 42px;
  transform: translate(-50%, -50%);
  
  clip-path: polygon(
    50% 0%,
    100% 8%,
    100% 55%,
    85% 100%,
    50% 100%,
    15% 100%,
    0% 55%,
    0% 8%
  );
  
  background: linear-gradient(135deg, 
    rgba(255, 255, 255, 0.3) 0%,
    rgba(255, 255, 255, 0.1) 30%,
    transparent 50%,
    rgba(255, 255, 255, 0.05) 70%,
    rgba(255, 255, 255, 0.15) 100%
  );
  
  opacity: 0.7;
}

/* 能量波纹 */
.shield-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple-expand 2s ease-out infinite;
}

.shield-ripple.ripple-2 {
  animation-delay: 1s;
}

@keyframes ripple-expand {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.5);
    opacity: 0;
  }
}

@keyframes shield-breathe {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    filter: brightness(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.03);
    filter: brightness(1.15);
  }
}

/* 盾牌破碎效果 */
.shield-overlay.breaking .shield-shape {
  animation: shield-shatter 0.8s ease-out forwards;
}

.shield-overlay.breaking .shield-glass {
  animation: glass-shatter 0.6s ease-out forwards;
}

@keyframes shield-shatter {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
    filter: brightness(1);
  }
  20% {
    transform: translate(-50%, -50%) scale(1.1);
    filter: brightness(2);
  }
  100% {
    transform: translate(-50%, -50%) scale(1.3);
    opacity: 0;
    filter: brightness(0.5);
  }
}

@keyframes glass-shatter {
  0% { opacity: 0.7; }
  100% { opacity: 0; }
}

/* 破碎粒子容器 */
.shield-break-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  z-index: 25;
}

/* 小金色粒子 - 简化版（12个） */
.gold-particle {
  position: absolute;
  width: 2px;
  height: 2px;
  background: #FFD700;
  border-radius: 50%;
  box-shadow: 0 0 3px #FFD700, 0 0 6px #FFA500;
  animation: particle-scatter 0.6s ease-out forwards;
}

.particle-1 { --angle: 0deg; --dist: 45px; animation-delay: 0s; }
.particle-2 { --angle: 30deg; --dist: 38px; animation-delay: 0.02s; }
.particle-3 { --angle: 60deg; --dist: 52px; animation-delay: 0.04s; }
.particle-4 { --angle: 90deg; --dist: 42px; animation-delay: 0.06s; }
.particle-5 { --angle: 120deg; --dist: 48px; animation-delay: 0.08s; }
.particle-6 { --angle: 150deg; --dist: 35px; animation-delay: 0.1s; }
.particle-7 { --angle: 180deg; --dist: 55px; animation-delay: 0.12s; }
.particle-8 { --angle: 210deg; --dist: 40px; animation-delay: 0.14s; }
.particle-9 { --angle: 240deg; --dist: 50px; animation-delay: 0.16s; }
.particle-10 { --angle: 270deg; --dist: 44px; animation-delay: 0.18s; }
.particle-11 { --angle: 300deg; --dist: 58px; animation-delay: 0.2s; }
.particle-12 { --angle: 330deg; --dist: 36px; animation-delay: 0.22s; }

@keyframes particle-scatter {
  0% {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
  }
  80% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist));
  }
}

/* 闪光环 */
.flash-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border: 3px solid #FFD700;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 
    0 0 10px #FFD700,
    0 0 20px #FFA500,
    inset 0 0 10px rgba(255, 215, 0, 0.5);
  animation: ring-flash 0.5s ease-out forwards;
}

.flash-ring.ring-2 {
  animation-delay: 0.1s;
  border-color: #FFA500;
}

@keyframes ring-flash {
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    transform: translate(-50%, -50%) scale(3);
    opacity: 0;
  }
}

/* ========== 迷雾效果系统 ========== */

/* 迷雾层容器 - z-index高于所有特效层，遮挡迷雾区域的特效 */
.fog-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
  border-radius: 4px;
}

/* 迷雾云朵容器 */
.fog-clouds {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 迷雾粒子 - 动态飘动的雾气 */
.fog-particle {
  position: absolute;
  border-radius: 50%;
  filter: blur(3px);
  animation: fog-float 4s ease-in-out infinite;
}

.fog-particle:nth-child(1) {
  width: 20px;
  height: 15px;
  top: -5px;
  left: -5px;
  animation-delay: 0s;
}

.fog-particle:nth-child(2) {
  width: 25px;
  height: 18px;
  top: 10px;
  left: 15px;
  animation-delay: -1.3s;
}

.fog-particle:nth-child(3) {
  width: 18px;
  height: 20px;
  top: 20px;
  left: -3px;
  animation-delay: -2.6s;
}

@keyframes fog-float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.6;
  }
  25% {
    transform: translate(3px, -2px) scale(1.1);
    opacity: 0.8;
  }
  50% {
    transform: translate(-2px, 2px) scale(0.95);
    opacity: 0.5;
  }
  75% {
    transform: translate(2px, 1px) scale(1.05);
    opacity: 0.7;
  }
}

/* ===== 轻微迷雾 (距离=2) ===== */
.fog-level-1 {
  background: linear-gradient(135deg, 
    rgba(180, 190, 200, 0.25) 0%,
    rgba(160, 175, 185, 0.35) 50%,
    rgba(140, 155, 170, 0.3) 100%
  );
  backdrop-filter: blur(1px);
}

.fog-level-1 .fog-particle {
  background: radial-gradient(ellipse, 
    rgba(200, 210, 220, 0.4) 0%,
    rgba(180, 195, 205, 0.2) 50%,
    transparent 70%
  );
}

.fog-level-1 .fog-clouds {
  animation: fog-drift-slow 8s ease-in-out infinite;
}

/* ===== 中等迷雾 (距离=3) ===== */
.fog-level-2 {
  background: linear-gradient(135deg, 
    rgba(120, 135, 155, 0.5) 0%,
    rgba(100, 120, 140, 0.6) 50%,
    rgba(90, 110, 130, 0.55) 100%
  );
  backdrop-filter: blur(3px);
}

.fog-level-2 .fog-particle {
  background: radial-gradient(ellipse, 
    rgba(140, 160, 180, 0.6) 0%,
    rgba(120, 145, 165, 0.3) 50%,
    transparent 70%
  );
}

.fog-level-2 .fog-clouds {
  animation: fog-drift 6s ease-in-out infinite;
}

/* ===== 重度迷雾 (距离≥4) ===== */
.fog-level-3 {
  background: linear-gradient(135deg, 
    rgba(60, 70, 90, 0.85) 0%,
    rgba(50, 65, 85, 0.9) 50%,
    rgba(45, 60, 80, 0.88) 100%
  );
  backdrop-filter: blur(5px);
  box-shadow: inset 0 0 15px rgba(30, 40, 60, 0.5);
}

.fog-level-3 .fog-particle {
  background: radial-gradient(ellipse, 
    rgba(80, 100, 130, 0.7) 0%,
    rgba(60, 85, 110, 0.4) 50%,
    transparent 70%
  );
}

.fog-level-3 .fog-clouds {
  animation: fog-drift 5s ease-in-out infinite, fog-pulse 3s ease-in-out infinite;
}

/* 迷雾漂移动画 */
@keyframes fog-drift {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  25% {
    transform: translate(2px, -1px) rotate(1deg);
  }
  50% {
    transform: translate(-1px, 2px) rotate(-1deg);
  }
  75% {
    transform: translate(1px, 1px) rotate(0.5deg);
  }
}

@keyframes fog-drift-slow {
  0%, 100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(1px, -1px);
  }
}

/* 迷雾脉动动画 */
@keyframes fog-pulse {
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 1;
  }
}

/* ===== 迷雾状态下的格子样式 ===== */

/* 清晰区域 - 微光效果 */
.cell.fog-clear {
  box-shadow: inset 0 0 8px rgba(100, 200, 255, 0.15);
}

/* 轻微迷雾格子 */
.cell.fog-light {
  filter: brightness(0.95);
}

/* 中等迷雾格子 */
.cell.fog-medium {
  filter: brightness(0.8);
}

.cell.fog-medium .obstacle-mark,
.cell.fog-medium .player-mark {
  opacity: 0.5;
  filter: blur(1px);
}

/* 重度迷雾格子 - 几乎看不见内容 */
.cell.fog-heavy {
  filter: brightness(0.6);
}

.cell.fog-heavy .obstacle-mark,
.cell.fog-heavy .player-mark {
  opacity: 0;
}

/* 迷雾边缘渐变效果 */
.fog-level-1::before,
.fog-level-2::before,
.fog-level-3::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 6px;
  background: radial-gradient(circle at center, 
    transparent 40%,
    rgba(100, 120, 150, 0.2) 100%
  );
  pointer-events: none;
}

/* 额外的迷雾纹理层 - 让迷雾更有层次感 */
.fog-level-2::after,
.fog-level-3::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 200%;
  background: 
    radial-gradient(ellipse at 20% 30%, rgba(255, 255, 255, 0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(255, 255, 255, 0.03) 0%, transparent 40%);
  animation: fog-texture-move 10s linear infinite;
  pointer-events: none;
}

@keyframes fog-texture-move {
  0% {
    transform: translate(0, 0);
  }
  100% {
    transform: translate(-50%, -50%);
  }
}

/* 鼠标悬停在迷雾格子上的效果 */
.cell:hover .fog-layer {
  opacity: 0.85;
}

.cell:hover .fog-level-3 {
  filter: brightness(1.1);
}

/* ========== 全局迷雾遮罩层 ========== */

/* 全局迷雾容器 - 覆盖在整个棋盘上方 */
.global-fog-container {
  position: absolute;
  pointer-events: none;
  z-index: 100;
  border-radius: 8px;
  overflow: hidden;
}

/* 深灰色底层 - 兜底遮挡，确保无孔洞 */
.global-fog-base {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 深灰色，比噪音层略深，视觉区分 */
  background: #4a5568;
  z-index: 0;
}

/* 噪音纹理层基础样式 */
.fog-noise-layer {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: #4a5568;
  z-index: 1;
}

/* 大颗粒噪音层 - 最慢漂移 */
.fog-layer-large {
  filter: url(#fog-noise-large);
  animation: fog-drift-large 40s ease-in-out infinite;
  opacity: 0.9;
}

/* 中颗粒噪音层 - 中速漂移 */
.fog-layer-medium {
  filter: url(#fog-noise-medium);
  animation: fog-drift-medium 30s ease-in-out infinite;
  opacity: 0.85;
}

/* 小颗粒噪音层 - 较快漂移 */
.fog-layer-small {
  filter: url(#fog-noise-small);
  animation: fog-drift-small 20s ease-in-out infinite;
  opacity: 0.7;
}

/* 大颗粒慢速漂移 - 大范围缓慢移动 */
@keyframes fog-drift-large {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(-8%, 5%) scale(1.03);
  }
  50% {
    transform: translate(-12%, -8%) scale(1.05);
  }
  75% {
    transform: translate(5%, -10%) scale(1.02);
  }
}

/* 中颗粒中速漂移 - 不同轨迹 */
@keyframes fog-drift-medium {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg) scale(1);
  }
  25% {
    transform: translate(6%, -4%) rotate(2deg) scale(1.02);
  }
  50% {
    transform: translate(-5%, 8%) rotate(-1deg) scale(1.04);
  }
  75% {
    transform: translate(-8%, -6%) rotate(1deg) scale(1.01);
  }
}

/* 小颗粒快速漂移 - 又一个不同轨迹 */
@keyframes fog-drift-small {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  20% {
    transform: translate(4%, 6%) scale(1.01);
  }
  40% {
    transform: translate(-6%, 3%) scale(1.02);
  }
  60% {
    transform: translate(3%, -5%) scale(1.01);
  }
  80% {
    transform: translate(-3%, -3%) scale(1.02);
  }
}

@keyframes fog-noise-drift {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(-5%, 3%) scale(1.02);
  }
  50% {
    transform: translate(-8%, -5%) scale(1.04);
  }
  75% {
    transform: translate(3%, -8%) scale(1.02);
  }
}

@keyframes fog-base-shift {
  0%, 100% {
    background-position: 0% 0%;
    filter: brightness(1);
  }
  50% {
    background-position: 100% 100%;
    filter: brightness(0.95);
  }
}

/* SVG 噪音滤镜容器 - 隐藏但不影响滤镜生效 */
.fog-noise-svg {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* 高不透明度遮罩层 - 真正遮挡下方内容 */
.global-fog-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 高不透明度灰色，真正遮挡内容 */
  background: rgba(75, 85, 95, 0.92);
  z-index: 2;
}

/* 清晰区域遮罩 - 使用mask-image创建可视区域 */
.fog-clear-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}

/* 迷雾层 - 无额外光晕效果，保持纯灰色 */

/* ========== 主题系统样式 ========== */

/* 主题包装器 */
.game-board-wrapper {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
}

/* 主题背景层 */
.theme-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* 主题粒子 */
.theme-particles {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.theme-particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  opacity: 0.6;
  animation: theme-particle-float 8s ease-in-out infinite;
}

.theme-particle.particle-1 { left: 10%; top: 20%; animation-delay: 0s; }
.theme-particle.particle-2 { left: 25%; top: 60%; animation-delay: -1s; }
.theme-particle.particle-3 { left: 40%; top: 30%; animation-delay: -2s; }
.theme-particle.particle-4 { left: 55%; top: 70%; animation-delay: -3s; }
.theme-particle.particle-5 { left: 70%; top: 40%; animation-delay: -4s; }
.theme-particle.particle-6 { left: 85%; top: 80%; animation-delay: -5s; }
.theme-particle.particle-7 { left: 15%; top: 85%; animation-delay: -6s; }
.theme-particle.particle-8 { left: 30%; top: 15%; animation-delay: -7s; }
.theme-particle.particle-9 { left: 60%; top: 55%; animation-delay: -0.5s; }
.theme-particle.particle-10 { left: 80%; top: 25%; animation-delay: -1.5s; }
.theme-particle.particle-11 { left: 5%; top: 50%; animation-delay: -2.5s; }
.theme-particle.particle-12 { left: 45%; top: 90%; animation-delay: -3.5s; }
.theme-particle.particle-13 { left: 75%; top: 10%; animation-delay: -4.5s; }
.theme-particle.particle-14 { left: 90%; top: 60%; animation-delay: -5.5s; }
.theme-particle.particle-15 { left: 35%; top: 45%; animation-delay: -6.5s; }

@keyframes theme-particle-float {
  0%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-10px) scale(1.2);
    opacity: 0.9;
  }
}

/* 环境光效 */
.theme-ambient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.1) 100%);
}

/* 主题装饰贴图 - 置于最底层，柔和透明 */
.theme-decorations {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
}

.decoration-item {
  position: absolute;
  opacity: 0.12;
  font-size: 2rem;
  filter: blur(0.5px);
}

.deco-1 { left: 5%; top: 10%; transform: rotate(-15deg); }
.deco-2 { left: 85%; top: 15%; transform: rotate(20deg); }
.deco-3 { left: 15%; top: 75%; transform: rotate(10deg); }
.deco-4 { left: 75%; top: 80%; transform: rotate(-25deg); }
.deco-5 { left: 45%; top: 5%; transform: rotate(5deg); }
.deco-6 { left: 50%; top: 90%; transform: rotate(-10deg); }

/* 森林主题装饰 - 树叶和蘑菇 */
.theme-forest .decoration-item::before { content: '🌿'; }
.theme-forest .deco-3::before { content: '🍂'; }
.theme-forest .deco-5::before { content: '🍄'; }

/* 沙漠主题装饰 - 沙子和太阳 */
.theme-desert .decoration-item::before { content: '☀️'; font-size: 2.5rem; }
.theme-desert .deco-2::before { content: '🐪'; }
.theme-desert .deco-4::before { content: '🏜️'; }

/* 冰雪主题装饰 - 雪花和冰晶 */
.theme-ice .decoration-item::before { content: '❄️'; }
.theme-ice .deco-2::before { content: '⛄'; }
.theme-ice .deco-5::before { content: '🌨️'; }

/* 火山主题装饰 - 火焰和岩浆 */
.theme-volcano .decoration-item::before { content: '🔥'; }
.theme-volcano .deco-3::before { content: '🌋'; }
.theme-volcano .deco-5::before { content: '💨'; }

/* 古城主题装饰 - 石块和骨头 */
.theme-ruins .decoration-item::before { content: '🪨'; }
.theme-ruins .deco-2::before { content: '🏛️'; }
.theme-ruins .deco-4::before { content: '🦴'; }
.theme-ruins .deco-6::before { content: '📜'; }

/* ========== 森林主题 ========== */
.theme-forest .game-board {
  background: linear-gradient(145deg, #e8f5e9 0%, #c8e6c9 100%);
  border: 3px solid #4caf50;
}

.theme-forest .grid {
  background: #a5d6a7;
}

.theme-forest .cell {
  background: #f1f8e9;
}

.theme-forest .cell:hover {
  background: #dcedc8;
}

.theme-forest .cell.obstacle {
  background: #2e7d32;
}

.theme-forest .theme-particle {
  background: #81c784;
  box-shadow: 0 0 6px #4caf50;
}

.theme-forest .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(139, 195, 74, 0.1) 0%, rgba(46, 125, 50, 0.15) 100%);
}

/* 森林主题障碍物形状 */
.theme-forest .obstacle-shape.shape-tree::before {
  content: '🌲';
  font-size: 1.5rem;
}

.theme-forest .obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

/* ========== 沙漠主题 ========== */
.theme-desert .game-board {
  background: linear-gradient(145deg, #fff8e1 0%, #ffecb3 100%);
  border: 3px solid #ff9800;
}

.theme-desert .grid {
  background: #ffe082;
}

.theme-desert .cell {
  background: #fffde7;
}

.theme-desert .cell:hover {
  background: #fff9c4;
}

.theme-desert .cell.obstacle {
  background: #e65100;
}

.theme-desert .theme-particle {
  background: #ffb74d;
  box-shadow: 0 0 6px #ff9800;
}

.theme-desert .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(255, 152, 0, 0.1) 0%, rgba(230, 81, 0, 0.15) 100%);
}

/* 沙漠主题障碍物形状 */
.theme-desert .obstacle-shape.shape-sand::before {
  content: '🏜️';
  font-size: 1.5rem;
}

.theme-desert .obstacle-shape.shape-cactus::before {
  content: '🌵';
  font-size: 1.5rem;
}

.theme-desert .obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

/* ========== 冰雪主题 ========== */
.theme-ice .game-board {
  background: linear-gradient(145deg, #e3f2fd 0%, #bbdefb 100%);
  border: 3px solid #2196f3;
}

.theme-ice .grid {
  background: #90caf9;
}

.theme-ice .cell {
  background: #e1f5fe;
}

.theme-ice .cell:hover {
  background: #b3e5fc;
}

.theme-ice .cell.obstacle {
  background: #0d47a1;
}

.theme-ice .theme-particle {
  background: #64b5f6;
  box-shadow: 0 0 8px #2196f3;
}

.theme-ice .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(33, 150, 243, 0.1) 0%, rgba(13, 71, 161, 0.15) 100%);
}

/* 冰雪主题障碍物形状 */
.theme-ice .obstacle-shape.shape-ice::before {
  content: '🧊';
  font-size: 1.5rem;
}

.theme-ice .obstacle-shape.shape-snow::before {
  content: '❄️';
  font-size: 1.3rem;
}

/* ========== 火山主题 ========== */
.theme-volcano .game-board {
  background: linear-gradient(145deg, #ffebee 0%, #ffcdd2 100%);
  border: 3px solid #f44336;
}

.theme-volcano .grid {
  background: #ef9a9a;
}

.theme-volcano .cell {
  background: #fff5f5;
}

.theme-volcano .cell:hover {
  background: #ffcdd2;
}

.theme-volcano .cell.obstacle {
  background: #b71c1c;
}

.theme-volcano .theme-particle {
  background: #ff8a65;
  box-shadow: 0 0 8px #f44336;
  animation: theme-particle-float 6s ease-in-out infinite;
}

.theme-volcano .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(244, 67, 54, 0.1) 0%, rgba(183, 28, 28, 0.2) 100%);
}

/* 火山主题障碍物形状 */
.theme-volcano .obstacle-shape.shape-lava::before {
  content: '🔥';
  font-size: 1.5rem;
}

.theme-volcano .obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

/* ========== 海洋主题 ========== */
.theme-ocean .game-board {
  background: linear-gradient(145deg, #e0f7fa 0%, #b2ebf2 100%);
  border: 3px solid #00bcd4;
}

.theme-ocean .grid {
  background: #80deea;
}

.theme-ocean .cell {
  background: #e0f7fa;
}

.theme-ocean .cell:hover {
  background: #b2ebf2;
}

.theme-ocean .cell.obstacle {
  background: #006064;
}

.theme-ocean .theme-particle {
  background: #4dd0e1;
  box-shadow: 0 0 8px #00bcd4;
}

.theme-ocean .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(0, 188, 212, 0.1) 0%, rgba(0, 96, 100, 0.15) 100%);
}

/* 海洋主题障碍物形状 */
.theme-ocean .obstacle-shape.shape-water::before {
  content: '🌊';
  font-size: 1.5rem;
}

.theme-ocean .obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

/* ========== 暗夜主题 ========== */
.theme-night .game-board {
  background: linear-gradient(145deg, #263238 0%, #37474f 100%);
  border: 3px solid #546e7a;
}

.theme-night .grid {
  background: #455a64;
}

.theme-night .cell {
  background: #37474f;
}

.theme-night .cell:hover {
  background: #546e7a;
}

.theme-night .cell.obstacle {
  background: #1a1a2e;
}

.theme-night .theme-particle {
  background: #90a4ae;
  box-shadow: 0 0 10px #78909c;
}

.theme-night .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(84, 110, 122, 0.2) 0%, rgba(26, 26, 46, 0.3) 100%);
}

/* 暗夜主题障碍物形状 */
.theme-night .obstacle-shape.shape-crystal::before {
  content: '💎';
  font-size: 1.5rem;
}

.theme-night .obstacle-shape.shape-mushroom::before {
  content: '🍄';
  font-size: 1.5rem;
}

/* ========== 骷髅主题 ========== */
.theme-skull .game-board {
  background: linear-gradient(145deg, #424242 0%, #616161 100%);
  border: 3px solid #9e9e9e;
}

.theme-skull .grid {
  background: #757575;
}

.theme-skull .cell {
  background: #616161;
}

.theme-skull .cell:hover {
  background: #757575;
}

.theme-skull .cell.obstacle {
  background: #212121;
}

.theme-skull .theme-particle {
  background: #bdbdbd;
  box-shadow: 0 0 8px #9e9e9e;
}

.theme-skull .theme-ambient {
  background: radial-gradient(ellipse at center, rgba(158, 158, 158, 0.15) 0%, rgba(33, 33, 33, 0.25) 100%);
}

/* 骷髅主题障碍物形状 */
.theme-skull .obstacle-shape.shape-bone::before {
  content: '🦴';
  font-size: 1.5rem;
}

.theme-skull .obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

/* ========== 障碍物形状基础样式 ========== */
.obstacle-shape {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.obstacle-shape.shape-x::before {
  content: '✕';
  font-size: 1.2rem;
  color: white;
  font-weight: bold;
}

.obstacle-shape.shape-rock::before {
  content: '🪨';
  font-size: 1.3rem;
}

.obstacle-shape.shape-tree::before {
  content: '🌲';
  font-size: 1.5rem;
}

.obstacle-shape.shape-water::before {
  content: '🌊';
  font-size: 1.5rem;
}

.obstacle-shape.shape-wall::before {
  content: '🧱';
  font-size: 1.3rem;
}

.obstacle-shape.shape-ice::before {
  content: '🧊';
  font-size: 1.5rem;
}

.obstacle-shape.shape-lava::before {
  content: '🔥';
  font-size: 1.5rem;
}

.obstacle-shape.shape-sand::before {
  content: '🏜️';
  font-size: 1.5rem;
}

.obstacle-shape.shape-mushroom::before {
  content: '🍄';
  font-size: 1.5rem;
}

.obstacle-shape.shape-crystal::before {
  content: '💎';
  font-size: 1.5rem;
}

.obstacle-shape.shape-bone::before {
  content: '🦴';
  font-size: 1.5rem;
}

.obstacle-shape.shape-snow::before {
  content: '❄️';
  font-size: 1.3rem;
}

.obstacle-shape.shape-cactus::before {
  content: '🌵';
  font-size: 1.5rem;
}

/* ========== 传送门样式 ========== */
.portal {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 4;
}

.portal-inner {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  animation: portal-pulse 1.5s ease-in-out infinite;
}

.portal-arrow,
.portal-symbol {
  font-size: 0.9rem;
  font-weight: bold;
  z-index: 2;
}

/* ========== 传送门入口 - 增强漩涡效果 ========== */
.portal-entry {
  animation: portal-entry-glow 2s ease-in-out infinite;
}

/* 外层旋转环 - 最外圈，慢速 */
.portal-entry .portal-outer-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px dashed currentColor;
  opacity: 0.6;
  animation: portal-spin-slow 4s linear infinite;
}

/* 内层旋转环 - 中圈，中速反向 */
.portal-entry .portal-inner-ring {
  position: absolute;
  width: 75%;
  height: 75%;
  border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0.7;
  animation: portal-spin-reverse 2.5s linear infinite;
}

/* 核心发光层 - 吸入效果 */
.portal-entry .portal-core {
  position: absolute;
  width: 50%;
  height: 50%;
  border-radius: 50%;
  background: radial-gradient(circle, currentColor 0%, transparent 70%);
  opacity: 0.9;
  animation: portal-core-pulse 1s ease-in-out infinite;
}

/* 螺旋吸入效果 */
.portal-entry .portal-spiral {
  position: absolute;
  width: 85%;
  height: 85%;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent, currentColor, transparent, currentColor, transparent);
  opacity: 0.4;
  animation: portal-spiral-spin 1.5s linear infinite;
}

/* 入口箭头 - 更醒目 */
.portal-entry .portal-arrow {
  font-size: 1.1rem;
  text-shadow: 0 0 8px currentColor, 0 0 15px currentColor;
  animation: portal-arrow-pulse 0.8s ease-in-out infinite;
}

/* 出口样式 - 空心 + 呼吸动画 */
.portal-exit .portal-inner {
  border: 3px solid currentColor;
  background: transparent;
  animation: portal-breathe 2s ease-in-out infinite;
}

.portal-exit .portal-symbol {
  opacity: 0.8;
}

/* 红色传送门 */
.portal-red {
  color: #ef4444;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.6), inset 0 0 10px rgba(239, 68, 68, 0.3);
}

.portal-red .portal-inner {
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
}

.portal-red .portal-core {
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.8), inset 0 0 10px rgba(239, 68, 68, 0.5);
}

/* 黄色传送门 */
.portal-yellow {
  color: #eab308;
  box-shadow: 0 0 15px rgba(234, 179, 8, 0.6), inset 0 0 10px rgba(234, 179, 8, 0.3);
}

.portal-yellow .portal-inner {
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.5);
}

.portal-yellow .portal-core {
  box-shadow: 0 0 15px rgba(234, 179, 8, 0.8), inset 0 0 10px rgba(234, 179, 8, 0.5);
}

/* 蓝色传送门 */
.portal-blue {
  color: #3b82f6;
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.6), inset 0 0 10px rgba(59, 130, 246, 0.3);
}

.portal-blue .portal-inner {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.portal-blue .portal-core {
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.8), inset 0 0 10px rgba(59, 130, 246, 0.5);
}

/* ========== 玩家在传送门出口上的半透明样式 ========== */
.player-mark.on-portal-exit {
  opacity: 0.6;
  z-index: 6;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.6);
}

/* 传送门动画 */
@keyframes portal-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}

@keyframes portal-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes portal-breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.15);
    opacity: 1;
  }
}

/* 入口专用动画 */
@keyframes portal-entry-glow {
  0%, 100% {
    box-shadow: 0 0 20px currentColor, 0 0 40px currentColor, inset 0 0 15px rgba(255, 255, 255, 0.2);
  }
  50% {
    box-shadow: 0 0 30px currentColor, 0 0 60px currentColor, inset 0 0 20px rgba(255, 255, 255, 0.3);
  }
}

@keyframes portal-spin-slow {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes portal-spin-reverse {
  0% {
    transform: rotate(360deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes portal-core-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(0.7);
    opacity: 1;
  }
}

@keyframes portal-spiral-spin {
  0% {
    transform: rotate(0deg);
    opacity: 0.4;
  }
  50% {
    opacity: 0.6;
  }
  100% {
    transform: rotate(360deg);
    opacity: 0.4;
  }
}

@keyframes portal-arrow-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
}
</style>
