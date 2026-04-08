
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
            'boundary': cell.isBoundary,
            'grass': cell.isGrass,
            'sand-dune': cell.isSandDune,
            'sand-dune-ghost': cell.isSandDuneGhost,
            'sand-dune-appear': cell.isSandDuneAppear,
            'player1': cell.hasPlayer1 && !cell.player1Hidden,
            'player2': cell.hasPlayer2 && !cell.player2Hidden,
            'player1-hidden': cell.hasPlayer1 && cell.player1Hidden,
            'player2-hidden': cell.hasPlayer2 && cell.player2Hidden,
            'highlight': cell.isHighlighted,
            'attack-path': cell.inAttackPath,
            'attack-hit': cell.isAttackTarget && attackEffect?.hit,
            'attack-miss': cell.isAttackTarget && !attackEffect?.hit
          }"
        >
          <!-- 传送门进口 - 增强视觉效果，玩家站立时半透明 -->
          <span v-if="cell.portalEntry" class="portal portal-entry" :class="[`portal-${cell.portalEntry}`, { 'with-player': cell.hasPlayer1 || cell.hasPlayer2 }]">
            <span class="portal-outer-ring"></span>
            <span class="portal-inner-ring"></span>
            <span class="portal-core"></span>
            <span class="portal-spiral"></span>
            <span class="portal-arrow">◉</span>
          </span>
          <!-- 传送门出口 - 独立条件，允许与玩家共存，玩家站立时半透明 -->
          <span v-if="cell.portalExit" class="portal portal-exit" :class="[`portal-${cell.portalExit}`, { 'with-player': cell.hasPlayer1 || cell.hasPlayer2 }]">
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
    
    <!-- 陨石特效层（男法师技能） -->
    <div v-if="meteorEffect" class="meteor-effect-layer">
      <!-- 每颗陨石 -->
      <div 
        v-for="(cell, idx) in meteorEffect.targetCells" 
        :key="'meteor-' + idx"
        class="meteor"
        :style="getMeteorStyle(cell, idx)"
      >
        <!-- 陨石本体 -->
        <div class="meteor-body">☄️</div>
        <!-- 火焰拖尾 -->
        <div class="meteor-trail"></div>
        <div class="meteor-trail trail-2"></div>
        <div class="meteor-trail trail-3"></div>
      </div>
      
      <!-- 落地爆炸效果 -->
      <div 
        v-for="(cell, idx) in meteorEffect.targetCells" 
        :key="'meteor-explosion-' + idx"
        class="meteor-explosion"
        :style="getMeteorExplosionStyle(cell, idx)"
      >
        <!-- 冲击波 -->
        <div class="shockwave"></div>
        <div class="shockwave wave-2"></div>
        <!-- 火花粒子 -->
        <span v-for="i in 8" :key="'spark-' + i" class="spark" :class="`spark-${i}`"></span>
      </div>
      
      <!-- 格子焦痕效果 -->
      <div 
        v-for="(cell, idx) in meteorEffect.targetCells" 
        :key="'scorch-' + idx"
        class="scorch-mark"
        :style="getScorchStyle(cell)"
      ></div>
    </div>
    
    <!-- 障碍物摧毁特效（女法师被动） -->
    <div v-if="obstacleDestroyEffect" class="obstacle-destroy-effect" :style="getObstacleDestroyStyle()">
      <div class="debris-particle" v-for="i in 6" :key="'debris-' + i" :class="`debris-${i}`"></div>
      <div class="destroy-flash"></div>
    </div>
    
    <!-- 旋风斩特效层（男骑士技能） -->
    <div v-if="whirlwindEffect" class="whirlwind-effect-layer">
      <!-- 蓄力光效 -->
      <div class="whirlwind-charge" :style="getWhirlwindChargeStyle()"></div>
      
      <!-- 8道弧形刀气 -->
      <div class="whirlwind-blades" :style="getWhirlwindPosition()">
        <div v-for="i in 8" :key="'blade-' + i" class="blade" :class="`blade-${i}`"></div>
      </div>
      
      <!-- 命中闪光 -->
      <div 
        v-for="(cell, idx) in whirlwindEffect.targetCells" 
        :key="'whirlwind-hit-' + idx"
        class="whirlwind-hit-flash"
        :style="getWhirlwindHitStyle(cell)"
      ></div>
    </div>
    
    <!-- 传送门摧毁特效（女法师被动） -->
    <div v-if="portalDestroyEffect" class="portal-destroy-effect" :style="getPortalDestroyStyle()">
      <div class="portal-shatter" v-for="i in 8" :key="'shard-' + i" :class="`shard-${i}`"></div>
      <div class="portal-flash"></div>
    </div>
    
    <!-- 卡牌无效化特效层（男盗贼技能） -->
    <div v-if="cardNullifiedEffect" class="card-nullified-effect-layer">
      <!-- 无效化标记 -->
      <div class="nullified-mark">
        <div class="nullified-x">✕</div>
        <div class="nullified-text">无效化</div>
      </div>
    </div>
    
    <!-- 盗贼复制特效层（男盗贼技能） -->
    <div v-if="thiefCopyEffect" class="thief-copy-effect-layer">
      <!-- 复制卡牌展示 -->
      <div class="copied-card">
        <div class="copy-icon">🃏</div>
        <div class="copy-text">复制执行</div>
        <div class="copied-card-name">{{ thiefCopyEffect.copiedCard?.name || '未知卡牌' }}</div>
      </div>
    </div>
    
    <!-- 穿透箭特效层（男弓箭手技能） -->
    <div v-if="piercingArrowEffect" class="piercing-arrow-effect-layer">
      <!-- 蓄力光效 -->
      <div class="arrow-charge" :style="getArrowChargeStyle()"></div>
      
      <!-- 四个方向的箭矢 -->
      <div 
        v-for="(arrow, idx) in piercingArrowEffect.arrowResults" 
        :key="'arrow-' + idx"
        class="arrow-beam-container"
        :style="getArrowBeamContainerStyle()"
      >
        <!-- 箭矢光束 -->
        <div 
          class="arrow-beam"
          :class="[`arrow-${arrow.direction}`, { 'blocked': arrow.blockedByObstacle }]"
          :style="getArrowBeamStyle(arrow)"
        >
          <!-- 箭矢头部 -->
          <div class="arrow-head" :class="arrow.direction"></div>
          <!-- 穿透轨迹 -->
          <div 
            v-for="(cell, cellIdx) in arrow.path" 
            :key="'path-' + cellIdx"
            class="arrow-path-cell"
            :style="getArrowPathCellStyle(cell, cellIdx, arrow.direction)"
          ></div>
          <!-- 阻挡标记 -->
          <div v-if="arrow.blockedByObstacle" class="arrow-blocked-mark" :style="getArrowBlockedStyle(arrow)"></div>
        </div>
      </div>
      
      <!-- 命中闪光 -->
      <div 
        v-for="(cell, idx) in getHitCells()" 
        :key="'hit-' + idx"
        class="arrow-hit-flash"
        :style="getArrowHitStyle(cell)"
      ></div>
    </div>
    
    <!-- 天降箭雨特效层（女弓箭手被动技能）- 支持多个特效同时显示 -->
    <div v-if="arrowRainEffect.length > 0" class="arrow-rain-effect-layer">
      <!-- 循环渲染每个箭雨特效 -->
      <template v-for="(effect, idx) in arrowRainEffect" :key="'arrow-rain-' + idx">
        <!-- 箭矢从天而降 -->
        <div class="arrow-projectile" :style="getArrowRainStyle(effect)">
          <!-- 箭头 -->
          <div class="arrow-head"></div>
          <!-- 箭身 -->
          <div class="arrow-body"></div>
          <!-- 下落拖尾 -->
          <div class="arrow-fall-trail"></div>
        </div>
        
        <!-- 落地命中效果 -->
        <div 
          class="arrow-hit-effect"
          :class="effect.hitType"
          :style="getArrowRainHitStyle(effect)"
        >
          <!-- 命中/落空闪光 -->
          <div class="hit-flash"></div>
          <!-- 冲击波纹 -->
          <div class="hit-ripple"></div>
        </div>
      </template>
    </div>
    
    <!-- 回忆过去特效层（男阅读者技能） -->
    <div v-if="recallPastEffect" class="recall-past-effect-layer">
      <!-- 历史视野格子高亮 -->
      <div 
        v-for="(cell, idx) in recallPastEffect.targetCells" 
        :key="'recall-' + idx"
        class="recall-cell"
        :style="getRecallCellStyle(cell, idx)"
      >
        <!-- 金色光晕 -->
        <div class="recall-glow"></div>
        <!-- 闪烁边框 -->
        <div class="recall-border"></div>
      </div>
      
      <!-- 中心玩家位置特效 -->
      <div class="recall-origin" :style="getRecallOriginStyle()">
        <div class="recall-ring"></div>
        <div class="recall-ring ring-2"></div>
        <div class="recall-icon">📖</div>
      </div>
    </div>
    
    <!-- 火球特效层（火山主题随机事件）- 在迷雾之上，确保清晰可见 -->
    <div v-if="fireballEffects.length > 0" class="fireball-overlay" style="z-index: 300;">
      <!-- 预警效果 - 目标位置警告圈 -->
      <div v-for="(fireball, idx) in fireballEffects" :key="'warning-' + fireball.id"
           v-show="!fireball.exploding" class="fireball-warning" :style="getFireballStyle(fireball)">
        <div class="warning-ring"></div>
        <div class="warning-ring ring-2"></div>
        <div class="warning-cross"></div>
      </div>
      
      <!-- 火球下落动画 -->
      <div v-for="(fireball, idx) in fireballEffects" :key="fireball.id"
           class="fireball-container" :style="getFireballStyle(fireball)">
        <!-- 火球主体 -->
        <div class="fireball-main" :class="{ 'fireball-exploding': fireball.exploding }">
          <div class="fireball-core"></div>
          <div class="fireball-outer"></div>
          <div class="fireball-glow"></div>
        </div>
        <!-- 火焰拖尾 -->
        <div class="fireball-trail">
          <span v-for="i in 8" :key="i" class="trail-flame" :class="`trail-${i}`"></span>
        </div>
        <!-- 爆炸特效 -->
        <div v-if="fireball.exploding" class="fireball-explosion">
          <div class="explosion-core"></div>
          <div class="explosion-ring"></div>
          <div class="explosion-particles">
            <span v-for="i in 12" :key="i" class="explosion-spark" :class="`espark-${i}`"></span>
          </div>
        </div>
      </div>
    </div>

