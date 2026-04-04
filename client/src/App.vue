<template>
  <div class="game-container" :style="screenBgStyle">
    <!-- 地图名称展示界面 -->
    <Transition name="map-name-transition">
      <div v-if="showMapName" class="map-name-overlay">
        <div class="map-name-content">
          <div class="map-name-icon">🗺️</div>
          <div class="map-name-title">当前地图</div>
          <div class="map-name-text">{{ currentTheme?.nameCn || '未知地图' }}</div>
          <div class="map-name-desc">{{ currentTheme?.description || '' }}</div>
        </div>
      </div>
    </Transition>

    <!-- 新回合提示界面 -->
    <Transition name="round-transition">
      <div v-if="showRoundTransition" class="round-transition-overlay">
        <div class="round-transition-content">
          <div class="round-transition-icon">⚔️</div>
          <div class="round-transition-text">进入第 {{ nextRound }} 回合</div>
        </div>
      </div>
    </Transition>

    <!-- 选择查看对手手牌弹窗 -->
    <div v-if="chooseOpponentCardVisible" class="choose-card-modal">
      <div class="choose-card-content">
        <h2>⚔️ 对方已确定出牌顺序</h2>
        <p class="choose-tip">你可以选择查看对方的一张手牌：</p>
        
        <div class="choose-options">
          <div 
            class="choose-option"   
            :class="{ 'selected': viewedCardChoice === 'first' }"
            @click="selectCardChoice('first')"
          >
            <div class="choose-icon">🥇</div>
            <div class="choose-label">第一张</div>
            <div class="choose-desc">最先打出的牌</div>
          </div>
          
          <div 
            class="choose-option"
            :class="{ 'selected': viewedCardChoice === 'last' }"
            @click="selectCardChoice('last')"
          >
            <div class="choose-icon">🥉</div>
            <div class="choose-label">最后一张</div>
            <div class="choose-desc">最后打出的牌</div>
          </div>
        </div>
        
        <button 
          class="btn btn-primary confirm-choice-btn" 
          :disabled="!viewedCardChoice"
          @click="confirmCardChoice"
        >
          确认选择
        </button>
      </div>
    </div>

    <!-- 角色形象选择弹窗 -->
    <AvatarSelector 
      v-if="showAvatarSelector" 
      @selected="onAvatarSelected"
      @close="closeAvatarSelector"
    />

    <!-- 游戏规则弹窗 -->
    <div v-if="showRules" class="rules-modal">
      <div class="rules-content">
        <h2>📜 游戏规则</h2>
        <div class="rules-section">
          <h3>🎯 游戏目标</h3>
          <p>击败对方玩家，使其血量降为0。</p>
        </div>
        <div class="rules-section">
          <h3>🃏 卡牌类型</h3>
          <ul>
            <li><strong>移动牌 ↑→↓←</strong>：控制角色向指定方向移动一格</li>
            <li><strong>攻击牌 ⚔</strong>：对指定方向造成伤害（1格或2格距离）</li>
            <li><strong>防御牌 🛡</strong>：抵消下一次受到的攻击</li>
            <li><strong>探查牌 👁</strong>：
              <ul class="sub-list">
                <li>行探查 👁↔：照亮你所在行的所有格子</li>
                <li>列探查 👁↕：照亮你所在列的所有格子</li>
                <li>环绕探查 👁：扩大你的视野范围至1.5格</li>
              </ul>
            </li>
          </ul>
        </div>
        <div class="rules-section">
          <h3>🗺 地图元素</h3>
          <ul>
            <li><strong>障碍物</strong>：无法通过的格子，移动和攻击都会被阻挡</li>
            <li><strong>传送门 🔴🟡🔵</strong>：成对出现，踏入入口会传送至对应出口</li>
            <li><strong>迷雾</strong>：视野限制，只能看到周围一定范围内的区域</li>
          </ul>
        </div>
        <div class="rules-section">
          <h3>🌍 地图主题</h3>
          <p class="theme-list">🌲 森林 · 🏜️ 沙漠 · ❄️ 冰原 · 🌋 火山 · 🏛️ 古城</p>
          <p class="theme-note">每局随机选择一种主题，不同主题有独特的视觉效果</p>
        </div>
        <div class="rules-section">
          <h3>📋 游戏流程</h3>
          <ol>
            <li>选择3张卡牌作为手牌</li>
            <li>先手玩家调整出牌顺序后，后手玩家可选择查看先手的第一张或最后一张手牌</li>
            <li>后手玩家调整出牌顺序</li>
            <li>双方交替出牌，先手玩家先出</li>
            <li>3张牌打完后进入下一回合</li>
          </ol>
        </div>
        <div class="rules-section">
          <h3>🔍 信息可见规则</h3>
          <ul>
            <li>后手玩家可选择查看先手玩家的<strong>第一张</strong>或<strong>最后一张</strong>手牌</li>
            <li>先手玩家会得知后手玩家选择查看了哪张牌</li>
            <li>双方都只能看到对方的一张手牌</li>
          </ul>
        </div>
        <div class="rules-checkbox">
          <label>
            <input type="checkbox" v-model="dontShowRules" />
            不再显示此提示
          </label>
        </div>
        <button class="btn btn-primary" @click="closeRules">开始游戏</button>
      </div>
    </div>

    <!-- 连接/房间界面 -->
    <div v-if="gameState.phase === 'connecting'" class="connect-screen">
      <h1 class="title">🎭 Cloak of Moves</h1>
      <p class="subtitle">双人对战卡牌游戏</p>
      
      <!-- 当前形象选择 -->
      <div class="avatar-select-area" @click="openAvatarSelector">
        <span class="avatar-label">选择形象:</span>
        <AvatarIcon :avatar-id="myAvatarId" size="medium" />
        <span class="avatar-change-hint">点击更换</span>
      </div>
      
      <button class="btn rules-btn" @click="showRules = true">📜 查看规则</button>
      
      <div class="connect-form">
        <input 
          v-model="roomCode" 
          placeholder="输入房间号加入" 
          class="room-input"
          @keyup.enter="joinRoom"
        />
        <button @click="joinRoom" class="btn">加入房间</button>
      </div>
      
      <div class="divider">或者</div>
      
      <button @click="createRoom" class="btn btn-primary">创建新房间</button>
      
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
      <p class="status">{{ connectionStatus }}</p>
    </div>

    <!-- 等待界面 -->
    <div v-else-if="gameState.phase === 'waiting'" class="waiting-screen">
      <h2>房间: {{ currentRoom }}</h2>
      <button @click="copyRoomCode" class="btn btn-copy">📋 复制房间号</button>
      <p v-if="copySuccess" class="copy-success">已复制到剪贴板！</p>
      
      <!-- 当前形象显示 -->
      <div class="waiting-avatar">
        <span class="avatar-label">你的形象:</span>
        <AvatarIcon :avatar-id="myAvatarId" size="medium" />
      </div>
      
      <button class="btn rules-btn" @click="showRules = true">📜 查看规则</button>
      <p class="waiting-text">等待另一名玩家加入...</p>
      <div class="loading-spinner"></div>
    </div>
    
    <!-- 地图配置界面 -->
    <div v-else-if="gameState.phase === 'configuring'" class="configuring-screen">
      <h2>房间: {{ currentRoom }}</h2>
      <h3>地图配置</h3>
      
      <!-- 房主可以选择地图大小 -->
      <div v-if="isCreator" class="map-size-selection">
        <p>请选择地图大小：</p>
        <div class="map-options">
          <button 
            v-for="size in mapSizeOptions" 
            :key="size"
            class="btn map-option-btn"
            :class="{ 'selected': selectedMapSize === size, 'single-row': typeof size === 'string' }"
            @click="selectMapSize(size)"
          >
            {{ typeof size === 'string' ? size.replace('x', '×') : `${size}×${size}` }}
          </button>
        </div>
        
        <!-- 迷雾效果开关 -->
        <div class="fog-selection">
          <p>迷雾效果：</p>
          <div class="fog-options">
            <button 
              class="btn fog-option-btn"
              :class="{ 'selected': selectedFogEnabled }"
              @click="selectedFogEnabled = true"
            >
              启用
            </button>
            <button 
              class="btn fog-option-btn"
              :class="{ 'selected': !selectedFogEnabled }"
              @click="selectedFogEnabled = false"
            >
              关闭
            </button>
          </div>
<p class="fog-hint">迷雾会增加游戏难度，限制视野范围</p>
        </div>
        
        <button 
          class="btn btn-primary confirm-map-btn" 
          :disabled="!selectedMapSize"
          @click="confirmMapSize"
        >
          确认配置
        </button>
      </div>
      
      <!-- 非房主显示等待提示 -->
      <div v-else class="waiting-config">
        <p>对方玩家正在选择地图大小...</p>
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- 游戏主界面 -->
    <div v-else-if="gameState.phase !== 'game_end'" class="game-screen">
      <!-- 顶部玩家信息 -->
      <div class="players-bar">
        <div class="player-info" :class="{ 'is-opponent': !isPlayer1, 'is-priority': gameState.isPlayer1Priority }">
          <span class="player-name">P1 {{ gameState.isPlayer1Priority ? '(先手)' : '' }}</span>
          <span class="player-hp">{{ gameState.players?.[0]?.hp || 1 }} ❤️</span>
        </div>
        <div class="round-info">
          <span>回合 {{ gameState.currentRound }}</span>
        </div>
        <div class="player-info" :class="{ 'is-opponent': isPlayer1, 'is-priority': !gameState.isPlayer1Priority }">
          <span class="player-name">P2 {{ !gameState.isPlayer1Priority ? '(先手)' : '' }}</span>
          <span class="player-hp">{{ gameState.players?.[1]?.hp || 1 }} ❤️</span>
        </div>
      </div>

      <!-- 游戏区域：左右侧玩家面板 + 棋盘 -->
      <div class="game-area">
        <!-- 左侧面板 - 玩家1（蓝色） -->
        <div class="player-side-panel left-panel" :class="{ 'is-me': isPlayer1 }">
          <div class="panel-player-label">P1</div>
          <div class="panel-character">
            <AvatarIcon v-if="player1AvatarId" :avatar-id="player1AvatarId" size="large" />
            <div v-else class="character-avatar blue-avatar">
              <span class="avatar-icon">⚔️</span>
            </div>
          </div>
          <div class="panel-identity">
            <span v-if="isPlayer1" class="identity-badge you-badge">你</span>
            <span v-else class="identity-badge opponent-badge">对手</span>
          </div>
          <div class="panel-hp">
            <span class="hp-label">生命值</span>
            <div class="hp-hearts">
              <span v-for="i in 1" :key="i" class="heart" :class="{ 'lost': (gameState.players?.[0]?.hp || 1) < i }">❤️</span>
            </div>
          </div>
        </div>
        
        <!-- 游戏棋盘 -->
        <div class="board-container">