<!-- 寒流特效覆盖层（冰原主题地图事件） -->
    <div v-if="showColdWave" class="cold-wave-overlay">
      <!-- 蓝色半透明遮罩 -->
      <div class="cold-wave-mask"></div>
      
      <!-- 冰霜边缘 -->
      <div class="frost-border"></div>
      
      <!-- 寒风粒子 -->
      <div class="cold-wave-particles">
        <div v-for="i in 30" :key="i" class="cold-particle" :class="`cold-particle-${i}`"></div>
      </div>
      
      <!-- 寒风流动效果 -->
      <div class="cold-wind-flow">
        <div class="wind-stream wind-stream-1"></div>
        <div class="wind-stream wind-stream-2"></div>
        <div class="wind-stream wind-stream-3"></div>
      </div>
      
      <!-- 大雪花 -->
      <div class="snowflakes-container">
        <div v-for="i in 20" :key="i" class="snowflake" :class="`snowflake-${i}`">❄️</div>
      </div>
    </div>
    
 <!-- 全局迷雾遮罩层 - 覆盖在所有特效之上（可配置开关） -->
    <div v-if="fogEnabled" class="global-fog-container" :class="{ 'fog-clearing': scoutEffects.length > 0 }" :style="{ ...getGlobalFogStyle(), ...fogClearMaskStyle }">
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
    },
    fogEnabled: {
      type: Boolean,
      default: true
    },
    mySkill: {
      type: Object,
      default: null
    },
    showColdWave: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const attackEffect = ref(null)
    const attackHitEffect = ref(null)
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
      const padding = 18  // game-board padding(16px) + grid padding(2px)
      const centerOffset = 21  // cellSize / 2，居中偏移
      return {
        left: `${trail.x * cellSize + padding + centerOffset}px`,
        top: `${trail.y * cellSize + padding + centerOffset}px`,
        opacity: trail.opacity
      }
    }
    
    // 获取攻击特效位置
    const getAttackEffectStyle = () => {
      if (!attackEffect.value) return {}
      const { from } = attackEffect.value
      const cellSize = 42
      const padding = 18  // game-board padding(16px) + grid padding(2px)
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
      const centerOffset = 21  // cellSize / 2，居中偏移
      return {
        '--explosion-x': `${offset.x * cellSize + centerOffset}px`,
        '--explosion-y': `${offset.y * cellSize + centerOffset}px`
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
    
    // ========== 技能特效状态变量 ==========
    
    // 陨石特效状态（男法师技能）
    const meteorEffect = ref(null)
    
    // 障碍物摧毁特效状态（女法师被动）
    const obstacleDestroyEffect = ref(null)
    
    // 传送门摧毁特效状态（女法师被动）
    const portalDestroyEffect = ref(null)
    
    // 旋风斩特效状态（男骑士技能）
    const whirlwindEffect = ref(null)
    
    // 回忆过去特效状态（男阅读者技能）
    const recallPastEffect = ref(null)
    
    // 卡牌无效化特效状态（男盗贼技能）
    const cardNullifiedEffect = ref(null)
    
    // 盗贼复制特效状态（男盗贼技能）
    const thiefCopyEffect = ref(null)
    
    // 穿透箭特效状态（男弓箭手技能）
    const piercingArrowEffect = ref(null)

    // 天降箭雨特效状态（女弓箭手被动技能）- 支持多个特效同时显示
    const arrowRainEffect = ref([])

    // 火球特效状态（火山主题随机事件）- 支持多个火球同时显示
    const fireballEffects = ref([])
    
    // ========== 技能特效设置方法 ==========
    
    // 设置陨石特效（男法师技能）
    const setMeteorEffect = (data) => {
      console.log('[GameBoard] 🌠 设置陨石特效:', data)
      
      // 兼容多种数据格式：targetCells数组 或 targetPosition单个位置
      const effectData = {
        ...data,
        targetCells: data.targetCells || (data.targetPosition ? [data.targetPosition] : [])
      }
      
      console.log('[GameBoard] 陨石目标格子:', effectData.targetCells)
      meteorEffect.value = effectData
      console.log('[GameBoard] meteorEffect.value 已设置:', meteorEffect.value)
      
      // 2秒后清除特效
      setTimeout(() => {
        console.log('[GameBoard] 🌠 清除陨石特效')
        meteorEffect.value = null
      }, 2000)
    }
    
    // 设置障碍物摧毁特效（女法师被动）
    const setObstacleDestroyedEffect = (data) => {
      obstacleDestroyEffect.value = data
      
      // 0.8秒后清除特效
      setTimeout(() => {
        obstacleDestroyEffect.value = null
      }, 800)
    }
    
    // 设置传送门摧毁特效（女法师被动）
    const setPortalDestroyedEffect = (data) => {
      portalDestroyEffect.value = data
      
      // 0.8秒后清除特效
      setTimeout(() => {
        portalDestroyEffect.value = null
      }, 800)
    }
    
    // 设置旋风斩特效（男骑士技能）
    const setWhirlwindEffect = (data) => {
      console.log('[GameBoard] 🌀 设置旋风斩特效:', data)
      
      // 兼容多种数据格式：确保position和targetCells都存在
      const effectData = {
        ...data,
        position: data.position || data.targetPosition || data.targetCells?.[0],
        targetCells: data.targetCells || (data.targetPosition ? [data.targetPosition] : [])
      }
      
      console.log('[GameBoard] 旋风斩位置:', effectData.position)
      console.log('[GameBoard] 旋风斩目标格子:', effectData.targetCells)
      whirlwindEffect.value = effectData
      console.log('[GameBoard] whirlwindEffect.value 已设置:', whirlwindEffect.value)
      
      // 1.5秒后清除特效
      setTimeout(() => {
        console.log('[GameBoard] 🌀 清除旋风斩特效')
        whirlwindEffect.value = null
      }, 1500)
    }
    
    // 设置回忆过去特效（男阅读者技能）
    const setRecallPastEffect = (data) => {
      console.log('[GameBoard] 📖 设置回忆过去特效:', data)
      
      // 兼容多种数据格式：historyVision数组、targetCells数组、targetPosition、opponentPosition、positions数组
      const effectData = {
        ...data,
        targetCells: data.historyVision || data.targetCells || 
                     (data.targetPosition ? [data.targetPosition] : 
                     (data.opponentPosition ? [data.opponentPosition] : 
                     (data.positions || [])))
      }
      
      recallPastEffect.value = effectData
      console.log('[GameBoard] 回忆过去目标格子:', effectData.targetCells)
      
      // 将历史视野格子添加到探查效果中（本回合有效）
      if (effectData.targetCells && effectData.targetCells.length > 0) {
        // 为每个历史格子添加探查效果
        for (const cell of effectData.targetCells) {
          scoutEffects.value.push({
            type: 'recall_past',  // 特殊类型标识回忆过去
            position: cell,
            playerIndex: data.playerIndex
          })
        }
      }
      
      // 3秒后清除特效（回忆过去效果持续到回合结束）
      setTimeout(() => {
        console.log('[GameBoard] 📖 清除回忆过去特效')
        recallPastEffect.value = null
        // 同时清除迷雾消散效果（恢复迷雾）
        scoutEffects.value = scoutEffects.value.filter(e => e.type !== 'recall_past')
        console.log('[GameBoard] 📖 已清除 recall_past 探查效果，迷雾恢复')
      }, 3000)
    }
    
    // 设置卡牌无效化特效（男盗贼技能）
    const setCardNullifiedEffect = (data) => {
      cardNullifiedEffect.value = data
      
      // 1.5秒后清除特效
      setTimeout(() => {
        cardNullifiedEffect.value = null
      }, 1500)
    }
    
    // 设置盗贼复制特效（男盗贼技能）
    const setThiefCopyEffect = (data) => {
      thiefCopyEffect.value = data
      
      // 2秒后清除特效
      setTimeout(() => {
        thiefCopyEffect.value = null
      }, 2000)
    }
    
    // 设置穿透箭特效（男弓箭手技能）
    const setPiercingArrowEffect = (data) => {
      console.log('[GameBoard] ➵ 设置穿透箭特效:', data)
      
      // 兼容多种数据格式：确保position和arrowResults都存在
      const position = data.position || data.targetPosition || data.from
      
      // 如果没有 arrowResults，生成默认的四方向箭矢
      let arrowResults = data.arrowResults || data.results || []
      
      if (arrowResults.length === 0 && position) {
        // 生成四个方向的默认箭矢路径
        const directions = ['up', 'down', 'left', 'right']
        const maxRange = 3  // 默认射程3格
        
        arrowResults = directions.map(dir => {
          const path = []
          for (let i = 1; i <= maxRange; i++) {
            let cell = { ...position }
            if (dir === 'up') cell.y -= i
            else if (dir === 'down') cell.y += i
            else if (dir === 'left') cell.x -= i
            else if (dir === 'right') cell.x += i
            
            // 检查是否在地图范围内
            const mapWidth = props.map.width || props.map.size
            const mapHeight = props.map.height || props.map.size
            if (cell.x >= 0 && cell.x < mapWidth && cell.y >= 0 && cell.y < mapHeight) {
              path.push({ ...cell })
            }
          }
          return {
            direction: dir,
            path: path,
            blockedByObstacle: false
          }
        })
        
        console.log('[GameBoard] ➵ 生成了默认的四方向箭矢:', arrowResults)
      }
      
      const effectData = {
        ...data,
        position: position,
        arrowResults: arrowResults
      }
      
      console.log('[GameBoard] 穿透箭位置:', effectData.position)
      console.log('[GameBoard] 穿透箭结果:', effectData.arrowResults)
      piercingArrowEffect.value = effectData
      
      // 1.5秒后清除特效
      setTimeout(() => {
        console.log('[GameBoard] ➵ 清除穿透箭特效')
        piercingArrowEffect.value = null
      }, 1500)
    }
    
    // 设置天降箭雨特效（女弓箭手被动技能）- 支持多个特效同时显示
    const setArrowRainEffect = (data) => {
      console.log('[GameBoard] 🏹 设置天降箭雨特效:', data)
      
      // 兼容多种数据格式：targetPosition 或 targetCell
      const effectData = {
        ...data,
        targetCell: data.targetCell || data.targetPosition,
        id: Date.now() + Math.random() // 唯一标识符
      }
      
      // 判断命中类型
      if (data.isInvalid) {
        // 落在障碍物或传送门上
        effectData.hitType = 'invalid'
      } else {
        // 检查是否命中玩家
        const hitPlayerIndex = props.players.findIndex(p => 
          p?.position?.x === effectData.targetCell?.x && 
          p?.position?.y === effectData.targetCell?.y
        )
        
        if (hitPlayerIndex !== -1) {
          effectData.hitType = 'hit'
          effectData.hitPlayerIndex = hitPlayerIndex
        } else {
          effectData.hitType = 'miss'
        }
      }
      
      console.log('[GameBoard] 🏹 天降箭雨目标:', effectData.targetCell, '类型:', effectData.hitType)
      
      // 添加到数组中（支持多个特效同时显示）
      arrowRainEffect.value.push(effectData)
      
      // 2秒后清除该特效
      setTimeout(() => {
        const index = arrowRainEffect.value.findIndex(e => e.id === effectData.id)
        if (index !== -1) {
          arrowRainEffect.value.splice(index, 1)
        }
      }, 2000)
    }
    
    // 设置火球特效（火山主题随机事件）- 支持多个火球同时显示
    const setFireballEffect = (data) => {
      console.log('[GameBoard] 🔥 设置火球特效:', data)
      
      // 将火球数据添加到数组中
      const fireballs = (data.fireballs || []).map(fb => ({
        ...fb,
        exploding: false  // 初始状态：未爆炸
      }))
      
      fireballEffects.value = fireballs
      
      // 1.5秒后触发爆炸动画
      setTimeout(() => {
        fireballEffects.value.forEach(fb => {
          fb.exploding = true
        })
      }, 1500)
      
      // 3秒后清除特效
      setTimeout(() => {
        fireballEffects.value = []
      }, 3000)
    }
    
    // 设置火球击中玩家特效
    const setFireballHitPlayer = (hit) => {
      console.log('[GameBoard] 🔥 火球击中玩家:', hit)
      // 使用攻击命中特效来显示火球击中
      const playerPos = props.players[hit.playerIndex]?.position
      if (playerPos) {
        attackHitEffect.value = {
          x: playerPos.x,
          y: playerPos.y,
          playerIndex: hit.playerIndex,
          defended: hit.defended,
          timestamp: Date.now()
        }
        // 播放命中音效
        if (hit.defended) {
          // 防御成功音效
        } else {
          // 受伤音效
        }
        // 2秒后清除特效
        setTimeout(() => {
          if (attackHitEffect.value?.timestamp === hit.timestamp || Date.now() - (attackHitEffect.value?.timestamp || 0) > 1500) {
            attackHitEffect.value = null
          }
        }, 2000)
      }
    }

    // 获取火球位置样式
    const getFireballStyle = (fireball) => {
      const cellSize = 42
      const padding = 18
      const centerOffset = 21
      return {
        left: `${fireball.x * cellSize + padding + centerOffset}px`,
        top: `${fireball.y * cellSize + padding + centerOffset}px`
      }
    }
    
    // ========== 技能特效位置计算方法 ==========
    
    // 获取陨石位置样式
    const getMeteorStyle = (cell, idx) => {
      const cellSize = 42
      const padding = 16
      const delay = idx * 0.15
      return {
        left: `${cell.x * cellSize + padding + 20}px`,
        top: `${cell.y * cellSize + padding + 20}px`,
        animationDelay: `${delay}s`
      }
    }
    
    // 获取陨石爆炸效果位置样式
    const getMeteorExplosionStyle = (cell, idx) => {
      const cellSize = 42
      const padding = 16
      const delay = 0.5 + idx * 0.15
      return {
        left: `${cell.x * cellSize + padding + 20}px`,
        top: `${cell.y * cellSize + padding + 20}px`,
        animationDelay: `${delay}s`
      }
    }
    
    // 获取焦痕效果位置样式
    const getScorchStyle = (cell) => {
      const cellSize = 42
      const padding = 16
      return {
        left: `${cell.x * cellSize + padding}px`,
        top: `${cell.y * cellSize + padding}px`
      }
    }
    
    // 获取障碍物摧毁特效位置
    const getObstacleDestroyStyle = () => {
      if (!obstacleDestroyEffect.value) return {}
      const { position } = obstacleDestroyEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取传送门摧毁特效位置
    const getPortalDestroyStyle = () => {
      if (!portalDestroyEffect.value) return {}
      const { position } = portalDestroyEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取旋风斩蓄力光效位置
    const getWhirlwindChargeStyle = () => {
      if (!whirlwindEffect.value) return {}
      const { position } = whirlwindEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取旋风斩刀气位置
    const getWhirlwindPosition = () => {
      if (!whirlwindEffect.value) return {}
      const { position } = whirlwindEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取旋风斩命中闪光位置
    const getWhirlwindHitStyle = (cell) => {
      const cellSize = 42
      const padding = 16
      return {
        left: `${cell.x * cellSize + padding + 20}px`,
        top: `${cell.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取回忆过去格子样式
    const getRecallCellStyle = (cell, idx) => {
      const cellSize = 42
      const padding = 18
      const delay = idx * 0.03
      return {
        left: `${cell.x * cellSize + padding}px`,
        top: `${cell.y * cellSize + padding}px`,
        animationDelay: `${delay}s`
      }
    }
    
    // 获取回忆过去中心位置样式（玩家当前位置）
    const getRecallOriginStyle = () => {
      if (!recallPastEffect.value) return {}
      const playerIndex = recallPastEffect.value.playerIndex
      const player = props.players[playerIndex]
      if (!player?.position) return {}
      
      const cellSize = 42
      const padding = 18
      return {
        left: `${player.position.x * cellSize + padding + 20}px`,
        top: `${player.position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取箭矢下落样式（天降箭雨）- 支持多个特效
    const getArrowRainStyle = (effect) => {
      if (!effect?.targetCell) return {}
      const { targetCell } = effect
      const cellSize = 42
      const padding = 16
      return {
        left: `${targetCell.x * cellSize + padding + 20}px`,
        top: `${targetCell.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取落地命中效果样式（天降箭雨）- 支持多个特效
    const getArrowRainHitStyle = (effect) => {
      if (!effect?.targetCell) return {}
      const { targetCell } = effect
      const cellSize = 42
      const padding = 16
      return {
        left: `${targetCell.x * cellSize + padding + 20}px`,
        top: `${targetCell.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取蓄力光效位置（穿透箭）
    const getArrowChargeStyle = () => {
      if (!piercingArrowEffect.value) return {}
      const { position } = piercingArrowEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取箭矢容器位置（穿透箭）
    const getArrowBeamContainerStyle = () => {
      if (!piercingArrowEffect.value) return {}
      const { position } = piercingArrowEffect.value
      const cellSize = 42
      const padding = 16
      return {
        left: `${position.x * cellSize + padding + 20}px`,
        top: `${position.y * cellSize + padding + 20}px`
      }
    }
    
    // 获取箭矢光束样式（穿透箭）
    const getArrowBeamStyle = (arrow) => {
      const cellSize = 42
      const pathLength = arrow.path.length
      const beamLength = pathLength * cellSize
      
      return {
        '--beam-length': `${beamLength}px`,
        '--path-length': pathLength
      }
    }
    
    // 获取穿透轨迹格子样式（穿透箭）
    const getArrowPathCellStyle = (cell, cellIdx, direction) => {
      const cellSize = 42
      const delay = cellIdx * 0.08
      
      let offsetX = 0, offsetY = 0
      if (direction === 'up') offsetY = -(cellIdx + 1) * cellSize
      else if (direction === 'down') offsetY = (cellIdx + 1) * cellSize
      else if (direction === 'left') offsetX = -(cellIdx + 1) * cellSize
      else if (direction === 'right') offsetX = (cellIdx + 1) * cellSize
      
      return {
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        animationDelay: `${delay}s`
      }
    }
    
    // 获取阻挡标记样式（穿透箭）
    const getArrowBlockedStyle = (arrow) => {
      if (!arrow.blockedPosition) return {}
      const cellSize = 42
      const { position } = piercingArrowEffect.value
      
      const offsetX = (arrow.blockedPosition.x - position.x) * cellSize
      const offsetY = (arrow.blockedPosition.y - position.y) * cellSize
      
      return {
        left: `${offsetX}px`,
        top: `${offsetY}px`
      }
    }
    
    // 获取所有被命中的格子（穿透箭）
    const getHitCells = () => {
      if (!piercingArrowEffect.value) return []
      const hitCells = []
      
      for (const arrow of piercingArrowEffect.value.arrowResults) {
        for (const cell of arrow.path) {
          hitCells.push(cell)
        }
      }
      
      return hitCells
    }
    
    // 获取命中闪光样式（穿透箭）
    const getArrowHitStyle = (cell) => {
      const cellSize = 42
      const padding = 16
      return {
        left: `${cell.x * cellSize + padding + 20}px`,
        top: `${cell.y * cellSize + padding + 20}px`
      }
    }
    
    // 设置技能特效 - 统一入口
    const setSkillEffect = (data) => {
      console.log('[GameBoard] 技能特效:', data)
      
      const skillId = data.skillId || ''
      
      // 使用 includes 匹配，支持完整技能ID格式（如 knight_male_whirlwind）
      if (skillId.includes('meteor')) {
        console.log('[GameBoard] 🌠 匹配到陨石特效')
        setMeteorEffect(data)
      } else if (skillId.includes('whirlwind')) {
        console.log('[GameBoard] 🌀 匹配到旋风斩特效')
        setWhirlwindEffect(data)
      } else if (skillId.includes('recall') || skillId.includes('history')) {
        console.log('[GameBoard] 📖 匹配到回忆过去特效')
        setRecallPastEffect(data)
      } else if (skillId.includes('nullified')) {
        console.log('[GameBoard] ✕ 匹配到卡牌无效化特效')
        setCardNullifiedEffect(data)
      } else if (skillId.includes('copy')) {
        console.log('[GameBoard] 🃏 匹配到盗贼复制特效')
        setThiefCopyEffect(data)
      } else if (skillId.includes('pierce')) {
        console.log('[GameBoard] ➵ 匹配到穿透箭特效')
        setPiercingArrowEffect(data)
      } else if (skillId.includes('arrow_rain')) {
        console.log('[GameBoard] 🏹 匹配到天降箭雨特效')
        setArrowRainEffect(data)
      } else if (skillId.includes('obstacle_destroyed')) {
        console.log('[GameBoard] 💥 匹配到障碍物摧毁特效')
        setObstacleDestroyedEffect(data)
      } else if (skillId.includes('portal_destroyed')) {
        console.log('[GameBoard] 🌀 匹配到传送门摧毁特效')
        setPortalDestroyedEffect(data)
      } else {
        console.warn('[GameBoard] 未知技能特效:', data.skillId)
      }
    }
    
    // 设置障碍物销毁特效（兼容旧接口）
    const setObstacleDestroyed = (data) => {
      setObstacleDestroyedEffect(data)
    }
    
    const cells = computed(() => {
      const result = []
      const width = props.map.width || props.map.size
      const height = props.map.height || props.map.size
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const obstacle = props.map.obstacles?.find(o => o.x === x && o.y === y)
          const isObstacle = !!obstacle
          const isBoundary = obstacle?.isBoundary || false
          const hasPlayer1 = props.players[0]?.position?.x === x && props.players[0]?.position?.y === y
          const hasPlayer2 = props.players[1]?.position?.x === x && props.players[1]?.position?.y === y
          
          // 检查草丛
          const isGrass = props.map.grass?.some(g => g.x === x && g.y === y) || false
          
          // 检查沙丘
          const isSandDune = props.map.sandDunes?.some(d => d.x === x && d.y === y) || false
          
          // 检查沙丘残影（旧位置渐隐效果）
          const isSandDuneGhost = !isSandDune && (props.map.duneGhostPositions?.some(d => d.x === x && d.y === y) || false)
          
          // 检查沙丘出现效果（新位置汇聚效果）
          const isSandDuneAppear = isSandDune && (props.map.duneAppearPositions?.some(d => d.x === x && d.y === y) || false)
          
          // 检查玩家隐藏状态（对手在草丛中则隐藏）
          // 当前玩家是玩家1时，玩家2隐藏；当前玩家是玩家2时，玩家1隐藏
          const player1Hidden = hasPlayer1 && props.players[0]?.isHidden && !props.isPlayer1
          const player2Hidden = hasPlayer2 && props.players[1]?.isHidden && props.isPlayer1
          
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
            isBoundary,
            isGrass,
            isSandDune,
            isSandDuneGhost,
            isSandDuneAppear,
            hasPlayer1,
            hasPlayer2,
            player1Hidden,
            player2Hidden,
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
      const cellVisualSize = 40  // 格子本身尺寸
      const gapSize = 2          // 格子间隙
      const gridPadding = 2      // grid 内边距
      const padding = 16         // game-board padding (1rem)
      
      // 正确计算：N个格子 + (N-1)个间隙 + grid两侧padding
      // 每行 N 个格子 = N × 40px + (N-1) × 2px gap + 2 × 2px padding = 42N + 2
      const actualWidth = width * cellVisualSize + (width - 1) * gapSize + gridPadding * 2
      const actualHeight = height * cellVisualSize + (height - 1) * gapSize + gridPadding * 2
      
      return {
        width: `${actualWidth}px`,
        height: `${actualHeight}px`,
        left: `${padding + gridPadding}px`,
        top: `${padding + gridPadding}px`
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
      
      // 玩家位置转换为像素坐标（相对于迷雾容器，迷雾容器已定位到grid区域）
      const centerX = myPosition.value.x * cellSize + cellSize / 2
      const centerY = myPosition.value.y * cellSize + cellSize / 2
      
      // 基础可视范围：距离≤1格清晰，距离≥2格完全迷雾
      let clearRadius = 1 * cellSize  // 42px 内完全清晰
      let fogRadius = 2 * cellSize    // 84px 外完全迷雾
      
      // 女阅读者被动技能：常驻探查效果+1（基础可视范围增加0.5格）
      const hasFemaleReaderPassive = props.mySkill?.id === 'reader_female'
      
      // 环绕探查：扩大可视范围到1.5倍
      if (scoutEffects.value.some(e => e.type === 'around')) {
        clearRadius = 1.5 * cellSize  // 63px 内完全清晰
        fogRadius = 2.5 * cellSize    // 105px 外完全迷雾
        // 女阅读者使用环绕探查牌时，效果额外+1（总范围2.5格）
        if (hasFemaleReaderPassive) {
          clearRadius = 2.5 * cellSize  // 105px 内完全清晰
          fogRadius = 3.5 * cellSize    // 147px 外完全迷雾
        }
      } else if (hasFemaleReaderPassive) {
        // 女阅读者常驻效果：基础可视范围+0.5格
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
            transparent ${cellSize * 0.55}px, 
            black ${cellSize * 0.75}px)`)
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
            transparent ${cellSize * 0.55}px, 
            black ${cellSize * 0.75}px)`)
        }
      }
      
      // 4. 回忆过去（男阅读者技能）：照亮历史视野中的所有格子
      const recallPastEffects = scoutEffects.value.filter(e => e.type === 'recall_past')
      if (recallPastEffects.length > 0) {
        for (const effect of recallPastEffects) {
          if (effect.position) {
            const cellCenterX = effect.position.x * cellSize + cellSize / 2
            const cellCenterY = effect.position.y * cellSize + cellSize / 2
            // 每个历史格子一个小光圈
            masks.push(`radial-gradient(circle at ${cellCenterX}px ${cellCenterY}px, 
              transparent 0%, 
              transparent ${cellSize * 0.55}px, 
              black ${cellSize * 0.75}px)`)
          }
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
      setSkillEffect,
      setObstacleDestroyed,
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
      getObstacleShape,
      // ========== 技能特效状态变量和方法 ==========
      // 陨石特效（男法师技能）
      meteorEffect,
      setMeteorEffect,
      getMeteorStyle,
      getMeteorExplosionStyle,
      getScorchStyle,
      // 障碍物摧毁特效（女法师被动）
      obstacleDestroyEffect,
      setObstacleDestroyedEffect,
      getObstacleDestroyStyle,
      // 传送门摧毁特效（女法师被动）
      portalDestroyEffect,
      setPortalDestroyedEffect,
      getPortalDestroyStyle,
      // 旋风斩特效（男骑士技能）
      whirlwindEffect,
      setWhirlwindEffect,
      getWhirlwindChargeStyle,
      getWhirlwindPosition,
      getWhirlwindHitStyle,
      // 回忆过去特效（男阅读者技能）
      recallPastEffect,
      setRecallPastEffect,
      getRecallCellStyle,
      getRecallOriginStyle,
      // 卡牌无效化特效（男盗贼技能）
      cardNullifiedEffect,
      setCardNullifiedEffect,
      // 盗贼复制特效（男盗贼技能）
      thiefCopyEffect,
      setThiefCopyEffect,
      // 穿透箭特效（男弓箭手技能）
      piercingArrowEffect,
      setPiercingArrowEffect,
      getArrowChargeStyle,
      getArrowBeamContainerStyle,
      getArrowBeamStyle,
      getArrowPathCellStyle,
      getArrowBlockedStyle,
      getHitCells,
      getArrowHitStyle,
      // 天降箭雨特效（女弓箭手被动技能）
      arrowRainEffect,
      setArrowRainEffect,
      getArrowRainStyle,
      getArrowRainHitStyle,
      // 火球特效（火山主题随机事件）
      fireballEffects,
      setFireballEffect,
      setFireballHitPlayer,
      getFireballStyle
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
  /* 不设置 overflow: hidden，确保边界位置的角色不被裁剪 */
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

/* 边界障碍物 - 特色地形填充，默认深灰色 */
.cell.boundary {
  background: #757575 !important;
  border: none;
}

.cell.boundary .obstacle-mark {
  display: none;
}

.cell.player1 {
  background: #4dabf7 !important;
}

.cell.player2 {
  background: #ff6b6b !important;
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
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
  z-index: 5;
}

.player1-mark {
  background: #1971c2;
}

.player2-mark {
  background: #c92a2a;
}

/* 玩家在传送门出口上 - 半透明覆盖效果 */
.player-mark.on-portal-exit {
  opacity: 0.75;
  z-index: 6;
  box-shadow: 0 0 12px rgba(255, 255, 255, 0.6), 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.7);
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
  width: 42px;
  height: 42px;
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
  left: var(--explosion-x, 21px);
  top: var(--explosion-y, 21px);
  width: 42px;
  height: 42px;
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
  width: 42px;
  height: 42px;
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
  /* mask-image 过渡 - 实现探查效果的平滑切换 */
  transition: mask-image 0.3s ease-out, -webkit-mask-image 0.3s ease-out;
}

/* 注意：不再使用 opacity 动画，探查效果完全由 mask-image 控制 */
/* 这样可以避免遮罩和动画不同步导致的迷雾闪烁问题 */

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
  /* 过渡动画 - 迷雾消散/恢复时平滑变化 */
  transition: opacity 0.8s ease-out, filter 0.8s ease-out;
}

/* 迷雾消散状态 - 不修改噪音层透明度，探查效果仅通过 mask-image 控制 */
/* 注意：不要修改 opacity，否则探查结束后透明度无法正确恢复 */

/* 底层默认状态 - 无需 transition */
.global-fog-base {
  /* 保持默认透明度 */
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

/* 森林主题边界 - 深绿色 */
.theme-forest .cell.boundary {
  background: #1b5e20 !important;
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

/* 沙漠主题边界 - 深橙黄色 */
.theme-desert .cell.boundary {
  background: #bf360c !important;
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

/* 冰雪主题边界 - 深蓝色 */
.theme-ice .cell.boundary {
  background: #0d47a1 !important;
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

/* 火山主题边界 - 深红色 */
.theme-volcano .cell.boundary {
  background: #b71c1c !important;
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

/* 海洋主题边界 - 深青色 */
.theme-ocean .cell.boundary {
  background: #006064 !important;
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

/* 暗夜主题边界 - 深灰蓝 */
.theme-night .cell.boundary {
  background: #37474f !important;
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

/* 骷髅主题边界 - 深灰色 */
.theme-skull .cell.boundary {
  background: #616161 !important;
}

/* 古城主题边界 - 深灰褐色 */
.theme-ruins .cell.boundary {
  background: #424242 !important;
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
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4;
}

/* 玩家站立时传送门半透明 */
.portal.with-player {
  opacity: 0.35;
  z-index: 3;
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

/* ========== 玩家格子背景 - 放在最后确保覆盖所有主题 ========== */
.cell.player1 {
  background: #4dabf7 !important;
}

.cell.player2 {
  background: #ff6b6b !important;
}

/* ========== 草丛样式（森林主题特色） ========== */
.cell.grass {
  background: linear-gradient(145deg, #2d5a27 0%, #1e4620 50%, #163a18 100%) !important;
  position: relative;
  overflow: hidden;
}

.cell.grass::before {
  content: '🌿';
  position: absolute;
  font-size: 1.3rem;
  opacity: 0.9;
  z-index: 1;
}

.cell.grass:hover {
  background: linear-gradient(145deg, #3a6b32 0%, #2a5530 50%, #1e4620 100%) !important;
}

/* 玩家隐藏在草丛中的样式 */
.cell.player1-hidden,
.cell.player2-hidden {
  background: linear-gradient(145deg, #2d5a27 0%, #1e4620 50%, #163a18 100%) !important;
}

.cell.player1-hidden .player-mark,
.cell.player2-hidden .player-mark {
  opacity: 0;
  pointer-events: none;
}

/* 森林主题草丛增强样式 */
.theme-forest .cell.grass {
  background: linear-gradient(145deg, #2d5a27 0%, #1e4620 50%, #163a18 100%) !important;
  box-shadow: inset 0 0 8px rgba(0, 50, 0, 0.4);
}

.theme-forest .cell.grass::before {
  content: '🌿';
  font-size: 1.4rem;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
}

/* 草丛动画效果 */
.cell.grass::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(100, 200, 100, 0.1) 50%, 
    transparent 100%
  );
  animation: grass-shimmer 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes grass-shimmer {
  0%, 100% {
    transform: translateX(-100%);
    opacity: 0;
  }
  50% {
    transform: translateX(100%);
    opacity: 1;
  }
}

/* ========== 沙丘样式（沙漠主题特色 - CSS纯绘制3D沙丘） ========== */

.cell.sand-dune {
  position: relative;
  overflow: hidden;
  /* 沙丘底色：温暖的沙黄色 + 沙纹纹理 + 光影渐变 */
  background:
    /* 顶层：细微沙纹纹理 */
    repeating-linear-gradient(
      115deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 235, 180, 0.12) 3px,
      rgba(255, 235, 180, 0.12) 4px
    ),
    /* 中层：沙丘光影渐变 - 左亮右暗模拟3D */
    linear-gradient(155deg,
      #d4b060 0%,
      #c8a048 20%,
      #b8943c 45%,
      #a07830 70%,
      #8a6520 100%
    ) !important;
  /* 内阴影增加深度感 */
  box-shadow:
    inset 0 2px 4px rgba(255, 220, 150, 0.3),
    inset 0 -2px 6px rgba(100, 60, 20, 0.4),
    inset 2px 0 3px rgba(180, 140, 80, 0.2),
    inset -2px 0 4px rgba(80, 50, 15, 0.3);
}

/* 沙丘主体3D形状 - 弧形沙丘轮廓 */
.cell.sand-dune::before {
  content: '';
  position: absolute;
  top: 12%;
  left: 8%;
  width: 84%;
  height: 76%;
  z-index: 1;
  /* 沙丘弧形轮廓 - 用圆角模拟 */
  border-radius: 50% 60% 45% 55% / 40% 35% 60% 50%;
  /* 沙丘表面光影 */
  background:
    /* 高光条 - 顶部受光面 */
    linear-gradient(160deg,
      rgba(255, 240, 200, 0.5) 0%,
      rgba(255, 230, 170, 0.3) 25%,
      transparent 50%
    ),
    /* 阴影面 - 右下暗面 */
    linear-gradient(160deg,
      transparent 55%,
      rgba(80, 50, 15, 0.25) 80%,
      rgba(60, 35, 10, 0.35) 100%
    ),
    /* 基础沙色渐变 */
    linear-gradient(155deg,
      #dbb868 0%,
      #c8a048 30%,
      #b08838 60%,
      #987028 100%
    );
  filter: drop-shadow(0 1px 2px rgba(60, 30, 5, 0.3));
}

.cell.sand-dune:hover {
  /* 悬停时沙丘变亮，模拟光照角度变化 */
  background:
    repeating-linear-gradient(
      115deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 245, 200, 0.15) 3px,
      rgba(255, 245, 200, 0.15) 4px
    ),
    linear-gradient(155deg,
      #e0c070 0%,
      #d4ac58 20%,
      #c49c48 45%,
      #b08838 70%,
      #987528 100%
    ) !important;
  box-shadow:
    inset 0 2px 6px rgba(255, 230, 160, 0.4),
    inset 0 -2px 8px rgba(100, 60, 20, 0.5),
    inset 2px 0 4px rgba(200, 160, 100, 0.3),
    inset -2px 0 5px rgba(80, 50, 15, 0.35);
}

/* 沙漠主题沙丘增强样式 */
.theme-desert .cell.sand-dune {
  background:
    repeating-linear-gradient(
      115deg,
      transparent 0px,
      transparent 3px,
      rgba(255, 235, 180, 0.12) 3px,
      rgba(255, 235, 180, 0.12) 4px
    ),
    linear-gradient(155deg,
      #d4b060 0%,
      #c8a048 20%,
      #b8943c 45%,
      #a07830 70%,
      #8a6520 100%
    ) !important;
  box-shadow:
    inset 0 2px 4px rgba(255, 220, 150, 0.3),
    inset 0 -2px 6px rgba(100, 60, 20, 0.4),
    inset 2px 0 3px rgba(180, 140, 80, 0.2),
    inset -2px 0 4px rgba(80, 50, 15, 0.3);
}

.theme-desert .cell.sand-dune::before {
  border-radius: 50% 60% 45% 55% / 40% 35% 60% 50%;
  background:
    linear-gradient(160deg,
      rgba(255, 240, 200, 0.5) 0%,
      rgba(255, 230, 170, 0.3) 25%,
      transparent 50%
    ),
    linear-gradient(160deg,
      transparent 55%,
      rgba(80, 50, 15, 0.25) 80%,
      rgba(60, 35, 10, 0.35) 100%
    ),
    linear-gradient(155deg,
      #dbb868 0%,
      #c8a048 30%,
      #b08838 60%,
      #987028 100%
    );
  filter: drop-shadow(0 1px 2px rgba(60, 30, 5, 0.3));
}

/* 沙丘飘沙动画效果 - 多层风沙粒子 */
.cell.sand-dune::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 200%;
  height: 100%;
  /* 多层风沙效果 */
  background:
    /* 第一层：细沙流 */
    linear-gradient(90deg,
      transparent 0%,
      rgba(210, 180, 120, 0.08) 15%,
      transparent 30%,
      rgba(220, 190, 130, 0.12) 45%,
      transparent 60%,
      rgba(200, 170, 110, 0.06) 75%,
      transparent 90%
    ),
    /* 第二层：风沙亮条 */
    linear-gradient(90deg,
      transparent 0%,
      rgba(255, 230, 160, 0.05) 20%,
      transparent 40%,
      rgba(255, 225, 150, 0.08) 55%,
      transparent 70%,
      rgba(255, 220, 140, 0.04) 85%,
      transparent 100%
    );
  animation: sand-drift 5s ease-in-out infinite;
  pointer-events: none;
  z-index: 2;
}

@keyframes sand-drift {
  0% {
    transform: translateX(-50%);
    opacity: 0;
  }
  15% {
    opacity: 0.7;
  }
  50% {
    transform: translateX(0%);
    opacity: 1;
  }
  85% {
    opacity: 0.7;
  }
  100% {
    transform: translateX(0%);
    opacity: 0;
  }
}

/* ========== 沙丘移动残影特效 ========== */

.cell.sand-dune-ghost {
  position: relative;
  overflow: hidden;
}

.cell.sand-dune-ghost::before {
  content: '';
  position: absolute;
  top: 12%;
  left: 8%;
  width: 84%;
  height: 76%;
  z-index: 1;
  border-radius: 50% 60% 45% 55% / 40% 35% 60% 50%;
  background: linear-gradient(155deg,
    rgba(210, 180, 120, 0.4) 0%,
    rgba(190, 160, 100, 0.3) 50%,
    rgba(170, 140, 80, 0.2) 100%
  );
  animation: dune-ghost-fade 1.5s ease-out forwards;
  pointer-events: none;
}

.cell.sand-dune-ghost::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
    ellipse at center,
    rgba(210, 180, 120, 0.3) 0%,
    rgba(210, 180, 120, 0.1) 40%,
    transparent 70%
  );
  animation: dune-ghost-expand 1.5s ease-out forwards;
  pointer-events: none;
  z-index: 0;
}

@keyframes dune-ghost-fade {
  0% {
    opacity: 1;
    transform: scale(1);
    filter: blur(0px);
  }
  60% {
    opacity: 0.4;
    transform: scale(1.08);
    filter: blur(1px);
  }
  100% {
    opacity: 0;
    transform: scale(1.15);
    filter: blur(3px);
  }
}

@keyframes dune-ghost-expand {
  0% {
    opacity: 0.6;
    transform: scale(0.8);
  }
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* 沙丘出现动画（新位置汇聚效果） */
.cell.sand-dune-appear {
  animation: dune-appear 0.8s ease-out;
}

@keyframes dune-appear {
  0% {
    filter: blur(4px) brightness(1.3);
    transform: scale(0.85);
  }
  40% {
    filter: blur(1px) brightness(1.1);
    transform: scale(1.02);
  }
  100% {
    filter: blur(0px) brightness(1);
    transform: scale(1);
  }
}

/* ========== 陨石特效（男法师技能） ========== */
.meteor-effect-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
  overflow: visible;
}

.meteor {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: meteor-fall 0.8s ease-in forwards;
}

.meteor-body {
  font-size: 2rem;
  filter: drop-shadow(0 0 10px #ff6b00) drop-shadow(0 0 20px #ff4500);
  transform: rotate(-45deg);
}

.meteor-trail {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 60px;
  background: linear-gradient(to top,
    transparent 0%,
    rgba(255, 100, 0, 0.3) 20%,
    rgba(255, 150, 0, 0.6) 50%,
    rgba(255, 200, 50, 0.8) 80%,
    rgba(255, 255, 100, 1) 100%
  );
  border-radius: 4px;
  transform: translate(-50%, -100%) rotate(180deg);
  animation: trail-flicker 0.1s ease-in-out infinite alternate;
  filter: blur(2px);
}

.meteor-trail.trail-2 {
  width: 5px;
  height: 45px;
  transform: translate(-50%, -100%) rotate(175deg);
  animation-delay: 0.05s;
}

.meteor-trail.trail-3 {
  width: 4px;
  height: 35px;
  transform: translate(-50%, -100%) rotate(185deg);
  animation-delay: 0.1s;
}

.meteor-explosion {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: explosion-appear 0.8s ease-out forwards;
}

.shockwave {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 100, 0, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: shockwave-expand 0.6s ease-out forwards;
}

.shockwave.wave-2 {
  animation-delay: 0.1s;
  border-color: rgba(255, 150, 0, 0.6);
}

.spark {
  position: absolute;
  width: 4px;
  height: 4px;
  background: #ff6b00;
  border-radius: 50%;
  box-shadow: 0 0 6px #ff4500;
  animation: spark-fly 0.5s ease-out forwards;
}

.spark-1 { --angle: 0deg; --dist: 25px; }
.spark-2 { --angle: 45deg; --dist: 30px; }
.spark-3 { --angle: 90deg; --dist: 22px; }
.spark-4 { --angle: 135deg; --dist: 28px; }
.spark-5 { --angle: 180deg; --dist: 20px; }
.spark-6 { --angle: 225deg; --dist: 32px; }
.spark-7 { --angle: 270deg; --dist: 18px; }
.spark-8 { --angle: 315deg; --dist: 26px; }

.scorch-mark {
  position: absolute;
  width: 40px;
  height: 40px;
  background: radial-gradient(circle,
    rgba(80, 40, 20, 0.6) 0%,
    rgba(60, 30, 15, 0.4) 40%,
    transparent 70%
  );
  border-radius: 4px;
  animation: scorch-appear 0.5s ease-out forwards;
  pointer-events: none;
}

@keyframes meteor-fall {
  0% { transform: translate(-50%, -200%); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}

@keyframes trail-flicker {
  0% { opacity: 0.6; }
  100% { opacity: 1; }
}

@keyframes explosion-appear {
  0% { opacity: 0; }
  20% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes shockwave-expand {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
}

@keyframes spark-fly {
  0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist)); opacity: 0; }
}

@keyframes scorch-appear {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

/* ========== 障碍物摧毁特效（女法师被动） ========== */
.obstacle-destroy-effect {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 55;
}

.debris-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #666;
  border-radius: 2px;
  animation: debris-fly 0.6s ease-out forwards;
}

.debris-1 { --angle: 20deg; --dist: 25px; animation-delay: 0s; background: #777; }
.debris-2 { --angle: 70deg; --dist: 30px; animation-delay: 0.05s; background: #888; }
.debris-3 { --angle: 120deg; --dist: 22px; animation-delay: 0.1s; background: #666; }
.debris-4 { --angle: 200deg; --dist: 28px; animation-delay: 0.02s; background: #777; }
.debris-5 { --angle: 260deg; --dist: 35px; animation-delay: 0.08s; background: #888; }
.debris-6 { --angle: 330deg; --dist: 20px; animation-delay: 0.12s; background: #666; }

.destroy-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  background: radial-gradient(circle,
    rgba(255, 200, 100, 0.9) 0%,
    rgba(255, 150, 50, 0.5) 50%,
    transparent 100%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: flash-quick 0.3s ease-out forwards;
}

@keyframes debris-fly {
  0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist)) rotate(180deg); opacity: 0; }
}

@keyframes flash-quick {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
}

/* ========== 传送门摧毁特效（女法师被动） ========== */
.portal-destroy-effect {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 55;
}

.portal-shatter {
  position: absolute;
  width: 6px;
  height: 10px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  border-radius: 1px;
  animation: shard-scatter 0.5s ease-out forwards;
}

.shard-1 { --angle: 0deg; --dist: 20px; animation-delay: 0s; }
.shard-2 { --angle: 45deg; --dist: 25px; animation-delay: 0.03s; }
.shard-3 { --angle: 90deg; --dist: 18px; animation-delay: 0.06s; }
.shard-4 { --angle: 135deg; --dist: 28px; animation-delay: 0.02s; }
.shard-5 { --angle: 180deg; --dist: 22px; animation-delay: 0.05s; }
.shard-6 { --angle: 225deg; --dist: 26px; animation-delay: 0.08s; }
.shard-7 { --angle: 270deg; --dist: 15px; animation-delay: 0.01s; }
.shard-8 { --angle: 315deg; --dist: 24px; animation-delay: 0.04s; }

.portal-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  background: radial-gradient(circle,
    rgba(168, 85, 247, 0.9) 0%,
    rgba(124, 58, 237, 0.5) 50%,
    transparent 100%
  );
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: flash-quick 0.3s ease-out forwards;
}

@keyframes shard-scatter {
  0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist)) rotate(270deg); opacity: 0; }
}

/* ========== 旋风斩特效（男骑士技能） ========== */
.whirlwind-effect-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
  overflow: visible;
}

.whirlwind-charge {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle,
    rgba(100, 200, 255, 0.8) 0%,
    rgba(50, 150, 255, 0.4) 50%,
    transparent 100%
  );
  animation: charge-pulse 0.3s ease-out forwards;
  box-shadow: 0 0 20px rgba(100, 200, 255, 0.6);
}

@keyframes charge-pulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

.whirlwind-blades {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
}

.blade {
  position: absolute;
  width: 50px;
  height: 4px;
  background: linear-gradient(90deg,
    rgba(100, 200, 255, 0.9) 0%,
    rgba(50, 150, 255, 0.6) 50%,
    transparent 100%
  );
  transform-origin: left center;
  left: 50%;
  top: 50%;
  box-shadow: 0 0 10px rgba(100, 200, 255, 0.8);
  animation: blade-sweep 0.5s ease-out forwards;
}

.blade-1 { transform: translate(0, -50%) rotate(0deg); animation-delay: 0s; }
.blade-2 { transform: translate(0, -50%) rotate(45deg); animation-delay: 0.05s; }
.blade-3 { transform: translate(0, -50%) rotate(90deg); animation-delay: 0.1s; }
.blade-4 { transform: translate(0, -50%) rotate(135deg); animation-delay: 0.15s; }
.blade-5 { transform: translate(0, -50%) rotate(180deg); animation-delay: 0.2s; }
.blade-6 { transform: translate(0, -50%) rotate(225deg); animation-delay: 0.25s; }
.blade-7 { transform: translate(0, -50%) rotate(270deg); animation-delay: 0.3s; }
.blade-8 { transform: translate(0, -50%) rotate(315deg); animation-delay: 0.35s; }

@keyframes blade-sweep {
  0% { opacity: 0; transform: translate(0, -50%) scaleX(0); }
  30% { opacity: 1; transform: translate(0, -50%) scaleX(1); }
  100% { opacity: 0; transform: translate(0, -50%) scaleX(1); }
}

.whirlwind-hit-flash {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 4px;
  background: radial-gradient(circle, rgba(100, 200, 255, 0.8) 0%, transparent 70%);
  animation: hit-flash 0.4s ease-out forwards;
}

@keyframes hit-flash {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

/* ========== 回忆过去特效（男阅读者技能） ========== */
.recall-past-effect-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
  overflow: visible;
}

.recall-cell {
  position: absolute;
  width: 40px;
  height: 40px;
  animation: recall-cell-appear 0.5s ease-out forwards;
}

.recall-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at center,
    rgba(255, 215, 0, 0.4) 0%,
    rgba(255, 193, 37, 0.3) 40%,
    rgba(255, 165, 0, 0.15) 70%,
    transparent 100%
  );
  border-radius: 4px;
  animation: glow-pulse 1.5s ease-in-out infinite;
}

.recall-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(255, 215, 0, 0.8);
  border-radius: 4px;
  animation: border-flicker 0.8s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.6), inset 0 0 8px rgba(255, 215, 0, 0.3);
}

@keyframes recall-cell-appear {
  0% { opacity: 0; transform: scale(0.5); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes border-flicker {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; box-shadow: 0 0 12px rgba(255, 215, 0, 0.8), inset 0 0 12px rgba(255, 215, 0, 0.4); }
}

.recall-origin {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.recall-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 215, 0, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: recall-ring-expand 1.5s ease-out infinite;
}

.recall-ring.ring-2 {
  animation-delay: 0.5s;
}

@keyframes recall-ring-expand {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
}

.recall-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  animation: recall-icon-pulse 1s ease-in-out infinite;
}

@keyframes recall-icon-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.2); }
}

/* ========== 卡牌无效化特效（男盗贼技能） ========== */
.card-nullified-effect-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 70;
}

.nullified-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: nullified-appear 1.5s ease-out forwards;
}

.nullified-x {
  font-size: 3rem;
  color: #ef4444;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.8), 0 0 20px rgba(239, 68, 68, 0.6), 0 0 30px rgba(239, 68, 68, 0.4);
  animation: x-pulse 0.5s ease-in-out infinite;
}

.nullified-text {
  font-size: 1rem;
  color: #fca5a5;
  font-weight: bold;
  margin-top: 5px;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
  animation: text-flash 0.8s ease-in-out infinite;
}

@keyframes nullified-appear {
  0% { opacity: 0; transform: scale(0.3); }
  30% { opacity: 1; transform: scale(1.3); }
  50% { transform: scale(1); }
  100% { opacity: 0; }
}

@keyframes x-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

@keyframes text-flash {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ========== 盗贼复制特效（男盗贼技能） ========== */
.thief-copy-effect-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 70;
}

.copied-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px 25px;
  background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.95) 100%);
  border: 2px solid rgba(156, 163, 175, 0.6);
  border-radius: 12px;
  box-shadow: 0 0 20px rgba(156, 163, 175, 0.4), 0 0 40px rgba(75, 85, 99, 0.3), inset 0 0 15px rgba(255, 255, 255, 0.1);
  animation: copied-appear 2s ease-out forwards;
}

.copy-icon {
  font-size: 2rem;
  animation: icon-spin 1s ease-in-out;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
}

.copy-text {
  font-size: 0.9rem;
  color: #9ca3af;
  font-weight: bold;
  margin-top: 5px;
  text-shadow: 0 0 5px rgba(156, 163, 175, 0.5);
}

.copied-card-name {
  font-size: 1rem;
  color: #f3f4f6;
  font-weight: bold;
  margin-top: 8px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
}

@keyframes copied-appear {
  0% { opacity: 0; transform: scale(0.5) rotateY(180deg); }
  30% { opacity: 1; transform: scale(1.1) rotateY(0deg); }
  50% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes icon-spin {
  0% { transform: rotateY(180deg); }
  100% { transform: rotateY(0deg); }
}

/* ========== 穿透箭特效（男弓箭手技能） ========== */
.piercing-arrow-effect-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
  overflow: visible;
}

.arrow-charge {
  position: absolute;
  width: 40px;
  height: 40px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 222, 128, 0.8) 0%, rgba(34, 197, 94, 0.4) 50%, transparent 100%);
  animation: arrow-charge-pulse 0.3s ease-out forwards;
  box-shadow: 0 0 25px rgba(74, 222, 128, 0.7);
}

@keyframes arrow-charge-pulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
  50% { transform: translate(-50%, -50%) scale(1.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}

.arrow-beam-container {
  position: absolute;
  transform: translate(-50%, -50%);
}

.arrow-beam {
  position: absolute;
  width: 4px;
  background: linear-gradient(to bottom, rgba(74, 222, 128, 0.9) 0%, rgba(34, 197, 94, 0.6) 50%, transparent 100%);
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.8);
}

.arrow-head {
  position: absolute;
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 12px solid #4ade80;
  filter: drop-shadow(0 0 5px rgba(74, 222, 128, 0.8));
}

.arrow-hit-flash {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(74, 222, 128, 0.8) 0%, transparent 70%);
  animation: hit-flash 0.4s ease-out forwards;
}

/* ========== 天降箭雨特效（女弓箭手被动技能） ========== */
.arrow-rain-effect-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 110;
  overflow: visible;
}

.arrow-projectile {
  position: absolute;
  animation: arrow-fall 0.8s ease-in forwards;
}

.arrow-projectile .arrow-head {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 12px solid #fbbf24;
  filter: drop-shadow(0 0 5px rgba(251, 191, 36, 0.8));
}

.arrow-projectile .arrow-body {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 30px;
  background: linear-gradient(to bottom, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
}

.arrow-projectile .arrow-fall-trail {
  position: absolute;
  top: 42px;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 20px;
  background: linear-gradient(to bottom, rgba(251, 191, 36, 0.5) 0%, transparent 100%);
}

@keyframes arrow-fall {
  0% { transform: translateY(-200px); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(0); opacity: 1; }
}

.arrow-hit-effect {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: hit-effect-appear 0.6s ease-out forwards;
}

.arrow-hit-effect .hit-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: hit-flash-expand 0.5s ease-out forwards;
}

.arrow-hit-effect.hit .hit-flash {
  background: radial-gradient(circle, rgba(255, 100, 0, 0.8) 0%, transparent 70%);
  box-shadow: 0 0 20px rgba(255, 100, 0, 0.6);
}

.arrow-hit-effect.damage .hit-flash {
  background: radial-gradient(circle, rgba(255, 100, 0, 0.8) 0%, transparent 70%);
  box-shadow: 0 0 20px rgba(255, 100, 0, 0.6);
}