<GameBoard 
            ref="gameBoardRef"
            :map="gameState.map" 
            :players="gameState.players"
            :is-player1="isPlayer1"
            :theme="currentTheme"
            :fog-enabled="gameState.fogEnabled"
          />
        </div>
        
        <!-- 右侧面板 - 玩家2（红色） -->
        <div class="player-side-panel right-panel" :class="{ 'is-me': !isPlayer1 }">
          <div class="panel-player-label">P2</div>
          <div class="panel-character">
            <AvatarIcon v-if="player2AvatarId" :avatar-id="player2AvatarId" size="large" />
            <div v-else class="character-avatar red-avatar">
              <span class="avatar-icon">🛡️</span>
            </div>
          </div>
          <div class="panel-identity">
            <span v-if="!isPlayer1" class="identity-badge you-badge">你</span>
            <span v-else class="identity-badge opponent-badge">对手</span>
          </div>
          <div class="panel-hp">
            <span class="hp-label">生命值</span>
            <div class="hp-hearts">
              <span v-for="i in 1" :key="i" class="heart" :class="{ 'lost': (gameState.players?.[1]?.hp || 1) < i }">❤️</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 阶段提示 -->
      <div class="phase-indicator">
        <span v-if="gameState.phase === 'dealing'">游戏开始...</span>
        <span v-else-if="gameState.phase === 'waiting_selecting'">等待对方选择...</span>
        <span v-else-if="gameState.phase === 'selecting_priority'">
          {{ isPriorityPlayer ? '选择3张手牌' : '等待对方选择...' }}
          <span v-if="isPriorityPlayer" :class="{ 'timer-warning': selectTimer <= 3 }"> (剩余: {{ selectTimer }}s)</span>
        </span>
        <span v-else-if="gameState.phase === 'ordering_priority'">
          <span v-if="orderLocked" class="order-confirmed">✓ 已确定选择，等待对方...</span>
          <span v-else>调整手牌顺序 (剩余: {{ orderTimer }}s)</span>
        </span>
        <span v-else-if="gameState.phase === 'selecting_normal'">
          {{ !isPriorityPlayer ? '选择3张手牌 (可见对方第一张)' : '等待对方选择...' }}
          <span v-if="!isPriorityPlayer" :class="{ 'timer-warning': selectTimer <= 3 }"> (剩余: {{ selectTimer }}s)</span>
        </span>
        <span v-else-if="gameState.phase === 'ordering_normal'">
          <span v-if="orderLocked" class="order-confirmed">✓ 已确定选择，等待对方...</span>
          <span v-else>调整手牌顺序 (剩余: {{ orderTimer }}s)</span>
        </span>
        <span v-else-if="gameState.phase === 'playing'">出牌阶段 - 第 {{ currentTurn }}/3 轮</span>
      </div>

      <!-- 卡牌区域 -->
      <div class="cards-area">
        <!-- 当前卡牌选择 -->
        <div v-if="gameState.phase === 'selecting_priority' || gameState.phase === 'selecting_normal'" class="card-selection">
          <!-- 显示对方查看的手牌（仅后手玩家可见，显示在顶部居中） -->
          <div v-if="!isPriorityPlayer && opponentFirstCard" class="opponent-first-card-top">
            <p>先手玩家{{ viewedCardChoice === 'last' ? '最后一张' : '第一张' }}手牌：</p>
            <div class="card first-visible center-card">
              <span class="card-icon">{{ opponentFirstCard.icon }}</span>
              <span class="card-name">{{ opponentFirstCard.name }}</span>
            </div>
          </div>
          
          <p class="cards-tip">选择3张卡牌作为手牌</p>
          
          <!-- 选牌进度条 -->
          <div class="selection-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (selectedCards.length / 3 * 100) + '%' }"></div>
            </div>
            <div class="progress-dots">
              <span v-for="i in 3" :key="i" class="dot" :class="{ 'filled': selectedCards.length >= i }">{{ i }}</span>
            </div>
          </div>
          
          <div class="available-cards">
            <div 
              v-for="(card, index) in currentCards" 
              :key="index"
              class="card"
              :class="{ 'selected': selectedCards.includes(index) }"
              @click="toggleCardSelection(index)"
            >
              <span class="card-icon">{{ card.icon }}</span>
              <span class="card-name">{{ card.name }}</span>
            </div>
          </div>
          <button 
            class="btn btn-confirm" 
            :disabled="selectedCards.length !== 3"
            @click="confirmCardSelection"
          >
            确认选择 ({{ selectedCards.length }}/3)
          </button>
        </div>

        <!-- 手牌顺序调整 -->
        <div v-else-if="gameState.phase === 'ordering_priority' || gameState.phase === 'ordering_normal'" class="card-ordering">
          <!-- 显示对方查看的手牌（仅非优先玩家可见，显示在顶部居中） -->
          <div v-if="!isPriorityPlayer && opponentFirstCard" class="opponent-first-card-top">
            <p>先手玩家{{ viewedCardChoice === 'last' ? '最后一张' : '第一张' }}手牌：</p>
            <div class="card first-visible center-card">
              <span class="card-icon">{{ opponentFirstCard.icon }}</span>
              <span class="card-name">{{ opponentFirstCard.name }}</span>
            </div>
          </div>
          
          <p class="cards-tip">
            {{ isPriorityPlayer ? '调整手牌顺序（对方只能看到第一张）' : '调整手牌顺序' }}
          </p>
          <div class="hand-cards">
            <div 
              v-for="(card, index) in myHandCards" 
              :key="index"
              class="card"
              :class="{ 
                'first-visible': index === 0 && !isPriorityPlayer,
                'locked': orderLocked
              }"
              @click="!orderLocked && moveCardInHand(index)"
            >
              <span class="card-icon">{{ card.icon }}</span>
              <span class="card-name">{{ card.name }}</span>
            </div>
          </div>
          <div v-if="!orderLocked" class="ordering-hint">点击卡牌移至首位</div>
          <button v-if="!orderLocked" class="btn btn-confirm" @click="confirmHandOrder">
            确认顺序
          </button>
          <div v-else class="ordering-hint">顺序已锁定</div>
        </div>

        <!-- 出牌阶段 -->
        <div v-else-if="gameState.phase === 'playing'" class="card-playing">
          <!-- 出牌展示区：显示双方已打出的牌（左侧己方，右侧对手） -->
          <div class="played-cards-area" ref="playedCardsAreaRef">
            <div class="played-cards-row">
              <!-- 左侧：己方出牌区 -->
              <div class="player-played-cards my-area" ref="myPlayedAreaRef">
                <span class="player-label">你</span>
                <div class="cards-row">
                  <div 
                    v-for="(card, idx) in playedCardsDisplay.my" 
                    :key="idx"
                    class="card played-card my-card"
                    :class="{ 'current-playing': idx === currentPlayIndex && isMyTurn }"
                  >
                    <span class="card-icon">{{ card.icon }}</span>
                    <span class="card-name">{{ card.name }}</span>
                  </div>
                  <div v-for="i in (3 - playedCardsDisplay.my.length)" :key="'empty-my-' + i" class="card empty-card">
                    <span class="card-icon">?</span>
                  </div>
                </div>
              </div>
              <div class="vs-divider">VS</div>
              <!-- 右侧：对手出牌区 -->
              <div class="player-played-cards opponent-area" ref="opponentPlayedAreaRef">
                <span class="player-label">对手</span>
                <div class="cards-row">
                  <div 
                    v-for="(card, idx) in playedCardsDisplay.opponent" 
                    :key="idx"
                    class="card played-card opponent-card"
                    :class="{ 'current-playing': idx === currentPlayIndex && !isMyTurn }"
                  >
                    <span class="card-icon">{{ card.icon }}</span>
                    <span class="card-name">{{ card.name }}</span>
                  </div>
                  <div v-for="i in (3 - playedCardsDisplay.opponent.length)" :key="'empty-op-' + i" class="card empty-card">
                    <span class="card-icon">?</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <p class="cards-tip">{{ isMyTurn ? '你的回合！' : '等待对方出牌...' }}</p>
          <div class="hand-cards" ref="handCardsRef">
            <div 
              v-for="(card, index) in myHandCards" 
              :key="index"
              class="card"
              :class="{ 
                'current-card': index === currentPlayIndex,
                'played': index < currentPlayIndex,
                'disabled': !isMyTurn
              }"
              :ref="el => { if (index === currentPlayIndex) currentHandCardRef = el }"
            >
              <span class="card-icon">{{ card.icon }}</span>
              <span class="card-name">{{ card.name }}</span>
              <span v-if="index < currentPlayIndex" class="played-badge">已出</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 消息提示 -->
      <div v-if="gameMessage" class="game-message" :class="messageType">
        {{ gameMessage }}
      </div>
      
      <!-- 飞牌动画层 -->
      <div v-if="flyingCard" class="flying-card-overlay">
        <div 
          class="flying-card" 
          :class="[flyingCard.direction, flyingCard.isMyCard ? 'my-card' : 'opponent-card']"
          :style="flyingCardStyle"
        >
          <span class="card-icon">{{ flyingCard.card.icon }}</span>
          <span class="card-name">{{ flyingCard.card.name }}</span>
        </div>
      </div>
    </div>

    <!-- 游戏结束界面 -->
    <div v-else class="game-end-screen">
      <!-- 对手断开连接提示 -->
      <div v-if="opponentDisconnected" class="disconnect-notice">
        <p>⚠️ {{ disconnectMessage }}</p>
        <p>正在返回开始页面...</p>
      </div>
      
      <template v-else>
        <h1 class="result-title">
          {{ gameState.winner === socketId ? '🎉 胜利！' : '😢 失败' }}
        </h1>
        <p v-if="gameState.winner === 'draw'">平局！</p>
        
        <!-- 再来一局请求状态 -->
        <div v-if="rematchStatus === 'sent'" class="rematch-waiting">
          <p>已发送再来一局请求，等待对方确认...</p>
          <div class="loading-spinner"></div>
        </div>
        
        <div v-else-if="rematchStatus === 'received'" class="rematch-request">
          <p>对方想要再来一局</p>
          <div class="rematch-buttons">
            <button @click="acceptRematch" class="btn btn-success">同意</button>
            <button @click="rejectRematch" class="btn btn-danger">拒绝</button>
          </div>
        </div>
        
        <div v-else-if="rematchStatus === 'rejected'" class="rematch-rejected">
          <p>对方拒绝了再来一局请求</p>
        </div>
        
        <div v-else class="game-end-buttons">
          <button @click="requestRematch" class="btn btn-primary">再来一局</button>
          <button @click="backToHome" class="btn">回到开始页面</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import GameBoard from './components/GameBoard.vue'