.arrow-hit-effect.blocked .hit-flash {
  background: radial-gradient(circle, rgba(255, 200, 0, 0.8) 0%, transparent 70%);
  box-shadow: 0 0 20px rgba(255, 200, 0, 0.6);
}

.arrow-hit-effect.miss .hit-flash {
  background: radial-gradient(circle, rgba(150, 150, 150, 0.6) 0%, transparent 70%);
  box-shadow: 0 0 15px rgba(150, 150, 150, 0.4);
}

.arrow-hit-effect.invalid .hit-flash {
  background: radial-gradient(circle, rgba(100, 100, 120, 0.5) 0%, transparent 70%);
  box-shadow: 0 0 10px rgba(100, 100, 120, 0.3);
}

.arrow-hit-effect.invalid .hit-ripple {
  border-color: rgba(100, 100, 120, 0.5);
  box-shadow: 0 0 10px rgba(100, 100, 120, 0.3);
}

.arrow-hit-effect .hit-ripple {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 215, 0, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ripple-expand-anim 0.7s ease-out forwards;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.6);
}

@keyframes hit-effect-appear {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

@keyframes hit-flash-expand {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
}

@keyframes ripple-expand-anim {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
}

/* ========== 寒流特效（冰原主题地图事件） ========== */
.cold-wave-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 105;
  overflow: hidden;
  border-radius: 12px;
}

/* 蓝色半透明遮罩 */
.cold-wave-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center,
    rgba(100, 180, 255, 0.15) 0%,
    rgba(60, 140, 220, 0.25) 40%,
    rgba(30, 100, 180, 0.35) 70%,
    rgba(20, 60, 120, 0.4) 100%
  );
  animation: cold-mask-pulse 3s ease-in-out infinite;
}

@keyframes cold-mask-pulse {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

/* 冰霜边缘效果 */
.frost-border {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 4px solid transparent;
  border-image: linear-gradient(135deg, 
    rgba(150, 220, 255, 0.8) 0%, 
    rgba(100, 180, 255, 0.4) 25%,
    rgba(150, 220, 255, 0.8) 50%,
    rgba(100, 180, 255, 0.4) 75%,
    rgba(150, 220, 255, 0.8) 100%
  ) 1;
  box-shadow: 
    inset 0 0 30px rgba(100, 180, 255, 0.3),
    0 0 20px rgba(100, 180, 255, 0.2);
  animation: frost-pulse 2s ease-in-out infinite;
}

@keyframes frost-pulse {
  0%, 100% { 
    box-shadow: inset 0 0 30px rgba(100, 180, 255, 0.3), 0 0 20px rgba(100, 180, 255, 0.2);
  }
  50% { 
    box-shadow: inset 0 0 50px rgba(100, 180, 255, 0.5), 0 0 40px rgba(100, 180, 255, 0.4);
  }
}

/* 寒风粒子容器 */
.cold-wave-particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 寒风粒子 - 30个粒子，每个有不同的位置和动画 */
.cold-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  background: rgba(200, 230, 255, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(150, 200, 255, 0.8);
  animation: cold-particle-drift 4s linear infinite;
}

/* 粒子位置和延迟 - 使用CSS变量 */
.cold-particle-1 { left: 5%; top: 10%; animation-delay: 0s; animation-duration: 3.5s; }
.cold-particle-2 { left: 15%; top: 25%; animation-delay: -0.5s; animation-duration: 4s; }
.cold-particle-3 { left: 25%; top: 5%; animation-delay: -1s; animation-duration: 3s; }
.cold-particle-4 { left: 35%; top: 40%; animation-delay: -1.5s; animation-duration: 4.5s; }
.cold-particle-5 { left: 45%; top: 15%; animation-delay: -2s; animation-duration: 3.5s; }
.cold-particle-6 { left: 55%; top: 35%; animation-delay: -2.5s; animation-duration: 4s; }
.cold-particle-7 { left: 65%; top: 8%; animation-delay: -3s; animation-duration: 3s; }
.cold-particle-8 { left: 75%; top: 45%; animation-delay: -3.5s; animation-duration: 4.5s; }
.cold-particle-9 { left: 85%; top: 20%; animation-delay: -0.3s; animation-duration: 3.5s; }
.cold-particle-10 { left: 95%; top: 30%; animation-delay: -0.8s; animation-duration: 4s; }
.cold-particle-11 { left: 10%; top: 55%; animation-delay: -1.3s; animation-duration: 3s; }
.cold-particle-12 { left: 20%; top: 70%; animation-delay: -1.8s; animation-duration: 4.5s; }
.cold-particle-13 { left: 30%; top: 60%; animation-delay: -2.3s; animation-duration: 3.5s; }
.cold-particle-14 { left: 40%; top: 85%; animation-delay: -2.8s; animation-duration: 4s; }
.cold-particle-15 { left: 50%; top: 65%; animation-delay: -3.3s; animation-duration: 3s; }
.cold-particle-16 { left: 60%; top: 80%; animation-delay: -0.2s; animation-duration: 4.5s; }
.cold-particle-17 { left: 70%; top: 55%; animation-delay: -0.7s; animation-duration: 3.5s; }
.cold-particle-18 { left: 80%; top: 75%; animation-delay: -1.2s; animation-duration: 4s; }
.cold-particle-19 { left: 90%; top: 50%; animation-delay: -1.7s; animation-duration: 3s; }
.cold-particle-20 { left: 3%; top: 90%; animation-delay: -2.2s; animation-duration: 4.5s; }
.cold-particle-21 { left: 12%; top: 42%; animation-delay: -2.7s; animation-duration: 3.5s; }
.cold-particle-22 { left: 22%; top: 95%; animation-delay: -3.2s; animation-duration: 4s; }
.cold-particle-23 { left: 32%; top: 22%; animation-delay: -0.4s; animation-duration: 3s; }
.cold-particle-24 { left: 42%; top: 78%; animation-delay: -0.9s; animation-duration: 4.5s; }
.cold-particle-25 { left: 52%; top: 48%; animation-delay: -1.4s; animation-duration: 3.5s; }
.cold-particle-26 { left: 62%; top: 92%; animation-delay: -1.9s; animation-duration: 4s; }
.cold-particle-27 { left: 72%; top: 38%; animation-delay: -2.4s; animation-duration: 3s; }
.cold-particle-28 { left: 82%; top: 62%; animation-delay: -2.9s; animation-duration: 4.5s; }
.cold-particle-29 { left: 92%; top: 88%; animation-delay: -3.4s; animation-duration: 3.5s; }
.cold-particle-30 { left: 50%; top: 50%; animation-delay: -0.1s; animation-duration: 4s; }

@keyframes cold-particle-drift {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 0.8;
  }
  25% {
    transform: translate(20px, -15px) scale(1.2);
    opacity: 1;
  }
  50% {
    transform: translate(40px, 5px) scale(0.9);
    opacity: 0.7;
  }
  75% {
    transform: translate(60px, -10px) scale(1.1);
    opacity: 0.9;
  }
  100% {
    transform: translate(80px, 0) scale(1);
    opacity: 0.8;
  }
}