import AvatarIcon from './components/AvatarIcon.vue'
import AvatarSelector from './components/AvatarSelector.vue'
import { GAME_CONFIG } from '../../shared/constants.js'
import { getServerUrl } from './config.js'
import audioManager from './utils/audioManager'

export default {
  name: 'App',
  components: {
    GameBoard,
    AvatarIcon,
    AvatarSelector
  },
  setup() {
    // Socket连接
    const socket = ref(null)
    const socketId = ref('')
    const connectionStatus = ref('正在连接...')
    
    // 房间
    const roomCode = ref('')
    const currentRoom = ref('')
    const isPlayer1 = ref(true)
    const errorMessage = ref('')
    
    // 游戏状态
    const gameState = ref({
      phase: 'connecting',
      currentRound: 1,
      map: { size: GAME_CONFIG.MAP_SIZE, obstacles: [] },
      players: [
        { id: '', position: { x: 0, y: 0 }, hp: GAME_CONFIG.INITIAL_HP, handCards: [] },
        { id: '', position: { x: 6, y: 6 }, hp: GAME_CONFIG.INITIAL_HP, handCards: [] }
      ],
      turnIndex: 0,
      winner: null,
      isPlayer1Priority: true
    })
    
    // 卡牌相关
    const currentCards = ref([])
    const selectedCards = ref([])
    const myHandCards = ref([])
    const opponentFirstCard = ref(null)
    const currentPlayIndex = ref(0)
    // 后手玩家选择查看先手手牌相关
    const chooseOpponentCardVisible = ref(false)
    const opponentFirstAndLastCard = ref({ firstCard: null, lastCard: null })
    const viewedOpponentCard = ref(null)
    const viewedCardChoice = ref(null) // 'first' or 'last'
    const isPriorityReceived = ref(false)  // 是否收到优先玩家的牌
    const orderLocked = ref(false)  // 顺序是否已锁定
    
    // 地图配置相关
    const mapSizeOptions = ref(GAME_CONFIG.MAP_SIZE_OPTIONS)
    const selectedMapSize = ref(null)
    const selectedFogEnabled = ref(true)  // 默认选择"有"迷雾
    const creatorId = ref('')
    const isCreator = computed(() => {
      const result = socketId.value === creatorId.value
      console.log('[客户端] isCreator计算:', { socketId: socketId.value, creatorId: creatorId.value, result })
      return result
    })
    
    // 正在打出的牌（用于显示动画）
    const playingCard = ref(null)
    
    // 飞牌动画状态（纯视觉效果）
    const flyingCard = ref(null)
    
    // 计时器
    const selectTimer = ref(30)
    const orderTimer = ref(30)
    let timerInterval = null
    
    // 消息
    const gameMessage = ref('')
    const messageType = ref('info')
    
    // 游戏板组件引用
    const gameBoardRef = ref(null)
    
    // 出牌动画相关DOM引用
    const handCardsRef = ref(null)
    const currentHandCardRef = ref(null)
    const playedCardsAreaRef = ref(null)
    const myPlayedAreaRef = ref(null)  // 己方出牌区引用
    const opponentPlayedAreaRef = ref(null)  // 对手出牌区引用
    
    // 游戏规则弹窗
    const showRules = ref(false)
    const dontShowRules = ref(localStorage.getItem('dontShowRules') === 'true')
    
    // 再来一局请求状态
    const rematchStatus = ref(null) // null | 'sent' | 'received' | 'rejected'
    const opponentDisconnected = ref(false)
    const disconnectMessage = ref('')
    
    // 新回合提示状态
    const showRoundTransition = ref(false)
    const nextRound = ref(1)
    
    // 地图名称展示状态
    const showMapName = ref(false)
    
    // 地图主题
    const currentTheme = ref(null)
    
    // 角色形象相关
    const myAvatarId = ref(localStorage.getItem('myAvatarId') || 'male_knight')
    const showAvatarSelector = ref(false)
    const player1AvatarId = ref(null)
    const player2AvatarId = ref(null)
    
    // 全屏背景样式 - 根据地图主题变化
    const screenBgStyle = computed(() => {
      // 主界面（连接、等待、配置阶段）永远使用蓝紫色渐变
      const mainMenuPhases = ['connecting', 'waiting', 'configuring']
      if (mainMenuPhases.includes(gameState.value.phase) || !currentTheme.value) {
        return {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }
      }
      return {
        background: currentTheme.value.screenBg,
        position: 'relative'
      }
    })
    
    const closeRules = () => {
      if (dontShowRules.value) {
        localStorage.setItem('dontShowRules', 'true')
      }
      showRules.value = false
    }
    
    // 复制房间号
    const copySuccess = ref(false)
    const copyRoomCode = () => {
      navigator.clipboard.writeText(currentRoom.value).then(() => {
        copySuccess.value = true
        setTimeout(() => {
          copySuccess.value = false
        }, 2000)
      })
    }
    
    // 计算属性
    const isPriorityPlayer = computed(() => {
      const playerIndex = isPlayer1.value ? 0 : 1
      // 如果是优先玩家返回true
      return (gameState.value.isPlayer1Priority && playerIndex === 0) || 
             (!gameState.value.isPlayer1Priority && playerIndex === 1)
    })
    
    const isMyTurn = computed(() => {
      if (gameState.value.phase !== 'playing') return false
      const playerIndex = isPlayer1.value ? 0 : 1
      const priorityIndex = gameState.value.isPlayer1Priority ? 0 : 1
      const turnInPair = gameState.value.turnIndex % 2
      return playerIndex === (turnInPair === 0 ? priorityIndex : 1 - priorityIndex)
    })
    
const currentTurn = computed(() => {
  const turn = Math.floor(gameState.value.turnIndex / 2) + 1
  return Math.min(turn, 3)  // 最大显示3轮
})
    
    // 飞牌动画样式 - 动态计算目标位置
    const flyingCardStyle = computed(() => {
      if (!flyingCard.value) return {}
      
      // 获取目标区域 - 己方牌飞向左侧，对手牌飞向右侧
      const targetRef = flyingCard.value.isMyCard ? myPlayedAreaRef.value : opponentPlayedAreaRef.value
      
      if (!targetRef) {
        // 如果没有目标引用，使用默认值
        return {
          '--fly-direction': flyingCard.value.isMyCard ? '-150px' : '150px'
        }
      }
      
      // 计算目标位置相对于屏幕中心的位置
      const rect = targetRef.getBoundingClientRect()
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      
      const targetX = rect.left + rect.width / 2 - centerX
      const targetY = rect.top + rect.height / 2 - centerY
      
      return {
        '--fly-direction': `${targetX}px`,
        '--target-y': `${targetY}px`
      }
    })
    
    // 出牌展示：获取双方已打出的牌（左侧为己方，右侧为对手）
    const playedCardsDisplay = computed(() => {
      const myPlayerIndex = isPlayer1.value ? 0 : 1
      const priorityIndex = gameState.value.isPlayer1Priority ? 0 : 1
      const myCards = []
      const opponentCards = []
      
      // 遍历当前已出牌数
      const totalPlayed = gameState.value.turnIndex
      for (let i = 0; i < totalPlayed; i++) {
        const isPriorityTurn = i % 2 === 0  // 偶数索引是先手玩家出牌
        const cardIndex = Math.floor(i / 2)
        
        if (isPriorityTurn) {
          // 先手玩家的牌
          const card = gameState.value.players[priorityIndex]?.handCards?.[cardIndex]
          if (card) {
            // 判断这张牌是己方还是对手的
            if (priorityIndex === myPlayerIndex) {
              myCards.push(card)
            } else {
              opponentCards.push(card)
            }
          }
        } else {
          // 后手玩家的牌
          const nonPriorityPlayerIndex = 1 - priorityIndex
          const card = gameState.value.players[nonPriorityPlayerIndex]?.handCards?.[cardIndex]
          if (card) {
            // 判断这张牌是己方还是对手的
            if (nonPriorityPlayerIndex === myPlayerIndex) {
              myCards.push(card)
            } else {
              opponentCards.push(card)
            }
          }
        }
      }
      
      // 如果有正在打出的牌，也要显示
      if (playingCard.value) {
        const isPriorityTurn = playingCard.value.turnIndex % 2 === 0
        const playerIndexOfPlayingCard = isPriorityTurn ? priorityIndex : (1 - priorityIndex)
        
        if (playerIndexOfPlayingCard === myPlayerIndex) {
          myCards.push(playingCard.value.card)
        } else {
          opponentCards.push(playingCard.value.card)
        }
      }
      
      return {
        my: myCards,
        opponent: opponentCards
      }
    })
    
    // Socket事件处理
    const initSocket = () => {
      const serverUrl = getServerUrl()
      console.log('[客户端] 正在连接到:', serverUrl)
      
      socket.value = io(serverUrl, {
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      })
      
      socket.value.on('connect', () => {
        socketId.value = socket.value.id
        connectionStatus.value = '已连接'
        errorMessage.value = ''
        console.log('[客户端] 连接成功，socket ID:', socket.value.id)
      })
      
      socket.value.on('connect_error', (error) => {
        console.error('[客户端] 连接错误:', error)
        errorMessage.value = '无法连接到服务器，请确保服务器已启动'
        connectionStatus.value = '连接失败'
      })
      
      socket.value.on('disconnect', (reason) => {
        console.log('[客户端] 断开连接:', reason)
        connectionStatus.value = '已断开连接'
      })
      
      socket.value.on('error', (error) => {
        console.error('[客户端] Socket错误:', error)
      })
      
      socket.value.on('room_created', (room) => {
        currentRoom.value = room
        gameState.value.phase = 'waiting'
        audioManager.playClick()
      })
      
      socket.value.on('room_joined', (data) => {
        currentRoom.value = data.room
        isPlayer1.value = data.isPlayer1
        gameState.value.phase = 'waiting'
        audioManager.playDing()
      })
      
      socket.value.on('room_error', (msg) => {
        errorMessage.value = msg
      })
      
      // 进入地图配置阶段
      socket.value.on('enter_configuring', (data) => {
        console.log('[客户端] 进入地图配置阶段:', data)
        gameState.value.phase = data.phase
        mapSizeOptions.value = data.mapSizeOptions
        creatorId.value = data.creatorId
        selectedMapSize.value = null
      })
      
      // 地图配置完成
      socket.value.on('map_configured', (data) => {
        console.log('[客户端] 地图配置完成:', data)
        gameMessage.value = `地图大小已设置为 ${data.mapSize}×${data.mapSize}`
        messageType.value = 'success'
        setTimeout(() => {
          gameMessage.value = ''
        }, 2000)
      })
      
      socket.value.on('game_start', (data) => {
        console.log('[客户端] 收到game_start:', data)
        gameState.value = { 
          ...gameState.value, 
          ...data, 
          phase: data.phase || 'dealing' 
        }
        // 保存玩家形象ID
        if (data.players && data.players[0]) {
          player1AvatarId.value = data.players[0].avatarId
        }
        if (data.players && data.players[1]) {
          player2AvatarId.value = data.players[1].avatarId
        }
        // 保存主题数据并显示地图名称
        if (data.theme) {
          currentTheme.value = data.theme
          console.log('[客户端] 当前地图主题:', data.theme.nameCn)
          // 显示地图名称界面
          showMapName.value = true
          setTimeout(() => {
            showMapName.value = false
          }, 2500)
        }
        // 播放背景音乐
        audioManager.playBgmusic()
      })
      
      // 处理发牌事件
      socket.value.on('deal_cards', (data) => {
        console.log('[客户端] 收到deal_cards:', data)
        currentCards.value = data.cards
        selectedCards.value = []
        opponentFirstCard.value = null  // 初始为null，后手会在先手选完后收到
        isPriorityReceived.value = data.isPriority
        
        // 播放发牌音效
        audioManager.playCardslide()
        
        // 第一回合显示提示（在地图名称显示完成后）
        if (gameState.value.currentRound === 1) {
          nextRound.value = 1
          // 如果地图名称正在显示，等待它完成后再显示回合提示
          if (showMapName.value) {
            // 延迟显示，等待地图名称显示完成（2.5秒）+ 一点缓冲
            setTimeout(() => {
              showRoundTransition.value = true
              // 播放剑碰撞音效
              audioManager.playSwordCrash()
              setTimeout(() => {
                showRoundTransition.value = false
              }, 1500)
            }, 2800)  // 地图名称显示2.5秒 + 0.3秒缓冲
          } else {
            // 地图名称已经显示完毕，直接显示回合提示
            showRoundTransition.value = true
            // 播放剑碰撞音效
            audioManager.playSwordCrash()
            setTimeout(() => {
              showRoundTransition.value = false
            }, 1500)
          }
        }
        
        // 确定当前阶段
        if (data.isPriority) {
          gameState.value.phase = 'selecting_priority'
          startSelectTimer()
        } else {
          // 后手玩家收到牌后进入等待阶段，不开始计时
          gameState.value.phase = 'waiting_selecting'
          // 不启动计时器，等待先手选完后会收到opponent_first_card_ready
        }
      })
      
      // 先手玩家确认顺序完成，通知后手可以开始选牌了
      socket.value.on('opponent_first_card_ready', (data) => {
        console.log('[客户端] 收到opponent_first_card_ready:', data)
        opponentFirstCard.value = data.opponentFirstCard
        // 后手收到此消息后进入 selecting_normal 阶段，开始选牌
        gameState.value.phase = 'selecting_normal'
        startSelectTimer()
      })
      
      // 进入顺序调整阶段
      socket.value.on('enter_ordering_phase', (data) => {
        console.log('[客户端] 进入顺序调整阶段:', data)
        myHandCards.value = data.handCards
        opponentFirstCard.value = data.opponentFirstCard
        selectedCards.value = []
        orderLocked.value = false
        
        if (data.isPriority) {
          gameState.value.phase = 'ordering_priority'
        } else {
          gameState.value.phase = 'ordering_normal'
        }
        startOrderTimer()
      })
      
      // 后手玩家选牌完成，进入顺序调整阶段
      socket.value.on('normal_cards_selected', (data) => {
        console.log('[客户端] 后手玩家选牌完成，进入顺序调整', data)
        stopTimer()
        // 设置后手玩家的手牌
        myHandCards.value = data.handCards || []
        opponentFirstCard.value = data.opponentFirstCard || null
        selectedCards.value = []
        orderLocked.value = false
        gameState.value.phase = 'ordering_normal'
        startOrderTimer()
      })
      
      // 先手玩家可以看到后手玩家的第一张牌
      socket.value.on('opponent_first_card_visible', (data) => {
        console.log('[客户端] 收到对手第一张牌:', data)
        // 只有先手玩家需要更新这个值（用于显示给后手玩家参考）
        if (isPriorityPlayer.value) {
          opponentFirstCard.value = data.opponentFirstCard
        }
      })
      
      // 后手玩家选择查看先手的第一张或最后一张牌
      socket.value.on('choose_opponent_card_to_view', (data) => {
        console.log('[客户端] 收到选择查看对手手牌:', data)
        opponentFirstAndLastCard.value = {
          firstCard: data.firstCard,
          lastCard: data.lastCard
        }
        chooseOpponentCardVisible.value = true
      })
      
      // 后手玩家查看的牌已确定，进入选牌阶段
      socket.value.on('opponent_card_viewed', (data) => {
        console.log('[客户端] 确认查看的对手手牌:', data)
        viewedOpponentCard.value = data.viewedCard
        viewedCardChoice.value = data.choice
        chooseOpponentCardVisible.value = false
        // 进入选牌阶段
        gameState.value.phase = 'selecting_normal'
        startSelectTimer()
      })
      
      // 先手玩家收到通知：对方选择查看了你的第几张牌
      socket.value.on('opponent_viewed_card_info', (data) => {
        console.log('[客户端] 对方选择查看的牌:', data)
        const cardText = data.choice === 'first' ? '第一张' : '最后一张'
        gameMessage.value = `对方选择查看了你的${cardText}手牌`
        messageType.value = 'info'
        setTimeout(() => {
          gameMessage.value = ''
        }, 3000)
      })
      
      // 所有顺序确认完毕，开始出牌
      socket.value.on('all_orders_complete', (data) => {
        console.log('[客户端] 所有顺序确认完毕，开始出牌')
        stopTimer()
        orderLocked.value = true
        gameState.value = { ...gameState.value, ...data }
        gameState.value.phase = 'playing'
        gameState.value.turnIndex = 0
        currentPlayIndex.value = 0
        
        // 清空上一回合的出牌动画状态
        playingCard.value = null
        flyingCard.value = null
        
        // 根据是玩家1还是玩家2设置自己的手牌
        if (isPlayer1.value) {
          myHandCards.value = data.player1Hand || myHandCards.value
        } else {
          myHandCards.value = data.player2Hand || myHandCards.value
        }
        
        // 清空对手第一张牌的显示
        opponentFirstCard.value = null
      })
      
      // 收到通知可以出牌
      socket.value.on('your_turn_to_play', () => {
        console.log('[客户端] 收到出牌通知')
        setTimeout(() => {
          playCard()
        }, 500)
      })
      
      // 牌被打出（显示动画，还没执行效果）
      socket.value.on('card_played', (data) => {
        console.log('[客户端] 牌被打出:', data)
        
        // 播放出牌音效
        audioManager.playPickupcard()
        
        // 判断是谁打出的牌，设置飞牌方向
        const myPlayerIndex = isPlayer1.value ? 0 : 1
        const isMyCard = data.playerIndex === myPlayerIndex
        const isPriorityTurn = data.turnIndex % 2 === 0
        
        // 启动飞牌动画（纯视觉效果）
        // 先在中央展示，然后飞到出牌区
        flyingCard.value = {
          card: data.card,
          direction: isMyCard ? 'from-bottom' : 'from-top',
          isMyCard: isMyCard,
          isPriorityTurn: isPriorityTurn
        }
        
        // 更新当前出牌索引显示
        currentPlayIndex.value = data.cardIndex
        
        // 动画分为两个阶段：
        // 1. 中央展示阶段（0-1秒）
        // 2. 飞向出牌区阶段（1-1.5秒）
        // 在1秒后，将牌显示在出牌区
        setTimeout(() => {
          // 设置正在打出的牌，用于显示在出牌区
          playingCard.value = {
            playerIndex: data.playerIndex,
            card: data.card,
            cardIndex: data.cardIndex,
            turnIndex: data.turnIndex
          }
        }, 1000)
        
        // 动画持续1.5秒后清除飞牌动画
        setTimeout(() => {
          flyingCard.value = null
        }, 1500)
      })
      
      // 回合状态更新（效果已执行，下一个玩家出牌）
      socket.value.on('turn_played', (data) => {
        console.log('[客户端] 出牌更新:', data)
        // 清除正在打出的牌动画
        playingCard.value = null
        gameState.value = { ...gameState.value, ...data }
        currentPlayIndex.value = Math.floor(data.turnIndex / 2)
        
        // 如果是自己的回合，自动出牌
        if (isMyTurn.value) {
          setTimeout(() => {
            playCard()
          }, 500)
        }
      })
      
      // 攻击特效
      socket.value.on('attack_effect', (data) => {
        console.log('[客户端] 攻击特效:', data)
        // 播放攻击音效
        audioManager.playAttack()
        // 将特效传递给GameBoard组件
        if (gameBoardRef.value) {
          gameBoardRef.value.setAttackEffect(data)
        }
      })
      
      // 移动特效
      socket.value.on('move_effect', (data) => {
        console.log('[客户端] 移动特效:', data)
        // 播放移动音效
        audioManager.playSlide()
        if (gameBoardRef.value) {
          gameBoardRef.value.setMoveEffect(data)
        }
      })
      
      // 传送特效
      socket.value.on('teleport_effect', (data) => {
        console.log('[客户端] 传送特效:', data)
        if (gameBoardRef.value) {
          gameBoardRef.value.setTeleportEffect(data)
        }
      })
      
      // 防御激活特效
      socket.value.on('defense_activated', (data) => {
        console.log('[客户端] 防御激活:', data)
        // 播放防御牌打出音效
        audioManager.playDefense()
        if (gameBoardRef.value) {
          gameBoardRef.value.setDefenseActivated(data)
        }
      })
      
      // 防御破碎特效
      socket.value.on('defense_broken', (data) => {
        console.log('[客户端] 防御破碎:', data)
        // 播放防御成功音效
        audioManager.playSuccessfulDefense()
        if (gameBoardRef.value) {
          gameBoardRef.value.setDefenseBroken(data)
        }
      })
      
      // 防御失效特效（打出非防御牌时）
      socket.value.on('defense_expired', (data) => {
        console.log('[客户端] 防御失效:', data)
        if (gameBoardRef.value) {
          gameBoardRef.value.clearDefense()
        }
      })
      
      // 探查效果
      socket.value.on('scout_effect', (data) => {
        console.log('[客户端] 探查效果:', data)
        if (gameBoardRef.value) {
          gameBoardRef.value.setScoutEffect(data)
        }
      })
      
      socket.value.on('game_message', (data) => {
        gameMessage.value = data.message
        
        // 根据玩家索引区分敌我颜色
        // 如果消息带有 playerIndex，判断是自己的操作还是对手的操作
        if (data.playerIndex !== undefined) {
          const myPlayerIndex = isPlayer1.value ? 0 : 1
          if (data.playerIndex === myPlayerIndex) {
            // 自己的操作 - 绿色
            messageType.value = 'my-action'
          } else {
            // 对手的操作 - 红色
            messageType.value = 'opponent-action'
          }
        } else {
          // 系统消息 - 使用服务端指定的类型
          messageType.value = data.type || 'info'
        }
        
        // 游戏结束相关的消息显示更长时间
        const duration = data.message.includes('击败') || data.message.includes('平局') ? 4500 : 3000
        setTimeout(() => {
          gameMessage.value = ''
        }, duration)
      })
      
      // 私密消息（只给操作者显示，不暴露给对手）
      socket.value.on('private_message', (data) => {
        console.log('[客户端] 收到私密消息:', data.message)
        gameMessage.value = data.message
        messageType.value = 'private'  // 使用特殊样式区分私密消息
        
        setTimeout(() => {
          gameMessage.value = ''
        }, 2500)
      })
      
      socket.value.on('round_end', (data) => {
        console.log('[客户端] 回合结束:', data)
        
        // 显示新回合提示
        nextRound.value = (data.currentRound || gameState.value.currentRound + 1)
        showRoundTransition.value = true
        
        // 播放回合切换音效（剑碰撞声）
        audioManager.playSwordCrash()
        
        // 1.5秒后隐藏提示
        setTimeout(() => {
          showRoundTransition.value = false
        }, 1500)
        
        gameState.value = { ...gameState.value, ...data }
        myHandCards.value = []
        currentCards.value = []
        opponentFirstCard.value = null
        currentPlayIndex.value = 0
        // 清空出牌动画状态
        playingCard.value = null
        flyingCard.value = null
        // 清除护盾特效（回合结束后防御状态失效）
        if (gameBoardRef.value) {
          gameBoardRef.value.clearDefense()
          // 清除探查效果（回合结束后探查效果失效）
          gameBoardRef.value.clearScoutEffect()
        }
      })
      
      // 玩家死亡事件（攻击命中时立即播放死亡音效）
      socket.value.on('player_died', (data) => {
        console.log('[客户端] 玩家死亡:', data)
        // 播放死亡音效
        audioManager.playHitAndDie()
      })
      
      socket.value.on('game_end', (data) => {
        console.log('[客户端] 游戏结束:', data)
        gameState.value = { ...gameState.value, ...data, phase: 'game_end' }
        stopTimer()
        // 停止背景音乐，播放胜利/失败音效
        audioManager.stopBgmusic()
        if (data.winner === socketId.value) {
          audioManager.playVictory()
        } else if (data.winner !== 'draw') {
          audioManager.playFail()
        }
      })
      
      // play_again 事件已改为 enter_configuring，由服务器发送新地图配置阶段
      socket.value.on('play_again', () => {
        console.log('[客户端] 收到play_again，等待enter_configuring事件')
        // 清理本地状态
        myHandCards.value = []
        currentCards.value = []
        opponentFirstCard.value = null
        currentPlayIndex.value = 0
        selectedMapSize.value = null
        rematchStatus.value = null
      })
      
      // 对手断开连接
      socket.value.on('opponent_disconnected', (data) => {
        console.log('[客户端] 对手断开连接:', data)
        
        // 先将游戏状态切换到结束界面，这样才能显示断开连接提示
        gameState.value.phase = 'game_end'
        
        opponentDisconnected.value = true
        disconnectMessage.value = data.message || '对手已断开连接'
        
        // 显示提示后返回初始页面
        setTimeout(() => {
          backToHome()
        }, 3000)  // 延长到3秒让玩家有时间看到提示
      })
      
      // 再来一局请求已发送
      socket.value.on('rematch_request_sent', () => {
        console.log('[客户端] 再来一局请求已发送')
        rematchStatus.value = 'sent'
      })
      
      // 收到再来一局请求
      socket.value.on('rematch_requested', (data) => {
        console.log('[客户端] 收到再来一局请求:', data)
        rematchStatus.value = 'received'
      })
      
      // 再来一局被接受
      socket.value.on('rematch_accepted', () => {
        console.log('[客户端] 再来一局被接受')
        rematchStatus.value = null
        // 清理状态
        myHandCards.value = []
        currentCards.value = []
        opponentFirstCard.value = null
        currentPlayIndex.value = 0
        selectedMapSize.value = null
      })
      
      // 再来一局被拒绝
      socket.value.on('rematch_rejected', () => {
        console.log('[客户端] 再来一局被拒绝')
        rematchStatus.value = 'rejected'
        setTimeout(() => {
          rematchStatus.value = null
        }, 3000)
      })
      
      // 拒绝确认
      socket.value.on('rematch_reject_confirmed', () => {
        console.log('[客户端] 拒绝已确认')
        rematchStatus.value = null
      })
    }
    
    // 房间操作
    const createRoom = () => {
      audioManager.playClick()
      socket.value.emit('create_room', { avatarId: myAvatarId.value })
    }
    
    const joinRoom = () => {
      if (!roomCode.value.trim()) {
        errorMessage.value = '请输入房间号'
        return
      }
      audioManager.playClick()
      socket.value.emit('join_room', { roomCode: roomCode.value, avatarId: myAvatarId.value })
    }
    
    // 卡牌选择
    const toggleCardSelection = (index) => {
      // 只有在选择阶段才能选择
      if (gameState.value.phase !== 'selecting_priority' && gameState.value.phase !== 'selecting_normal') return
      
      // 播放点击音效
      audioManager.playClick()
      // 只有当前玩家是优先/非优先玩家时才能选择
      if (gameState.value.phase === 'selecting_priority' && !isPriorityPlayer.value) return
      if (gameState.value.phase === 'selecting_normal' && isPriorityPlayer.value) return
      
      const idx = selectedCards.value.indexOf(index)
      if (idx > -1) {
        selectedCards.value.splice(idx, 1)
      } else if (selectedCards.value.length < 3) {
        selectedCards.value.push(index)
      }
    }
    
    const confirmCardSelection = () => {
      if (selectedCards.value.length !== 3) return
      // 播放点击音效
      audioManager.playClick()
      const selected = selectedCards.value.map(i => currentCards.value[i])
      console.log('[客户端] 确认选牌:', selected)
      socket.value.emit('select_cards', selected)
    }
    
    // 手牌顺序调整
    const moveCardInHand = (index) => {
      // 已经锁定则不能调整
      if (orderLocked.value) return
      if (index === 0) return
      // 播放点击音效
      audioManager.playClick()
      const card = myHandCards.value.splice(index, 1)[0]
      myHandCards.value.unshift(card)
    }
    
    const confirmHandOrder = () => {
      // 防止重复确认
      if (orderLocked.value) return
      
      // 播放点击音效
      audioManager.playClick()
      
      console.log('[客户端] 确认顺序:', myHandCards.value)
      // 立即停止计时器
      stopTimer()
      // 立即锁定顺序，防止再次调整
      orderLocked.value = true
      socket.value.emit('confirm_order', myHandCards.value)
    }
    
    // 出牌
    const playCard = () => {
      console.log('[客户端] 出牌')
      socket.value.emit('play_card')
    }
    
    // 计时器
    const startSelectTimer = () => {
      selectTimer.value = Math.ceil(GAME_CONFIG.SELECT_TIME / 1000)
      // 重置倒计时音效状态
      audioManager.resetCountdown()
      stopTimer()
      timerInterval = setInterval(() => {
        if (selectTimer.value <= 0) {
          stopTimer()
          // 倒计时结束，自动处理选牌
          if (currentCards.value.length >= 3) {
            // 如果玩家已选满3张，直接确认
            if (selectedCards.value.length === 3) {
              confirmCardSelection()
            } else {
              // 如果玩家选了1-2张，补齐到3张后确认
              while (selectedCards.value.length < 3) {
                for (let j = 0; j < currentCards.value.length; j++) {
                  if (!selectedCards.value.includes(j)) {
                    selectedCards.value.push(j)
                    break
                  }
                }
                // 如果玩家一张都没选，自动选择前三张(索引0,1,2)
                if (selectedCards.value.length === 0) {
                  selectedCards.value = [0, 1, 2]
                  break
                }
              }
              confirmCardSelection()
            }
          }
        } else {
          selectTimer.value--
          // 倒计时3秒时播放音效
          if (selectTimer.value === 3) {
            audioManager.playCountdown3s()
          }
        }
      }, 1000)
    }
    
    const startOrderTimer = () => {
      orderTimer.value = Math.ceil(GAME_CONFIG.ORDER_TIME / 1000)
      // 重置倒计时音效状态
      audioManager.resetCountdown()
      console.log('[客户端] 启动顺序计时器:', orderTimer.value, '秒')
      stopTimer()
      timerInterval = setInterval(() => {
        if (orderTimer.value <= 0) {
          stopTimer()
          console.log('[客户端] 顺序计时器到0，自动确认')
          confirmHandOrder()
        } else {
          orderTimer.value--
          // 倒计时3秒时播放音效
          if (orderTimer.value === 3) {
            audioManager.playCountdown3s()
          }
        }
      }, 1000)
    }
    
    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }
    
    // 回到开始页面
    const backToHome = () => {
      console.log('[客户端] 回到开始页面')
      
      // 停止计时器
      stopTimer()
      
      // 离开当前房间（但不断开socket连接）
      if (socket.value && currentRoom.value) {
        socket.value.emit('leave_room', currentRoom.value)
      }
      
      // 重置所有状态
      gameState.value = {
        phase: 'connecting',
        currentRound: 1,
        map: { size: GAME_CONFIG.MAP_SIZE, obstacles: [] },
        players: [
          { id: '', position: { x: 0, y: 0 }, hp: GAME_CONFIG.INITIAL_HP, handCards: [] },
          { id: '', position: { x: 6, y: 6 }, hp: GAME_CONFIG.INITIAL_HP, handCards: [] }
        ],
        turnIndex: 0,
        winner: null,
        isPlayer1Priority: true
      }
      myHandCards.value = []
      currentCards.value = []
      opponentFirstCard.value = null
      currentPlayIndex.value = 0
      selectedMapSize.value = null
      rematchStatus.value = null
      opponentDisconnected.value = false
      disconnectMessage.value = ''
      currentRoom.value = ''
      roomCode.value = ''
      isPlayer1.value = true
      errorMessage.value = ''
      orderLocked.value = false
      chooseOpponentCardVisible.value = false
      viewedCardChoice.value = null
      viewedOpponentCard.value = null
      opponentFirstAndLastCard.value = { firstCard: null, lastCard: null }
      playingCard.value = null
      flyingCard.value = null
      // 重置地图主题，确保主界面背景恢复蓝紫色
      currentTheme.value = null
    }
    
    // 请求再来一局
    const requestRematch = () => {
      console.log('[客户端] 请求再来一局')
      socket.value.emit('request_rematch')
    }
    
    // 接受再来一局
    const acceptRematch = () => {
      console.log('[客户端] 接受再来一局')
      socket.value.emit('accept_rematch')
    }
    
    // 拒绝再来一局
    const rejectRematch = () => {
      console.log('[客户端] 拒绝再来一局')
      socket.value.emit('reject_rematch')
    }
    
    // 再来一局（旧的直接开始，保留兼容）
    const playAgain = () => {
      requestRematch()
    }
    
    // 地图配置
    const selectMapSize = (size) => {
      selectedMapSize.value = size
    }
    
    const confirmMapSize = () => {
      if (!selectedMapSize.value) return
      console.log('[客户端] 确认地图配置:', selectedMapSize.value, '迷雾:', selectedFogEnabled.value)
      socket.value.emit('map_size_selected', { 
        mapSize: selectedMapSize.value, 
        fogEnabled: selectedFogEnabled.value 
      })
    }
    
    // 形象选择相关
    const openAvatarSelector = () => {
      showAvatarSelector.value = true
    }
    
    const onAvatarSelected = (avatarId) => {
      myAvatarId.value = avatarId
      localStorage.setItem('myAvatarId', avatarId)
      showAvatarSelector.value = false
    }
    
    const closeAvatarSelector = () => {
      showAvatarSelector.value = false
    }
    
    // 选择查看对手手牌
    const selectCardChoice = (choice) => {
      viewedCardChoice.value = choice
      // 播放点击音效
      audioManager.playClick()
    }
    
    const confirmCardChoice = () => {
      if (!viewedCardChoice.value) return
      // 播放点击音效
      audioManager.playClick()
      console.log('[客户端] 选择查看对手的', viewedCardChoice.value, '牌')
      
      // 设置要显示的手牌
      if (viewedCardChoice.value === 'first') {
        viewedOpponentCard.value = opponentFirstAndLastCard.value.firstCard
        opponentFirstCard.value = opponentFirstAndLastCard.value.firstCard
      } else {
        viewedOpponentCard.value = opponentFirstAndLastCard.value.lastCard
        opponentFirstCard.value = opponentFirstAndLastCard.value.lastCard
      }
      
      // 发送选择到服务器
      socket.value.emit('view_opponent_card', viewedCardChoice.value)
    }
    
    onMounted(() => {
      initSocket()
      // 首次进入时显示规则（如果用户没有勾选"不再显示"）
      if (!dontShowRules.value) {
        showRules.value = true
      }
    })
    
    onUnmounted(() => {
      stopTimer()
      if (socket.value) {
        socket.value.disconnect()
      }
    })
    
    return {
      socket,
      socketId,
      connectionStatus,
      roomCode,
      currentRoom,
      isPlayer1,
      errorMessage,
      gameState,
      currentCards,
      selectedCards,
      myHandCards,
      opponentFirstCard,
      currentPlayIndex,
      selectTimer,
      orderTimer,
      gameMessage,
      messageType,
      isPriorityPlayer,
      isMyTurn,
      currentTurn,
      createRoom,
      joinRoom,
      toggleCardSelection,
      confirmCardSelection,
      moveCardInHand,
      confirmHandOrder,
      playCard,
      playAgain,
      copyRoomCode,
      copySuccess,
      gameBoardRef,
      // 地图配置相关
      mapSizeOptions,
      selectedMapSize,
      selectedFogEnabled,
      creatorId,
      isCreator,
      selectMapSize,
      confirmMapSize,
      // 规则弹窗相关
      showRules,
      dontShowRules,
      closeRules,
      // 顺序锁定状态
      orderLocked,
      // 选择查看对手手牌相关
      chooseOpponentCardVisible,
      opponentFirstAndLastCard,
      viewedOpponentCard,
      viewedCardChoice,
      selectCardChoice,
      confirmCardChoice,
      // 出牌展示
      playedCardsDisplay,
      // 正在打出的牌
      playingCard,
      // 飞牌动画
      flyingCard,
      flyingCardStyle,
      // 出牌区DOM引用
      myPlayedAreaRef,
      opponentPlayedAreaRef,
      // 再来一局相关
      rematchStatus,
      opponentDisconnected,
      disconnectMessage,
      backToHome,
      requestRematch,
      acceptRematch,
      rejectRematch,
      // 新回合提示
      showRoundTransition,
      nextRound,
      // 地图名称展示
      showMapName,
      currentTheme,
      // 全屏背景样式
      screenBgStyle,
      // 角色形象相关
      myAvatarId,
      showAvatarSelector,
      player1AvatarId,
      player2AvatarId,
      openAvatarSelector,
      onAvatarSelected,
      closeAvatarSelector
    }
  }
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
}