/* 寒风流动效果容器 */
.cold-wind-flow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 寒风流动带 */
.wind-stream {
  position: absolute;
  width: 200%;
  height: 40px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(150, 200, 255, 0.1) 20%,
    rgba(180, 220, 255, 0.2) 40%,
    rgba(150, 200, 255, 0.1) 60%,
    transparent 80%
  );
  filter: blur(8px);
  animation: wind-flow 5s linear infinite;
}

.wind-stream-1 {
  top: 20%;
  left: -100%;
  animation-delay: 0s;
}

.wind-stream-2 {
  top: 50%;
  left: -100%;
  animation-delay: -1.5s;
  height: 30px;
  opacity: 0.7;
}

.wind-stream-3 {
  top: 75%;
  left: -100%;
  animation-delay: -3s;
  height: 50px;
  opacity: 0.5;
}

@keyframes wind-flow {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(100%);
  }
}

/* 雪花容器 */
.snowflakes-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 大雪花 */
.snowflake {
  position: absolute;
  font-size: 1.5rem;
  opacity: 0.8;
  animation: snowflake-fall 6s linear infinite;
  text-shadow: 0 0 10px rgba(200, 230, 255, 0.8);
}

/* 雪花位置和延迟 */
.snowflake-1 { left: 5%; animation-delay: 0s; animation-duration: 5s; font-size: 1.2rem; }
.snowflake-2 { left: 12%; animation-delay: -0.8s; animation-duration: 6s; font-size: 1.8rem; }
.snowflake-3 { left: 20%; animation-delay: -1.6s; animation-duration: 5.5s; font-size: 1.4rem; }
.snowflake-4 { left: 28%; animation-delay: -2.4s; animation-duration: 6.5s; font-size: 1.6rem; }
.snowflake-5 { left: 35%; animation-delay: -3.2s; animation-duration: 5s; font-size: 1.3rem; }
.snowflake-6 { left: 42%; animation-delay: -4s; animation-duration: 6s; font-size: 1.7rem; }
.snowflake-7 { left: 50%; animation-delay: -0.5s; animation-duration: 5.5s; font-size: 1.5rem; }
.snowflake-8 { left: 58%; animation-delay: -1.3s; animation-duration: 6.5s; font-size: 1.2rem; }
.snowflake-9 { left: 65%; animation-delay: -2.1s; animation-duration: 5s; font-size: 1.8rem; }
.snowflake-10 { left: 72%; animation-delay: -2.9s; animation-duration: 6s; font-size: 1.4rem; }
.snowflake-11 { left: 80%; animation-delay: -3.7s; animation-duration: 5.5s; font-size: 1.6rem; }
.snowflake-12 { left: 88%; animation-delay: -4.5s; animation-duration: 6.5s; font-size: 1.3rem; }
.snowflake-13 { left: 95%; animation-delay: -0.3s; animation-duration: 5s; font-size: 1.5rem; }
.snowflake-14 { left: 8%; animation-delay: -1.1s; animation-duration: 6s; font-size: 1.7rem; }
.snowflake-15 { left: 18%; animation-delay: -1.9s; animation-duration: 5.5s; font-size: 1.2rem; }
.snowflake-16 { left: 25%; animation-delay: -2.7s; animation-duration: 6.5s; font-size: 1.8rem; }
.snowflake-17 { left: 32%; animation-delay: -3.5s; animation-duration: 5s; font-size: 1.4rem; }
.snowflake-18 { left: 38%; animation-delay: -4.3s; animation-duration: 6s; font-size: 1.6rem; }
.snowflake-19 { left: 45%; animation-delay: -0.6s; animation-duration: 5.5s; font-size: 1.3rem; }
.snowflake-20 { left: 52%; animation-delay: -1.4s; animation-duration: 6.5s; font-size: 1.5rem; }

@keyframes snowflake-fall {
  0% {
    transform: translateY(-30px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 0.9;
  }
  90% {
    opacity: 0.9;
  }
  100% {
    transform: translateY(calc(100% + 30px)) rotate(360deg);
    opacity: 0;
  }
}

/* ========== 火球特效（火山主题随机事件） ========== */
.fireball-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 300;
  overflow: visible;
}

/* 预警圈 - 红色闪烁 */
.fireball-warning {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
  animation: warning-fade-in 0.3s ease-out forwards;
}

.warning-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 0, 0, 0.9);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: warning-ring-pulse 0.5s ease-in-out infinite;
  box-shadow: 0 0 15px rgba(255, 0, 0, 0.6), inset 0 0 10px rgba(255, 0, 0, 0.3);
}

.warning-ring.ring-2 {
  width: 28px;
  height: 28px;
  border-width: 3px;
  animation-delay: 0.15s;
  border-color: rgba(255, 100, 0, 0.9);
  box-shadow: 0 0 12px rgba(255, 100, 0, 0.5), inset 0 0 8px rgba(255, 100, 0, 0.3);
}

.warning-cross {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
}

.warning-cross::before,
.warning-cross::after {
  content: '';
  position: absolute;
  background: rgba(255, 0, 0, 0.8);
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.6);
}