.game-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  overflow-y: auto;
  overflow-x: hidden;
}

/* 连接界面 */
.connect-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  height: auto;
  color: white;
  padding: 2rem;
}

.title {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.subtitle {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.connect-form {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.room-input {
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  width: 200px;
}

.divider {
  margin: 1.5rem 0;
  opacity: 0.7;
}

.btn {
  padding: 0.8rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  background: white;
  color: #667eea;
  font-weight: bold;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.btn-primary {
  background: #48bb78;
  color: white;
}

.btn-confirm {
  background: #48bb78;
  color: white;
  margin-top: 1rem;
}

.btn-confirm:disabled {
  background: #a0a0a0;
  cursor: not-allowed;
  transform: none;
}

.error {
  color: #ff6b6b;
  margin-top: 1rem;
}

.status {
  margin-top: 1rem;
  opacity: 0.8;
}

/* 等待界面 */
.waiting-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  height: auto;
  color: white;
  padding: 2rem;
}

.waiting-text {
  font-size: 1.5rem;
  margin-top: 1rem;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 1.5rem auto 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 游戏界面 */
.game-screen {
  display: flex;
  flex-direction: column;
  height: auto;
  min-height: 100vh;
  padding: 1rem;
  box-sizing: border-box;
}

.players-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: rgba(255,255,255,0.95);
  border-radius: 12px;
  margin-bottom: 1rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.player-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.player-info.is-priority .player-name {
  color: #48bb78;
}

.player-name {
  font-weight: bold;
  color: #333;
}

.player-hp {
  font-size: 1.2rem;
}

.round-info {
  font-size: 1.2rem;
  color: #667eea;
  font-weight: bold;
}

/* 游戏区域：左右侧玩家面板 + 棋盘 */
.game-area {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
}

/* 玩家侧边面板 */
.player-side-panel {
  width: 120px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 20px;
  padding: 1.2rem 0.8rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* 左侧面板 - 玩家1（蓝色） */
.left-panel {
  border: 3px solid #4dabf7;
  background: linear-gradient(180deg, rgba(77, 171, 247, 0.15) 0%, rgba(255, 255, 255, 0.98) 40%);
}

.left-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #4dabf7, #1971c2, #4dabf7);
}

/* 右侧面板 - 玩家2（红色） */
.right-panel {
  border: 3px solid #ff6b6b;
  background: linear-gradient(180deg, rgba(255, 107, 107, 0.15) 0%, rgba(255, 255, 255, 0.98) 40%);
}

.right-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #ff6b6b, #c92a2a, #ff6b6b);
}

/* 当前玩家自己的面板高亮 */
.player-side-panel.is-me {
  box-shadow: 0 0 25px rgba(72, 187, 120, 0.5);
  transform: scale(1.02);
}

.left-panel.is-me {
  border-color: #48bb78;
  border-width: 4px;
}

.right-panel.is-me {
  border-color: #48bb78;
  border-width: 4px;
}

/* 面板玩家标签 */
.panel-player-label {
  font-size: 0.9rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.left-panel .panel-player-label {
  color: #1971c2;
}

.right-panel .panel-player-label {
  color: #c92a2a;
}

/* 角色头像区域 */
.panel-character {
  margin-bottom: 0.5rem;
}

.character-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: avatarFloat 3s ease-in-out infinite;
}

@keyframes avatarFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* 蓝色头像 - 玩家一 */
.blue-avatar {
  background: linear-gradient(145deg, #4dabf7, #1971c2);
  box-shadow: 0 4px 15px rgba(25, 113, 194, 0.4);
  border: 3px solid #1971c2;
}

/* 红色头像 - 玩家二 */
.red-avatar {
  background: linear-gradient(145deg, #ff6b6b, #c92a2a);
  box-shadow: 0 4px 15px rgba(201, 42, 42, 0.4);
  border: 3px solid #c92a2a;
}

.avatar-icon {
  font-size: 1.8rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

/* 身份标识 */
.panel-identity {
  margin-bottom: 0.5rem;
}

.identity-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.you-badge {
  background: linear-gradient(145deg, #48bb78, #38a169);
  color: white;
  box-shadow: 0 2px 8px rgba(72, 187, 120, 0.4);
  animation: pulseBadge 2s ease-in-out infinite;
}

@keyframes pulseBadge {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.opponent-badge {
  background: linear-gradient(145deg, #868e96, #495057);
  color: white;
}

/* 血量显示 */
.panel-hp {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hp-label {
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.hp-hearts {
  display: flex;
  gap: 0.15rem;
}

.heart {
  font-size: 1rem;
  transition: all 0.3s;
}

.heart.lost {
  opacity: 0.5;
  filter: grayscale(1);
}

.board-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  overflow: hidden;
  flex-shrink: 0;
  min-height: 320px;
}

.phase-indicator {
  text-align: center;
  padding: 0.8rem;
  background: rgba(255,255,255,0.95);
  border-radius: 8px;
  margin: 1rem 0;
  font-size: 1.1rem;
  color: #333;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.timer-warning {
  color: #ff6b6b !important;
  font-weight: bold;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.cards-area {
  background: rgba(255,255,255,0.95);
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.cards-tip {
  text-align: center;
  margin-bottom: 1rem;
  color: #333;
  font-weight: bold;
}

.available-cards {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.hand-cards {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.card {
  width: 100px;
  height: 140px;
  background: linear-gradient(145deg, #f8f9fa, #e9ecef);
  border: 2px solid #dee2e6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
}

.card.selected {
  background: linear-gradient(145deg, #a8e6cf, #88d8b0);
  border-color: #48bb78;
}

.card.current-card {
  background: linear-gradient(145deg, #ffeaa7, #fdcb6e);
  border-color: #f39c12;
  animation: pulse 1s infinite;
}

.card.played {
  opacity: 0.5;
  background: #dfe6e9;
}

.card.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.card.first-visible {
  border-color: #667eea;
  border-width: 3px;
}

.card-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.card-name {
  font-size: 0.75rem;
  text-align: center;
  color: #333;
}

.card-index {
  position: absolute;
  top: 5px;
  right: 5px;
  background: #667eea;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
}

.played-badge {
  position: absolute;
  bottom: 5px;
  background: #a0a0a0;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
}

.ordering-hint {
  text-align: center;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #666;
}

.opponent-first-card {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
  text-align: center;
}

.opponent-first-card p {
  color: #667eea;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

/* 对手手牌显示在顶部居中 */
.opponent-first-card-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #667eea;
}

.opponent-first-card-top p {
  color: #667eea;
  font-weight: bold;
  margin-bottom: 0.8rem;
  font-size: 1.1rem;
}

.center-card {
  margin: 0 auto;
}

.current-action {
  text-align: center;
  margin-top: 1rem;
}

.current-action p {
  margin-bottom: 0.5rem;
  color: #333;
}

.game-message {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 1rem 2rem;
  background: rgba(0,0,0,0.8);
  color: white;
  border-radius: 8px;
  font-size: 1.2rem;
  z-index: 1000;
  animation: fadeIn 0.3s;
}

.game-message.error {
  background: rgba(220,53,69,0.9);
}

.game-message.success {
  background: rgba(40,167,69,0.9);
}

/* 自己的操作 - 绿色 */
.game-message.my-action {
  background: rgba(40,167,69,0.95);
  border: 2px solid #28a745;
  box-shadow: 0 0 20px rgba(40,167,69,0.5);
}

/* 对手的操作 - 红色 */
.game-message.opponent-action {
  background: rgba(220,53,69,0.95);
  border: 2px solid #dc3545;
  box-shadow: 0 0 20px rgba(220,53,69,0.5);
}

/* 私密消息 - 紫色 */
.game-message.private {
  background: rgba(102, 126, 234, 0.95);
  border: 2px solid #667eea;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.5);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(243,156,18,0.4); }
  50% { box-shadow: 0 0 0 10px rgba(243,156,18,0); }
}

/* 游戏结束界面 */
.game-end-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
}

.result-title {
  font-size: 4rem;
  margin-bottom: 1rem;
}

/* 断开连接提示 */
.disconnect-notice {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.disconnect-notice p {
  font-size: 1.3rem;
  margin: 0.5rem 0;
}

/* 再来一局等待状态 */
.rematch-waiting {
  text-align: center;
  margin-top: 1rem;
}

.rematch-waiting p {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

/* 再来一局请求 */
.rematch-request {
  text-align: center;
  margin-top: 1rem;
}

.rematch-request p {
  font-size: 1.3rem;
  margin-bottom: 1rem;
}

.rematch-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover {
  background: #38a169;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover {
  background: #c53030;
}

/* 再来一局被拒绝 */
.rematch-rejected {
  text-align: center;
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(229, 62, 62, 0.3);
  border-radius: 8px;
}

.rematch-rejected p {
  font-size: 1.1rem;
}

/* 游戏结束按钮组 */
.game-end-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
  align-items: center;
}

.game-end-buttons .btn {
  min-width: 200px;
}

/* 地图配置界面 */
.configuring-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  height: auto;
  color: white;
  padding: 2rem;
}

.configuring-screen h3 {
  font-size: 1.8rem;
  margin: 1rem 0;
}

.map-size-selection {
  text-align: center;
  margin-top: 1rem;
}

.map-size-selection p {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.map-options {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.map-option-btn {
  width: 80px;
  height: 80px;
  font-size: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  color: #667eea;
  border: 3px solid transparent;
}

.map-option-btn.selected {
  background: #48bb78;
  color: white;
  border-color: #38a169;
}

.map-option-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

/* 迷雾效果选择 */
.fog-selection {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.fog-selection p {
  font-size: 1.2rem;
  margin-bottom: 0.8rem;
}

.fog-options {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.fog-option-btn {
  width: 100px;
  height: 50px;
  font-size: 1.1rem;
  background: white;
  color: #667eea;
  border: 3px solid transparent;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fog-option-btn.selected {
  background: #48bb78;
  color: white;
  border-color: #38a169;
}

.fog-option-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

.fog-hint {
  font-size: 0.9rem !important;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 0.5rem;
  margin-bottom: 0;
}

.confirm-map-btn {
  padding: 1rem 3rem;
  font-size: 1.1rem;
}

.confirm-map-btn:disabled {
  background: #a0a0a0;
  cursor: not-allowed;
  transform: none;
}

.waiting-config {
  text-align: center;
  margin-top: 1rem;
}

.waiting-config p {
  font-size: 1.2rem;
  margin-bottom: 1rem;
}

.btn-copy {
  background: #667eea;
  color: white;
  margin-bottom: 1rem;
}

.copy-success {
  color: #a8e6cf;
  font-size: 0.9rem;
  margin-top: -0.5rem;
  margin-bottom: 1rem;
}

/* 游戏规则弹窗 */
.rules-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.rules-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  color: #333;
}

.rules-content h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #667eea;
}

.rules-section {
  margin-bottom: 1.5rem;
}

.rules-section h3 {
  color: #48bb78;
  margin-bottom: 0.5rem;
}

.rules-section ul, .rules-section ol {
  padding-left: 1.5rem;
}

.rules-section li {
  margin-bottom: 0.5rem;
}

/* 探查牌子列表样式 */
.rules-section .sub-list {
  margin-top: 0.3rem;
  padding-left: 1.2rem;
}

.rules-section .sub-list li {
  margin-bottom: 0.3rem;
  font-size: 0.9rem;
  color: #555;
}

/* 地图主题列表样式 */
.rules-section .theme-list {
  font-size: 1.2rem;
  text-align: center;
  margin-bottom: 0.5rem;
  letter-spacing: 0.1em;
}

.rules-section .theme-note {
  font-size: 0.85rem;
  color: #888;
  text-align: center;
  font-style: italic;
}

.rules-checkbox {
  margin: 1rem 0;
  text-align: center;
}

.rules-checkbox label {
  cursor: pointer;
  color: #666;
}

.rules-btn {
  background: transparent;
  color: white;
  border: 2px solid white;
  margin-bottom: 1rem;
}

.rules-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 选牌进度条 */
.selection-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-bar {
  width: 200px;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #48bb78, #38a169);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-dots {
  display: flex;
  gap: 0.5rem;
}

.progress-dots .dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #dee2e6;
  color: #868e96;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  transition: all 0.3s;
}

.progress-dots .dot.filled {
  background: #48bb78;
  color: white;
}

/* 顺序确认提示样式 */
.order-confirmed {
  color: #48bb78;
  font-weight: bold;
  font-size: 1.2rem;
  text-shadow: 0 0 10px rgba(72, 187, 120, 0.3);
}

/* 选择查看对手手牌弹窗 */
.choose-card-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
}

.choose-card-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  max-width: 450px;
  width: 90%;
  text-align: center;
  color: #333;
}

.choose-card-content h2 {
  color: #667eea;
  margin-bottom: 1rem;
}

.choose-tip {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 1.5rem;
}

.choose-options {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.choose-option {
  width: 130px;
  padding: 1.5rem 1rem;
  border: 3px solid #dee2e6;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  background: #f8f9fa;
}

.choose-option:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.choose-option.selected {
  border-color: #48bb78;
  background: linear-gradient(145deg, #a8e6cf, #88d8b0);
}

.choose-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.choose-label {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.3rem;
}

.choose-desc {
  font-size: 0.85rem;
  color: #666;
}

.confirm-choice-btn {
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
}

.confirm-choice-btn:disabled {
  background: #a0a0a0;
  cursor: not-allowed;
}

/* 出牌展示区样式 */
.played-cards-area {
  background: linear-gradient(145deg, #f0f4ff, #e8ecf8);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 2px solid #667eea;
}

.played-cards-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.player-played-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.player-label {
  font-size: 0.9rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 0.5rem;
}

/* 己方区域 - 绿色 */
.player-played-cards.my-area .player-label {
  color: #48bb78;
}

.player-played-cards.my-area .played-card.my-card {
  border-color: #48bb78;
  border-width: 3px;
  box-shadow: 0 0 15px rgba(72, 187, 120, 0.4);
}

/* 对手区域 - 红色 */
.player-played-cards.opponent-area .player-label {
  color: #e53e3e;
}

.player-played-cards.opponent-area .played-card.opponent-card {
  border-color: #e53e3e;
  border-width: 3px;
  box-shadow: 0 0 15px rgba(229, 62, 62, 0.4);
}

.cards-row {
  display: flex;
  gap: 0.5rem;
}

.played-card {
  width: 80px;
  height: 110px;
  background: linear-gradient(145deg, #fff, #f8f9fa);
  border-color: #48bb78;
  cursor: default;
}

.played-card.current-playing {
  animation: cardGlow 1s infinite;
  border-color: #f39c12;
  border-width: 3px;
}

@keyframes cardGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(243, 156, 18, 0.5); }
  50% { box-shadow: 0 0 20px rgba(243, 156, 18, 0.8); }
}

.empty-card {
  width: 80px;
  height: 110px;
  background: linear-gradient(145deg, #e9ecef, #dee2e6);
  border: 2px dashed #adb5bd;
  opacity: 0.6;
  cursor: default;
}

.empty-card:hover {
  transform: none;
  box-shadow: none;
}

.empty-card .card-icon {
  color: #adb5bd;
}

.vs-divider {
  font-size: 1.5rem;
  font-weight: bold;
  color: #667eea;
  text-shadow: 0 0 10px rgba(102, 126, 234, 0.3);
  padding: 0 0.5rem;
}

/* 飞牌动画样式 */
.flying-card-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3000;
}

.flying-card {
  width: 100px;
  height: 140px;
  background: linear-gradient(145deg, #fff, #f8f9fa);
  border: 3px solid #48bb78;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 40px rgba(72, 187, 120, 0.5);
  animation: flyCard 0.6s ease-out forwards;
}

.flying-card .card-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.flying-card .card-name {
  font-size: 0.85rem;
  text-align: center;
  color: #333;
  font-weight: bold;
}

/* 自己的牌 - 绿色边框 */
.flying-card.my-card {
  border-color: #48bb78;
  box-shadow: 0 10px 40px rgba(72, 187, 120, 0.6);
}

/* 对手的牌 - 红色边框 */
.flying-card.opponent-card {
  border-color: #e53e3e;
  box-shadow: 0 10px 40px rgba(229, 62, 62, 0.6);
}

/* 自己的牌从下往上飞，先手飞向左边，后手飞向右边 */
.flying-card.from-bottom {
  animation: flyFromBottom 1.5s ease-out forwards;
}

/* 对手的牌从上往下飞 */
.flying-card.from-top {
  animation: flyFromTop 1.5s ease-out forwards;
}

@keyframes flyFromBottom {
  0% {
    transform: translateY(150px) scale(0.3);
    opacity: 0;
  }
  25% {  /* 0.375秒：入场完成 */
    transform: translateY(0) scale(1.4);
    opacity: 1;
  }
  70% {  /* 1.05秒：停顿结束 */
    transform: translateY(0) scale(1.4);
    opacity: 1;
  }
  100% {  /* 1.5秒：飞向出牌区并缩小 */
    transform: translate(var(--fly-direction, -150px), var(--target-y, -80px)) scale(0.7);
    opacity: 0;
  }
}

@keyframes flyFromTop {
  0% {
    transform: translateY(-150px) scale(0.3);
    opacity: 0;
  }
  25% {  /* 0.375秒：入场完成 */
    transform: translateY(0) scale(1.4);
    opacity: 1;
  }
  70% {  /* 1.05秒：停顿结束 */
    transform: translateY(0) scale(1.4);
    opacity: 1;
  }
  100% {  /* 1.5秒：飞向出牌区并缩小 */
    transform: translate(var(--fly-direction, 150px), var(--target-y, 80px)) scale(0.7);
    opacity: 0;
  }
}

@keyframes flyCard {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  25% {
    transform: scale(1.4);
    opacity: 1;
  }
  70% {
    transform: scale(1.4);
    opacity: 1;
  }
  100% {
    transform: scale(0.7);
    opacity: 0;
  }
}

/* 新回合提示界面样式 */
.round-transition-overlay {
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
  z-index: 4000;
}

.round-transition-content {
  text-align: center;
  color: white;
}

.round-transition-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: iconBounce 0.6s ease-out;
}

@keyframes iconBounce {
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

.round-transition-text {
  font-size: 2.5rem;
  font-weight: bold;
  text-shadow: 0 4px 20px rgba(102, 126, 234, 0.8);
  animation: textSlideIn 0.5s ease-out 0.2s both;
}

@keyframes textSlideIn {
  0% {
    transform: translateY(30px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Vue Transition 动画 */
.round-transition-enter-active {
  animation: fadeInOverlay 0.3s ease-out;
}

.round-transition-leave-active {
  animation: fadeOutOverlay 0.3s ease-in;
}

@keyframes fadeInOverlay {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@keyframes fadeOutOverlay {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* 地图名称展示界面样式 */
.map-name-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5000;
}

.map-name-content {
  text-align: center;
  color: white;
  animation: mapNameAppear 0.5s ease-out;
}

.map-name-icon {
  font-size: 5rem;
  margin-bottom: 1rem;
  animation: iconFloat 2s ease-in-out infinite;
}

@keyframes iconFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.map-name-title {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 0.5rem;
  letter-spacing: 0.2em;
}

.map-name-text {
  font-size: 3.5rem;
  font-weight: bold;
  text-shadow: 0 4px 30px rgba(102, 126, 234, 0.8);
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #667eea, #48bb78);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.map-name-desc {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

@keyframes mapNameAppear {
  0% {
    transform: scale(0.5);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Vue Transition 动画 */
.map-name-transition-enter-active {
  animation: fadeInOverlay 0.3s ease-out;
}

.map-name-transition-leave-active {
  animation: fadeOutOverlay 0.5s ease-in;
}

/* 形象选择区域样式 - 连接界面右上角 */
.connect-screen .avatar-select-area {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid rgba(255, 255, 255, 0.3);
  margin-bottom: 0;
}

.avatar-select-area:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
}

.avatar-label {
  font-size: 1rem;
  color: white;
  font-weight: 500;
}

.avatar-change-hint {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 0.5rem;
}

/* 等待界面形象显示 - 右上角 */
.waiting-screen .waiting-avatar {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 1.5rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  margin-bottom: 0;
}

.waiting-avatar .avatar-label {
  font-size: 1rem;
  color: white;
  font-weight: 500;
}
</style>