.warning-cross::before {
  top: 50%;
  left: 0;
  width: 100%;
  height: 3px;
  transform: translateY(-50%);
}

.warning-cross::after {
  top: 0;
  left: 50%;
  width: 3px;
  height: 100%;
  transform: translateX(-50%);
}

@keyframes warning-fade-in {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes warning-ring-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
}

/* 火球容器 */
.fireball-container {
  position: absolute;
  transform: translate(-50%, -50%);
  animation: fireball-fall 1.5s ease-in forwards;
}

/* 火球主体 */
.fireball-main {
  position: relative;
  width: 60px;
  height: 60px;
  transform: translate(-50%, -50%);
}

.fireball-main.fireball-exploding {
  animation: fireball-explode 0.8s ease-out forwards;
}

/* 火球核心 - 白黄色核心，多层发光 */
.fireball-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, #ffffff 0%, #fffacd 25%, #ffd700 50%, #ff8c00 75%, #ff4500 100%);
  box-shadow: 0 0 15px #ffffff, 0 0 30px #ffd700, 0 0 50px #ff8c00, 0 0 70px #ff4500;
  animation: fireball-core-pulse 0.2s ease-in-out infinite;
}

/* 火球外层 - 橙红色外层火焰 */
.fireball-outer {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, transparent 20%, rgba(255, 140, 0, 0.9) 45%, rgba(255, 69, 0, 0.7) 70%, transparent 100%);
  animation: fireball-outer-flicker 0.15s ease-in-out infinite;
  filter: blur(3px);
}

/* 火球光晕 - 大范围光晕 */
.fireball-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 140, 0, 0.3) 0%, rgba(255, 69, 0, 0.15) 30%, transparent 60%);
  animation: fireball-glow-pulse 0.3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes fireball-core-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.1); }
}

@keyframes fireball-outer-flicker {
  0%, 100% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.8; }
  33% { transform: translate(-50%, -50%) scale(1.05) rotate(3deg); opacity: 1; }
  66% { transform: translate(-50%, -50%) scale(0.95) rotate(-2deg); opacity: 0.9; }
}

@keyframes fireball-glow-pulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

/* 火球拖尾 - 火焰尾迹 */
.fireball-trail {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  width: 30px;
  height: 80px;
  pointer-events: none;
}

.trail-flame {
  position: absolute;
  bottom: 0;
  width: 8px;
  height: 40px;
  border-radius: 50%;
  filter: blur(4px);
  animation: trail-flame-flicker 0.2s ease-in-out infinite alternate;
}

.trail-1 { left: 0; height: 35px; background: rgba(255, 69, 0, 0.8); animation-delay: 0s; }
.trail-2 { left: 4px; height: 45px; background: rgba(255, 140, 0, 0.7); animation-delay: -0.03s; }
.trail-3 { left: 8px; height: 50px; background: rgba(255, 200, 0, 0.6); animation-delay: -0.06s; }
.trail-4 { left: 12px; height: 55px; background: rgba(255, 220, 100, 0.8); animation-delay: -0.09s; }
.trail-5 { left: 16px; height: 50px; background: rgba(255, 200, 0, 0.6); animation-delay: -0.12s; }
.trail-6 { left: 20px; height: 45px; background: rgba(255, 140, 0, 0.7); animation-delay: -0.15s; }
.trail-7 { left: 24px; height: 40px; background: rgba(255, 100, 0, 0.8); animation-delay: -0.18s; }
.trail-8 { left: 28px; height: 30px; background: rgba(255, 69, 0, 0.6); animation-delay: -0.21s; }

@keyframes trail-flame-flicker {
  0% { transform: scaleY(1) scaleX(1); opacity: 0.7; }
  100% { transform: scaleY(1.15) scaleX(0.9); opacity: 1; }
}

/* 火球爆炸特效 */
.fireball-explosion {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* 爆炸核心 */
.explosion-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, #ffffff 0%, #fffacd 20%, #ffd700 40%, #ff8c00 60%, #ff4500 80%, transparent 100%);
  animation: explosion-core-expand 0.6s ease-out forwards;
  box-shadow: 0 0 30px #ffffff, 0 0 60px #ffd700, 0 0 90px #ff8c00;
}

/* 爆炸冲击环 */
.explosion-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  border: 4px solid rgba(255, 140, 0, 0.8);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: explosion-ring-expand 0.8s ease-out forwards;
  box-shadow: 0 0 20px rgba(255, 140, 0, 0.6);
}

/* 爆炸粒子 */
.explosion-particles {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
}

.explosion-spark {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #ff8c00;
  border-radius: 50%;
  box-shadow: 0 0 6px #ff4500, 0 0 12px #ffd700;
  animation: explosion-spark-fly 0.8s ease-out forwards;
}

.espark-1 { --angle: 0deg; --dist: 40px; animation-delay: 0s; }
.espark-2 { --angle: 30deg; --dist: 50px; animation-delay: 0.02s; }
.espark-3 { --angle: 60deg; --dist: 35px; animation-delay: 0.04s; }
.espark-4 { --angle: 90deg; --dist: 55px; animation-delay: 0.06s; }
.espark-5 { --angle: 120deg; --dist: 42px; animation-delay: 0.08s; }
.espark-6 { --angle: 150deg; --dist: 48px; animation-delay: 0.1s; }
.espark-7 { --angle: 180deg; --dist: 38px; animation-delay: 0.12s; }
.espark-8 { --angle: 210deg; --dist: 52px; animation-delay: 0.14s; }
.espark-9 { --angle: 240deg; --dist: 45px; animation-delay: 0.16s; }
.espark-10 { --angle: 270deg; --dist: 58px; animation-delay: 0.18s; }
.espark-11 { --angle: 300deg; --dist: 40px; animation-delay: 0.2s; }
.espark-12 { --angle: 330deg; --dist: 50px; animation-delay: 0.22s; }

@keyframes fireball-fall {
  0% { transform: translate(-50%, -350px); opacity: 0; }
  10% { opacity: 1; }
  100% { transform: translate(-50%, -50%); opacity: 1; }
}

@keyframes fireball-explode {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.5); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
}

@keyframes explosion-core-expand {
  0% { transform: translate(-50%, -50%) scale(0.3); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(2); opacity: 0.8; }
  100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
}

@keyframes explosion-ring-expand {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(4); opacity: 0; }
}

@keyframes explosion-spark-fly {
  0% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0); opacity: 1; }
  70% { opacity: 0.6; }
  100% { transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--dist)); opacity: 0; }
}
</style>
