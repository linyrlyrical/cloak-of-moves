<template>
<div class="game-container" :style="screenBgStyle" :class="{ 'no-scroll': isDealingAnimating }">
    <!-- 全局粒子背景层 - 只在主菜单阶段显示 -->
    <div v-if="['connecting', 'waiting', 'configuring'].includes(gameState.phase)" class="global-particles-bg">
      <div v-for="(style, i) in particleStyles" :key="i" class="particle" :style="style"></div>
    </div>
    
    <!-- 地图名称展示界面 -->
    <Transition name="map-name-transition">
      <div v-if="showMapName" class="map-name-overlay">
        <div class="map-name-content">
          <div class="map-name-icon">🗺️</div>
          <div class="map-name-title">当前地图</div>
          <div class="map-name-text">
            <span class="theme-icon">{{ currentTheme?.icon || '🗺️' }}</span>
            <span class="theme-name" :style="{ background: currentTheme?.nameColor || 'linear-gradient(135deg, #667eea, #48bb78)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }">{{ currentTheme?.name || '未知地图' }}</span>
          </div>
          <div class="map-name-desc">{{ currentTheme?.description || '' }}</div>
          <!-- 随机事件提示 -->
          <Transition name="event-fade">
            <div v-if="currentMapEvent && showMapName" class="map-event-info">
              <div class="event-divider"></div>
              <div class="event-label">⚡ 随机事件</div>
              <div class="event-content">
                <span class="event-icon">{{ currentMapEvent.icon }}</span>
                <span class="event-name">{{ currentMapEvent.name }}</span>
              </div>
              <div class="event-desc">{{ currentMapEvent.description }}</div>
            </div>
          </Transition>
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

    <!-- 选择观看对手手牌弹窗 -->
    <div v-if="chooseOpponentCardVisible" class="choose-card-modal">
      <div class="choose-card-content">
        <h2>⚔️ 对方已确定出牌顺序</h2>
        <p class="choose-tip">你可以选择查看对方的一张手牌：</p>
        
        <!-- 倒计时显示 -->
        <div class="view-card-timer" :class="{ 'timer-warning': viewCardTimer <= 3 }">
          剩余时间: {{ viewCardTimer }}秒
        </div>
        
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
    
    <!-- 设置面板 -->
    <SettingsPanel 
      :visible="showSettings" 
      @close="closeSettings" 
    />

    <!-- 顶部工具栏（右上角） -->
    <div v-if="['connecting', 'waiting', 'configuring'].includes(gameState.phase)" class="top-toolbar">
      <div class="settings-btn" @click="openSettings" title="设置">
        ⚙️
      </div>
      <div class="main-avatar-display" @click="openAvatarSelector">
        <AvatarIcon :avatar-id="myAvatarId" size="medium" />
        <div class="avatar-hint">点击更换</div>
      </div>
    </div>

    <!-- 游戏规则弹窗 -->
    <div v-if="showRules" class="rules-modal">
      <div class="rules-content">
        <h2>📜 游戏规则</h2>
        <div class="rules-columns">
          <!-- 左侧列 -->
          <div class="rules-column">
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
          </div>
          <!-- 右侧列 -->
          <div class="rules-column">
            <div class="rules-section">
              <h3>🌍 地图主题与特色地形</h3>
              <p class="theme-list">🌲 森林 · 🏜️ 沙漠 · ❄️ 冰原 · 🌋 火山 · 🏛️ 古城</p>
              <p class="theme-note">每个主题可选择特色地形，带来不同的战术体验：</p>
              <ul class="terrain-list">
                <li><strong>火山形🌋</strong>：岩浆河流造就不规则障碍</li>
                <li><strong>树木形🌲</strong>：森林中的树木形成天然屏障</li>
                <li><strong>菱形❄️</strong>：冰原的菱形晶体结构</li>
                <li><strong>沙丘形🏜️</strong>：沙漠起伏的沙丘地形</li>
                <li><strong>废墟形🏛️</strong>：古城遗迹的断壁残垣</li>
              </ul>
            </div>
            <div class="rules-section">
              <h3>📋 游戏流程</h3>
              <ol>
                <li>选择角色和3张卡牌作为手牌</li>
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
          </div>
        </div>
        <!-- 角色技能 - 全宽展示 -->
        <div class="rules-section rules-skills-section">
          <h3>⚔️ 角色技能</h3>
          <p class="skill-intro">每个角色拥有独特的技能，男性角色为<strong class="active-skill-text">主动技能</strong>（需手动触发），女性角色为<strong class="passive-skill-text">被动技能</strong>（自动生效）：</p>
          <div class="skills-table">
            <div class="skill-row skill-header">
              <div class="skill-cell">职业</div>
              <div class="skill-cell">男性角色（主动）</div>
              <div class="skill-cell">女性角色（被动）</div>
            </div>
            <div class="skill-row">
              <div class="skill-cell profession">🧙 法师</div>
              <div class="skill-cell active-skill">☄️ 天降陨石<br><span class="skill-desc">随机在多个格子落下陨石造成伤害</span></div>
              <div class="skill-cell passive-skill">💥 爆裂攻击<br><span class="skill-desc">攻击可摧毁障碍物和传送门</span></div>
            </div>
            <div class="skill-row">
              <div class="skill-cell profession">⚔️ 骑士</div>
              <div class="skill-cell active-skill">🌀 旋风斩<br><span class="skill-desc">对周围一圈造成范围伤害</span></div>
              <div class="skill-cell passive-skill">🗡️ 坚韧突刺<br><span class="skill-desc">攻击范围+1，初始血量+1</span></div>
            </div>
            <div class="skill-row">
              <div class="skill-cell profession">📖 阅读者</div>
              <div class="skill-cell active-skill">📖 回忆过去<br><span class="skill-desc">重新获得之前的探查视野</span></div>
              <div class="skill-cell passive-skill">🔍 深度求索<br><span class="skill-desc">环绕探查的范围额外+1</span></div>
            </div>
            <div class="skill-row">
              <div class="skill-cell profession">🗡️ 盗贼</div>
              <div class="skill-cell active-skill">🃏 盗为己用<br><span class="skill-desc">复制对手第一张手牌加入自己手牌</span></div>
              <div class="skill-cell passive-skill">👁️ 隔墙有眼<br><span class="skill-desc">每隔几回合可偷看对手手牌</span></div>
            </div>
            <div class="skill-row">
              <div class="skill-cell profession">🏹 弓箭手</div>
              <div class="skill-cell active-skill">🏹 百步穿杨<br><span class="skill-desc">向四个方向发射穿透箭矢</span></div>
              <div class="skill-cell passive-skill">🎯 天降箭雨<br><span class="skill-desc">每回合开始随机落下箭雨攻击</span></div>
            </div>
          </div>
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
      
      <button class="btn rules-btn" @click="showRules = true">📜 查看规则</button>
      
      <!-- 初始选择匹配方式 -->
      <div v-if="!selectedMatchMode" class="match-mode-buttons">
        <div class="mode-btn solo-mode-btn" @click="selectMatchMode('solo')">
          <div class="mode-icon">🤖</div>
          <div class="mode-title">单人模式</div>
          <div class="mode-desc">与AI对战</div>
        </div>
        <div class="mode-btn room-mode-btn" @click="selectMatchMode('room')">
          <div class="mode-icon">🏠</div>
          <div class="mode-title">房间号匹配</div>
          <div class="mode-desc">创建或加入房间</div>
        </div>
        <div class="mode-btn id-mode-btn" @click="selectMatchMode('id')">
          <div class="mode-icon">👤</div>
          <div class="mode-title">ID匹配</div>
          <div class="mode-desc">通过ID邀请好友</div>
        </div>
      </div>
      
      <!-- 单人模式已移除AI选择，直接进入地图配置 -->
      
      <!-- 房间号匹配界面 -->
      <div v-else-if="selectedMatchMode === 'room'" class="room-match-form">
        <div class="connect-form">
          <input 
            v-model="roomCode" 
            placeholder="输入房间号加入" 
            class="room-input"
            @keyup.enter="joinRoom"
          />
          <button @click="joinRoom" class="btn">加入房间</button>
        </div>
        
        <button @click="createRoom" class="btn btn-primary">创建新房间</button>
        
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        
        <button class="btn back-btn" @click="selectedMatchMode = ''">← 返回</button>
      </div>
      
      <p class="status">{{ connectionStatus }}</p>
    </div>

    <!-- 等待界面 -->
    <div v-else-if="gameState.phase === 'waiting'" class="waiting-screen">
      <h2>房间: {{ currentRoom }}</h2>
      <button @click="copyRoomCode" class="btn btn-copy">📋 复制房间号</button>
      <p v-if="copySuccess" class="copy-success">已复制到剪贴板！</p>
      
      <button class="btn rules-btn" @click="showRules = true">📜 查看规则</button>
      <button class="btn back-btn" @click="cancelWaiting">← 返回</button>
      <p class="waiting-text">等待另一名玩家加入...</p>
      <div class="loading-spinner"></div>
    </div>
    
    <!-- ID匹配成功，等待配置阶段 -->
    <div v-else-if="gameState.phase === 'waiting_config'" class="waiting-screen">
      <h2>🎮 匹配成功！</h2>
      <p class="waiting-text">正在进入游戏配置...</p>
      <div class="loading-spinner"></div>
    </div>
    
    <!-- 地图配置界面 -->
    <div v-else-if="gameState.phase === 'configuring'" class="configuring-screen">
      <h2>房间: {{ currentRoom }}</h2>
      <h3>地图配置</h3>
      
      <!-- 房主可以选择地图大小 -->
      <div v-if="isCreator" class="map-size-selection">
        <!-- 地图主题选择 - 放在最上面 -->
        <div class="theme-selection">
          <p>地图主题：</p>
          <div class="theme-options">
            <button 
              class="btn theme-option-btn"
              :class="{ 'selected': selectedTheme === 'random' }"
              @click="selectedTheme = 'random'"
            >
              🎲 随机
            </button>
            <button 
              v-for="theme in themeOptions" 
              :key="theme.id"
              class="btn theme-option-btn"
              :class="{ 'selected': selectedTheme === theme.id }"
              @click="selectedTheme = theme.id"
              @mouseenter="handleThemeMouseEnter(theme.id, $event)"
              @mouseleave="handleThemeMouseLeave"
            >
              {{ theme.icon }} {{ theme.name }}
            </button>
          </div>
        </div>
        
        <!-- 特色地形选项 -->
        <div class="shape-selection">
          <p>特色地形：</p>
          <div class="shape-options">
            <button 
              class="btn shape-option-btn"
              :class="{ 'selected': selectedMapSize === 'shape' }"
              @click="selectMapSize('shape')"
            >
              <template v-if="selectedTheme === 'random'">
                🎲 随机特色地形
              </template>
              <template v-else>
                {{ getThemeShapeInfo(selectedTheme).icon }} {{ getThemeShapeInfo(selectedTheme).name }}
                <span class="shape-cells">({{ getThemeShapeInfo(selectedTheme).cells }}格)</span>
              </template>
            </button>
          </div>
        </div>
        
        <!-- 常规地图大小选项 -->
        <div class="map-size-wrapper">
          <p>{{ selectedTheme !== 'random' ? '或选择常规地图：' : '请选择地图大小：' }}</p>
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
      <!-- 寒流全屏雪花效果 -->
      <div v-if="showColdWaveEffect" class="cold-wave-fullscreen">
        <div class="cold-wave-mask"></div>
        <div class="snowflakes-fullscreen">
          <div v-for="i in 30" :key="i" class="snowflake-full" :class="`snowflake-${i}`">❄️</div>
        </div>
        <div class="cold-wind-flow">
          <div class="wind-stream wind-stream-1"></div>
          <div class="wind-stream wind-stream-2"></div>
          <div class="wind-stream wind-stream-3"></div>
        </div>
      </div>
      
      <!-- 游戏内粒子背景层 -->
      <div class="game-particles-bg">
        <div 
          v-for="(particle, i) in gameParticleStyles" 
          :key="i" 
          class="game-particle" 
          :class="currentTheme?.particleStyle?.shape || 'default'"
          :style="particle.style"
          v-html="particle.svg"
        ></div>
      </div>
      
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

      <!-- 游戏内设置按钮 -->
      <div class="game-toolbar">
        <div class="game-settings-btn" @click="openSettings" title="设置">
          ⚙️
        </div>
      </div>

      <!-- 游戏区域：左右侧玩家面板 + 棋盘 -->
      <div class="game-area">
        <!-- 左侧面板 - 玩家1（蓝色） -->
        <div class="player-side-panel left-panel" :class="{ 'is-me': isPlayer1 }">
          <div class="panel-content-wrapper">
            <!-- 技能卡牌区域 - 左侧 -->
            <div class="skill-card-area left-skill" v-if="player1Skill">
              <div 
                class="skill-card"
                :class="{
                  'active-skill': player1Skill.skillType === 'active',
                  'passive-skill': player1Skill.skillType === 'passive',
                  'on-cooldown': player1SkillCooldown > 0,
                  'can-select': !skillSealed && isPlayer1 && player1Skill.skillType === 'active' && player1SkillCooldown === 0 && isSelectingPhase,
                  'selected': isPlayer1 && skillSelected,
                  'sealed': skillSealed
                }"
                @click="!skillSealed && handleSkillClick(0)"
              >
                <div class="skill-icon">{{ player1Skill.skillIcon }}</div>
                <div class="skill-name">{{ player1Skill.skillName }}</div>
                <div class="skill-type-label">{{ player1Skill.skillType === 'active' ? '主动' : '被动' }}</div>
                <div v-if="player1Skill.skillType === 'active'" class="skill-cooldown">
                  {{ player1SkillCooldown > 0 ? `冷却: ${player1SkillCooldown}回合` : '可用' }}
                </div>
                <div class="skill-description">{{ player1Skill.description }}</div>
                <!-- 冷却遮罩 -->
                <div v-if="player1SkillCooldown > 0 && !skillSealed" class="cooldown-overlay">
                  <span class="cooldown-number">{{ player1SkillCooldown }}</span>
                </div>
                <!-- 技能封印遮罩 -->
                <div v-if="skillSealed" class="seal-overlay">
                  <span class="seal-icon">🔒</span>
                  <span class="seal-text">技能封印</span>
                </div>
              </div>
            </div>
            <!-- 玩家信息区域 - 右侧 -->
            <div class="player-info-area">
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
                  <span v-for="i in (gameState.players?.[0]?.maxHp || 1)" :key="i" class="heart" :class="{ 'lost': (gameState.players?.[0]?.hp || 1) < i }">❤️</span>
                </div>
              </div>
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
            :my-skill="mySkill"
            :show-cold-wave="showColdWaveEffect"
          />
        </div>
        
        <!-- 右侧面板 - 玩家2（红色） -->
        <div class="player-side-panel right-panel" :class="{ 'is-me': !isPlayer1 }">
          <div class="panel-content-wrapper">
            <!-- 玩家信息区域 - 左侧 -->
            <div class="player-info-area">
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
                  <span v-for="i in (gameState.players?.[1]?.maxHp || 1)" :key="i" class="heart" :class="{ 'lost': (gameState.players?.[1]?.hp || 1) < i }">❤️</span>
                </div>
              </div>
            </div>
            <!-- 技能卡牌区域 - 右侧 -->
            <div class="skill-card-area right-skill" v-if="player2Skill">
              <div 
                class="skill-card"
                :class="{
                  'active-skill': player2Skill.skillType === 'active',
                  'passive-skill': player2Skill.skillType === 'passive',
                  'on-cooldown': player2SkillCooldown > 0,
                  'can-select': !skillSealed && !isPlayer1 && player2Skill.skillType === 'active' && player2SkillCooldown === 0 && isSelectingPhase,
                  'selected': !isPlayer1 && skillSelected,
                  'sealed': skillSealed
                }"
                @click="!skillSealed && handleSkillClick(1)"
              >
                <div class="skill-icon">{{ player2Skill.skillIcon }}</div>
                <div class="skill-name">{{ player2Skill.skillName }}</div>
                <div class="skill-type-label">{{ player2Skill.skillType === 'active' ? '主动' : '被动' }}</div>
                <div v-if="player2Skill.skillType === 'active'" class="skill-cooldown">
                  {{ player2SkillCooldown > 0 ? `冷却: ${player2SkillCooldown}回合` : '可用' }}
                </div>
                <div class="skill-description">{{ player2Skill.description }}</div>
                <!-- 冷却遮罩 -->
                <div v-if="player2SkillCooldown > 0 && !skillSealed" class="cooldown-overlay">
                  <span class="cooldown-number">{{ player2SkillCooldown }}</span>
                </div>
                <!-- 技能封印遮罩 -->
                <div v-if="skillSealed" class="seal-overlay">
                  <span class="seal-icon">🔒</span>
                  <span class="seal-text">技能封印</span>
                </div>
              </div>
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
          <!-- 女盗贼技能触发：同时显示两张牌 -->
          <div v-if="!isPriorityPlayer && opponentFirstAndLastCard && opponentFirstAndLastCard.firstCard && opponentFirstAndLastCard.lastCard" class="opponent-cards-top wall-skill-cards">
            <p class="wall-skill-title">👁️ 隔墙有眼 - 先手玩家手牌：</p>
            <div class="wall-skill-cards-row">
              <div class="revealed-card-item">
                <div class="card-label">第一张</div>
                <div class="card wall-skill-reveal-card">
                  <span class="card-icon">{{ opponentFirstAndLastCard.firstCard.icon }}</span>
                  <span class="card-name">{{ opponentFirstAndLastCard.firstCard.name }}</span>
                </div>
              </div>
              <div class="revealed-card-item">
                <div class="card-label">最后一张</div>
                <div class="card wall-skill-reveal-card">
                  <span class="card-icon">{{ opponentFirstAndLastCard.lastCard.icon }}</span>
                  <span class="card-name">{{ opponentFirstAndLastCard.lastCard.name }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- 普通情况：只显示一张牌 -->
          <div v-else-if="!isPriorityPlayer && opponentFirstCard" class="opponent-first-card-top">
            <p>先手玩家{{ viewedCardChoice === 'last' ? '最后一张' : '第一张' }}手牌：</p>
            <div class="card first-visible center-card">
              <span class="card-icon">{{ opponentFirstCard.icon }}</span>
              <span class="card-name">{{ opponentFirstCard.name }}</span>
            </div>
          </div>
          
          <p class="cards-tip">选择3张卡牌作为手牌（主动技能可作为一张牌）</p>
          
          <!-- 选牌进度条 -->
          <div class="selection-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (totalSelectedCount / 3 * 100) + '%' }"></div>
            </div>
            <div class="progress-dots">
              <span v-for="i in 3" :key="i" class="dot" :class="{ 'filled': totalSelectedCount >= i }">{{ i }}</span>
            </div>
          </div>
          
          <div class="available-cards" ref="availableCardsRef">
            <!-- 卡牌（包括普通牌和技能牌，由服务端统一发送） -->
            <div 
              v-for="(card, index) in currentCards" 
              :key="index"
              class="card"
              :class="{ 
                'selected': selectedCards.includes(index),
                'disabled': isDealingAnimating,
                'placeholder': card === null,
                'skill-card-in-selection': card && card.isSkillCard,
                'sealed-card': card && card.isSkillCard && skillSealed
              }"
              @click="toggleCardSelection(index)"
            >
              <template v-if="card !== null">
                <span class="card-icon">{{ card.icon }}</span>
                <span class="card-name">{{ card.name }}</span>
                <span v-if="card && card.isSkillCard" class="skill-badge">技能</span>
              </template>
              <!-- 选牌区技能牌封印遮罩 -->
              <div v-if="card && card.isSkillCard && skillSealed" class="card-seal-overlay">
                <span class="seal-icon">🔒</span>
                <span class="seal-text">封印</span>
              </div>
            </div>
          </div>
          <button 
            class="btn btn-confirm" 
            :disabled="!canConfirmSelection"
            @click="confirmCardSelection"
          >
            确认选择 ({{ totalSelectedCount }}/3)
          </button>
        </div>

        <!-- 手牌顺序调整 -->
        <div v-else-if="gameState.phase === 'ordering_priority' || gameState.phase === 'ordering_normal'" class="card-ordering">
          <!-- 女盗贼技能触发：同时显示两张牌 -->
          <div v-if="!isPriorityPlayer && opponentFirstAndLastCard && opponentFirstAndLastCard.firstCard && opponentFirstAndLastCard.lastCard" class="opponent-cards-top wall-skill-cards">
            <p class="wall-skill-title">👁️ 隔墙有眼 - 先手玩家手牌：</p>
            <div class="wall-skill-cards-row">
              <div class="revealed-card-item">
                <div class="card-label">第一张</div>
                <div class="card wall-skill-reveal-card">
                  <span class="card-icon">{{ opponentFirstAndLastCard.firstCard.icon }}</span>
                  <span class="card-name">{{ opponentFirstAndLastCard.firstCard.name }}</span>
                </div>
              </div>
              <div class="revealed-card-item">
                <div class="card-label">最后一张</div>
                <div class="card wall-skill-reveal-card">
                  <span class="card-icon">{{ opponentFirstAndLastCard.lastCard.icon }}</span>
                  <span class="card-name">{{ opponentFirstAndLastCard.lastCard.name }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- 普通情况：只显示一张牌 -->
          <div v-else-if="!isPriorityPlayer && opponentFirstCard" class="opponent-first-card-top">
            <p>先手玩家{{ viewedCardChoice === 'last' ? '最后一张' : '第一张' }}手牌：</p>
            <div class="card first-visible center-card">
              <span class="card-icon">{{ opponentFirstCard.icon }}</span>
              <span class="card-name">{{ opponentFirstCard.name }}</span>
            </div>
          </div>
          
          <p class="cards-tip">
            {{ isPriorityPlayer ? '调整手牌顺序（对方会看到第一张牌或最后一张牌）' : '调整手牌顺序' }}
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
          <!-- 寒流冻结提示 -->
          <div v-if="showColdWaveEffect" class="cold-wave-warning">
            ❄️ 寒流侵袭！本回合所有出牌效果被冻结！
          </div>
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
                    :class="{ 
                      'current-playing': idx === currentPlayIndex && isMyTurn,
                      'frozen': showColdWaveEffect 
                    }"
                  >
                    <span class="card-icon">{{ card.icon }}</span>
                    <span class="card-name">{{ card.name }}</span>
                    <!-- 冻结覆盖层 -->
                    <div v-if="showColdWaveEffect" class="card-frozen-overlay">
                      <span class="frozen-icon">❄️</span>
                    </div>
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
                    :class="{ 
                      'current-playing': idx === currentPlayIndex && !isMyTurn,
                      'frozen': showColdWaveEffect 
                    }"
                  >
                    <span class="card-icon">{{ card.icon }}</span>
                    <span class="card-name">{{ card.name }}</span>
                    <!-- 冻结覆盖层 -->
                    <div v-if="showColdWaveEffect" class="card-frozen-overlay">
                      <span class="frozen-icon">❄️</span>
                    </div>
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
      
      <!-- 发牌动画层 -->
      <div v-if="showDealingAnimation" class="dealing-animation-overlay">
        <!-- 飞出的牌 -->
        <div 
          v-for="(item, idx) in dealingCards" 
          :key="idx"
          class="dealing-card"
          :style="{ '--delay': `${idx * 0.12}s`, '--target-x': `${item.targetX}px`, '--target-y': `${item.targetY}px` }"
        >
          <span class="card-icon">{{ item.card.icon }}</span>
          <span class="card-name">{{ item.card.name }}</span>
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

    <!-- ID匹配大厅 -->
    <IdMatchLobby 
      v-if="showIdMatchLobby"
      ref="idMatchLobbyRef"
      :socket="socket"
      :my-avatar-id="myAvatarId"
      @match-found="onIdMatchFound"
      @leave="onLeaveIdLobby"
      @invitation-received="onInvitationReceived"
    />
    
    <!-- 邀请弹窗 -->
    <InvitationDialog 
      :visible="showInvitationDialog"
      :invitation="currentInvitation"
      @accept="onAcceptInvitation"
      @reject="onRejectInvitation"
    />
    
    <!-- 随机事件悬停浮窗 -->
    <Transition name="tooltip-fade">
      <div v-if="showEventTooltip && hoveredEvent" class="event-tooltip" :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }">
        <div class="event-tooltip-header">
          <span class="event-tooltip-icon">{{ hoveredEvent.icon }}</span>
          <span class="event-tooltip-name">{{ hoveredEvent.name }}</span>
        </div>
        <div class="event-tooltip-desc">{{ hoveredEvent.description }}</div>
        <div class="event-tooltip-trigger">
          <span v-if="hoveredEvent.trigger === 'passive'" class="trigger-tag passive">被动效果</span>
          <span v-else-if="hoveredEvent.trigger === 'chance'" class="trigger-tag chance">概率触发 {{ Math.round(hoveredEvent.chance * 100) }}%</span>
          <span v-else-if="hoveredEvent.trigger === 'active'" class="trigger-tag active">每回合触发</span>
        </div>
      </div>
    </Transition>
    
    <!-- 女盗贼技能：隔墙有眼 - 查看对手手牌弹窗 -->
    <div v-if="showWallSkillReveal && wallSkillRevealedCards" class="wall-skill-modal">
      <div class="wall-skill-content">
        <h2>👁️ 隔墙有眼</h2>
        <p class="wall-skill-tip">你查看了对手的手牌（共 {{ wallSkillRevealedCards.totalCards }} 张）：</p>
        
        <div class="revealed-cards">
          <div class="revealed-card">
            <div class="card-label">第一张</div>
            <div class="card wall-skill-card">
              <span class="card-icon">{{ wallSkillRevealedCards.firstCard?.icon }}</span>
              <span class="card-name">{{ wallSkillRevealedCards.firstCard?.name }}</span>
            </div>
          </div>
          
          <div class="revealed-card">
            <div class="card-label">最后一张</div>
            <div class="card wall-skill-card">
              <span class="card-icon">{{ wallSkillRevealedCards.lastCard?.icon }}</span>
              <span class="card-name">{{ wallSkillRevealedCards.lastCard?.name }}</span>
            </div>
          </div>
        </div>
        
        <button class="btn btn-primary wall-skill-close-btn" @click="closeWallSkillReveal">我已记住</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { io } from 'socket.io-client'
import GameBoard from './components/GameBoard.vue'
import AvatarIcon from './components/AvatarIcon.vue'
import AvatarSelector from './components/AvatarSelector.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import MatchModeSelect from './components/MatchModeSelect.vue'
import IdMatchLobby from './components/IdMatchLobby.vue'
import InvitationDialog from './components/InvitationDialog.vue'
import { GAME_CONFIG, MAP_THEMES, THEME_LIST, THEME_SHAPE_LAYOUTS, countThemeShapeCells, CHARACTER_SKILLS, MAP_EVENTS } from '@shared/constants.js'
import { getServerUrl } from './config.js'
import audioManager from './utils/audioManager'

export default {
  name: 'App',
  components: {
    GameBoard,
    AvatarIcon,
    AvatarSelector,
    SettingsPanel,
    MatchModeSelect,
    IdMatchLobby,
    InvitationDialog
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
    
    // 技能相关状态
    const player1Skill = ref(null)
    const player2Skill = ref(null)
    
    // 获取当前玩家的技能（computed）
    const mySkill = computed(() => {
      return isPlayer1.value ? player1Skill.value : player2Skill.value
    })
    
    const player1SkillCooldown = ref(0)
    const player2SkillCooldown = ref(0)
    
    // 古城技能封印状态
    const skillSealed = ref(false)
    const skillSelected = ref(false)
    
    const currentPlayIndex = ref(0)
    // 后手玩家选择查看先手手牌相关
    const chooseOpponentCardVisible = ref(false)
    const opponentFirstAndLastCard = ref({ firstCard: null, lastCard: null })
    const chooseOpponentCardData = ref({ firstCard: null, lastCard: null }) // 用于弹窗选择的数据
    const viewedOpponentCard = ref(null)
    const viewedCardChoice = ref(null) // 'first' or 'last'
    
    // 女盗贼技能：隔墙有眼 - 查看对手手牌
    const wallSkillRevealedCards = ref(null) // { firstCard, lastCard, totalCards }
    const showWallSkillReveal = ref(false) // 是否显示查看手牌弹窗
    const lastViewedCardChoice = ref('first')  // 记住玩家上次的选择，默认'first'
    const isPriorityReceived = ref(false)  // 是否收到优先玩家的牌
    const isFirstRoundForChoice = ref(false)  // 是否是第一回合（用于选择观看手牌倒计时）
    const viewCardTimer = ref(10)  // 选择观看手牌倒计时
    const orderLocked = ref(false)  // 顺序是否已锁定
    
    // 地图配置相关
    const mapSizeOptions = ref(GAME_CONFIG.MAP_SIZE_OPTIONS)
    const selectedMapSize = ref(null)
    const selectedFogEnabled = ref(true)  // 默认选择"有"迷雾
    const selectedTheme = ref('random')  // 默认选择"随机"主题
    
    // 主题选项（用于UI显示）
    const themeOptions = computed(() => {
      return THEME_LIST.map(id => ({
        id: id,
        name: MAP_THEMES[id].name,
        icon: MAP_THEMES[id].icon
      }))
    })
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
    const showColdWaveEffect = ref(false)  // 寒流特效状态
    const isFrozenRound = ref(false)  // 寒流回合标志（跳过出牌流程）
    
    // 发牌动画状态
    const dealingCards = ref([])  // 正在发的牌
    const showDealingAnimation = ref(false)  // 是否显示发牌动画
    const isDealingAnimating = ref(false)  // 发牌动画进行中（用于禁用卡牌点击）
    const availableCardsRef = ref(null)  // 可选卡牌区域DOM引用
    
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
    
    // 监听 dontShowRules 变化，即时保存到 localStorage
    watch(dontShowRules, (newVal) => {
      localStorage.setItem('dontShowRules', String(newVal))
    })
    
    // 监听主题变化，切换到随机时清空地图大小选择
    watch(selectedTheme, (newTheme) => {
      if (newTheme === 'random') {
        selectedMapSize.value = null
      }
    })
    
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
    
    // 技能相关状态
    const player1AvatarId = ref(null)
    const player2AvatarId = ref(null)
    
    // 设置面板相关
    const showSettings = ref(false)
    
    // ==================== 随机事件悬停浮窗相关 ====================
    const hoveredThemeId = ref(null)  // 当前悬停的主题ID
    const showEventTooltip = ref(false)  // 是否显示随机事件浮窗
    const tooltipPosition = ref({ x: 0, y: 0 })  // 浮窗位置
    let hoverTimeout = null  // 悬停延迟定时器
    
    // 当前悬停的随机事件信息
    const hoveredEvent = computed(() => {
      if (!hoveredThemeId.value || !MAP_EVENTS[hoveredThemeId.value]) return null
      return MAP_EVENTS[hoveredThemeId.value]
    })
    
    // 当前地图主题对应的随机事件信息
    const currentMapEvent = computed(() => {
      if (!currentTheme.value || !MAP_EVENTS[currentTheme.value.id]) return null
      return MAP_EVENTS[currentTheme.value.id]
    })
    
    // 鼠标进入主题按钮 - 显示随机事件浮窗
    const handleThemeMouseEnter = (themeId, event) => {
      // 清除之前的延迟定时器
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
      // 设置0.5秒延迟后显示浮窗
      hoverTimeout = setTimeout(() => {
        hoveredThemeId.value = themeId
        // 计算浮窗位置（在按钮下方10px处，水平居中）
        const rect = event.target.getBoundingClientRect()
        tooltipPosition.value = {
          x: rect.left + rect.width / 2,
          y: rect.bottom + 10
        }
        showEventTooltip.value = true
      }, 500)
    }
    
    // 鼠标离开主题按钮 - 隐藏随机事件浮窗
    const handleThemeMouseLeave = () => {
      // 清除定时器
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
        hoverTimeout = null
      }
      // 隐藏浮窗并重置悬停主题ID
      showEventTooltip.value = false
      hoveredThemeId.value = null
    }
    
    // ==================== ID匹配相关状态 ====================
    const selectedMatchMode = ref('') // '' | 'room' | 'id'
    const showIdMatchLobby = ref(false)
    const showInvitationDialog = ref(false)
    const currentInvitation = ref(null)
    const idMatchLobbyRef = ref(null)
    
    // 是否为单人模式
    const isSoloMode = ref(false)
    
    // 选择匹配模式
    const selectMatchMode = (mode) => {
      if (mode === 'solo') {
        // 单人模式：直接开始，不再选择AI类型
        isSoloMode.value = true
        socket.value.emit('start_solo_game', { 
          avatarId: myAvatarId.value,
          difficulty: 'normal'
        })
        return
      }
      selectedMatchMode.value = mode
      if (mode === 'id') {
        showIdMatchLobby.value = true
      }
    }
    
    // 开始单人游戏（选择AI类型后）
    const startSoloGame = (aiType) => {
      isSoloMode.value = true
      socket.value.emit('start_solo_game', { 
        avatarId: myAvatarId.value,
        difficulty: 'normal',
        aiType: aiType  // 'rule' 或 'neural'
      })
    }
    
    // ID匹配成功
    const onIdMatchFound = (data) => {
      console.log('[客户端] ID匹配成功:', data)
      showIdMatchLobby.value = false
      selectedMatchMode.value = ''  // 重置匹配模式
      
      // 设置房间信息
      if (data?.roomCode) {
        currentRoom.value = data.roomCode
        roomCode.value = data.roomCode
      }
      
      // 设置玩家身份（服务端会告知是玩家1还是玩家2）
      if (data?.isPlayer1 !== undefined) {
        isPlayer1.value = data.isPlayer1
        console.log('[客户端] 设置玩家身份: isPlayer1 =', data.isPlayer1)
      }
      
      // 进入等待配置阶段，等待服务器发送 enter_configuring 事件
      gameState.value.phase = 'waiting_config'
    }
    
    // 离开ID匹配大厅
    const onLeaveIdLobby = () => {
      showIdMatchLobby.value = false
      selectedMatchMode.value = ''  // 重置匹配模式，返回主界面
    }
    
    // 收到对战邀请
    const onInvitationReceived = (invitation) => {
      currentInvitation.value = invitation
      showInvitationDialog.value = true
    }
    
    // 接受邀请
    const onAcceptInvitation = (invitationId) => {
      showInvitationDialog.value = false
      if (idMatchLobbyRef.value) {
        idMatchLobbyRef.value.acceptInvitation(invitationId)
      }
    }
    
    // 拒绝邀请
    const onRejectInvitation = (invitationId) => {
      showInvitationDialog.value = false
      if (idMatchLobbyRef.value) {
        idMatchLobbyRef.value.rejectInvitation(invitationId)
      }
    }
    
    // 打开设置面板
    const openSettings = () => {
      showSettings.value = true
    }
    
    // 关闭设置面板
    const closeSettings = () => {
      showSettings.value = false
    }
    
    // 粒子背景样式数组（初始化时生成，避免重新渲染时变化）
    const particleStyles = ref([])
    
    // 游戏内粒子样式数组
    const gameParticleStyles = ref([])
    
    // 生成固定的粒子样式（主界面气泡）
    const generateParticleStyles = () => {
      const styles = []
      for (let i = 0; i < 20; i++) {
        const size = Math.random() * 10 + 5 // 5-15px
        const left = Math.random() * 100 // 0-100%
        const delay = Math.random() * -35 // 使用负值，让粒子初始位置随机分布
        const duration = Math.random() * 20 + 15 // 15-35s
        const opacity = Math.random() * 0.4 + 0.1 // 0.1-0.5
        styles.push({
          width: `${size}px`,
          height: `${size}px`,
          left: `${left}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          opacity: opacity
        })
      }
      particleStyles.value = styles
    }
    
    // 从颜色生成渐变色（浅色 -> 主色 -> 深色）
    const generateGradientColors = (baseColor) => {
      // 解析颜色
      let r, g, b
      if (baseColor.startsWith('#')) {
        const hex = baseColor.slice(1)
        r = parseInt(hex.substr(0, 2), 16)
        g = parseInt(hex.substr(2, 2), 16)
        b = parseInt(hex.substr(4, 2), 16)
      } else {
        // 默认返回原色
        return { light: baseColor, main: baseColor, dark: baseColor }
      }
      
      // 生成浅色（提亮）
      const lightR = Math.min(255, r + 60)
      const lightG = Math.min(255, g + 60)
      const lightB = Math.min(255, b + 60)
      const light = `#${lightR.toString(16).padStart(2,'0')}${lightG.toString(16).padStart(2,'0')}${lightB.toString(16).padStart(2,'0')}`
      
      // 主色
      const main = baseColor
      
      // 生成深色（加深）
      const darkR = Math.max(0, r - 50)
      const darkG = Math.max(0, g - 50)
      const darkB = Math.max(0, b - 50)
      const dark = `#${darkR.toString(16).padStart(2,'0')}${darkG.toString(16).padStart(2,'0')}${darkB.toString(16).padStart(2,'0')}`
      
      return { light, main, dark }
    }

    // 生成SVG粒子图形 - 使用传入的颜色生成动态渐变
    const generateParticleSVG = (shape, color, size) => {
      // 生成唯一ID避免SVG渐变ID冲突
      const uniqueId = Math.random().toString(36).substr(2, 9)
      const grad = generateGradientColors(color)
      
      switch (shape) {
        case 'leaf':
          // 森林 - 精美树叶
          const leafShapes = [
            // 椭圆叶 - 带叶脉
            `<svg width="${size}" height="${size * 1.25}" viewBox="0 0 40 50">
              <defs>
                <linearGradient id="leaf1_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <ellipse cx="20" cy="25" rx="15" ry="22" fill="url(#leaf1_${uniqueId})" transform="rotate(-20, 20, 25)"/>
              <path d="M20 5 Q22 25 20 45" stroke="${grad.dark}" stroke-width="1.5" fill="none" opacity="0.6"/>
              <path d="M20 15 Q12 20 8 25" stroke="${grad.dark}" stroke-width="0.8" fill="none" opacity="0.4"/>
              <path d="M20 25 Q28 30 32 35" stroke="${grad.dark}" stroke-width="0.8" fill="none" opacity="0.4"/>
            </svg>`,
            // 枫叶
            `<svg width="${size}" height="${size}" viewBox="0 0 45 45">
              <defs>
                <linearGradient id="leaf2_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </linearGradient>
              </defs>
              <path d="M22 2 L26 15 L40 12 L30 22 L42 30 L28 28 L30 42 L22 32 L14 42 L16 28 L2 30 L14 22 L4 12 L18 15 Z" fill="url(#leaf2_${uniqueId})"/>
            </svg>`,
            // 尖叶
            `<svg width="${size * 0.75}" height="${size * 1.1}" viewBox="0 0 30 45">
              <defs>
                <linearGradient id="leaf3_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <path d="M15 2 Q28 20 15 43 Q2 20 15 2" fill="url(#leaf3_${uniqueId})"/>
              <path d="M15 5 L15 40" stroke="${grad.dark}" stroke-width="1" fill="none" opacity="0.5"/>
            </svg>`,
            // 圆叶
            `<svg width="${size}" height="${size}" viewBox="0 0 35 35">
              <defs>
                <linearGradient id="leaf4_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <circle cx="17.5" cy="17.5" r="15" fill="url(#leaf4_${uniqueId})"/>
              <path d="M17.5 5 L17.5 30" stroke="${grad.dark}" stroke-width="1" fill="none" opacity="0.4"/>
              <path d="M8 12 Q17.5 17.5 27 12" stroke="${grad.dark}" stroke-width="0.6" fill="none" opacity="0.3"/>
            </svg>`
          ]
          return leafShapes[Math.floor(Math.random() * leafShapes.length)]
        
        case 'sand':
          // 沙漠 - 精美沙粒
          const sandShapes = [
            // 不规则沙粒
            `<svg width="${size}" height="${size}" viewBox="0 0 18 18">
              <defs>
                <linearGradient id="sand1_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <polygon points="5,2 15,4 16,12 11,16 3,14 2,7" fill="url(#sand1_${uniqueId})"/>
            </svg>`,
            // 圆形沙粒
            `<svg width="${size * 0.9}" height="${size * 0.9}" viewBox="0 0 14 14">
              <defs>
                <radialGradient id="sand2_${uniqueId}" cx="30%" cy="30%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </radialGradient>
              </defs>
              <circle cx="7" cy="7" r="6" fill="url(#sand2_${uniqueId})"/>
            </svg>`,
            // 星形沙粒
            `<svg width="${size}" height="${size}" viewBox="0 0 16 16">
              <defs>
                <linearGradient id="sand3_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <polygon points="8,1 10,5 15,5 11,8 13,14 8,10 3,14 5,8 1,5 6,5" fill="url(#sand3_${uniqueId})"/>
            </svg>`,
            // 椭圆沙粒
            `<svg width="${size * 1.2}" height="${size * 0.7}" viewBox="0 0 20 12">
              <defs>
                <linearGradient id="sand4_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <ellipse cx="10" cy="6" rx="9" ry="5" fill="url(#sand4_${uniqueId})"/>
            </svg>`
          ]
          return sandShapes[Math.floor(Math.random() * sandShapes.length)]
        
        case 'snow':
          // 冰原 - 精美雪花
          const snowShapes = [
            // 六角雪花
            `<svg width="${size}" height="${size}" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="snow1_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </linearGradient>
              </defs>
              <g fill="url(#snow1_${uniqueId})">
                <polygon points="20,2 22,18 38,20 22,22 20,38 18,22 2,20 18,18"/>
                <polygon points="20,8 28,12 32,20 28,28 20,32 12,28 8,20 12,12" opacity="0.5"/>
              </g>
            </svg>`,
            // 圆形雪
            `<svg width="${size * 0.9}" height="${size * 0.9}" viewBox="0 0 35 35">
              <defs>
                <linearGradient id="snow2_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </linearGradient>
              </defs>
              <circle cx="17.5" cy="17.5" r="16" fill="url(#snow2_${uniqueId})" opacity="0.8"/>
              <circle cx="17.5" cy="17.5" r="10" fill="white" opacity="0.6"/>
              <circle cx="17.5" cy="17.5" r="4" fill="white"/>
            </svg>`,
            // 星形雪
            `<svg width="${size}" height="${size}" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="snow3_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </linearGradient>
              </defs>
              <g stroke="url(#snow3_${uniqueId})" stroke-width="2" fill="none">
                <line x1="20" y1="5" x2="20" y2="35"/>
                <line x1="5" y1="20" x2="35" y2="20"/>
                <line x1="8" y1="8" x2="32" y2="32"/>
                <line x1="32" y1="8" x2="8" y2="32"/>
              </g>
              <circle cx="20" cy="20" r="4" fill="white"/>
            </svg>`,
            // 菱形雪
            `<svg width="${size * 0.75}" height="${size}" viewBox="0 0 30 30">
              <defs>
                <radialGradient id="snow4_${uniqueId}" cx="50%" cy="50%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="70%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </radialGradient>
              </defs>
              <polygon points="15,1 17,11 27,13 17,15 15,29 13,15 3,13 13,11" fill="url(#snow4_${uniqueId})"/>
            </svg>`
          ]
          return snowShapes[Math.floor(Math.random() * snowShapes.length)]
        
        case 'ember':
          // 火山 - 精美火星
          const emberShapes = [
            // 圆形火星
            `<svg width="${size}" height="${size}" viewBox="0 0 20 20">
              <defs>
                <radialGradient id="ember1_${uniqueId}" cx="30%" cy="30%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="50%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </radialGradient>
              </defs>
              <circle cx="10" cy="10" r="9" fill="url(#ember1_${uniqueId})"/>
            </svg>`,
            // 火焰
            `<svg width="${size * 0.6}" height="${size}" viewBox="0 0 15 25">
              <defs>
                <linearGradient id="ember2_${uniqueId}" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" style="stop-color:${grad.dark}"/>
                  <stop offset="50%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.light}"/>
                </linearGradient>
              </defs>
              <ellipse cx="7.5" cy="12.5" rx="6" ry="12" fill="url(#ember2_${uniqueId})"/>
            </svg>`,
            // 星形火星
            `<svg width="${size * 0.9}" height="${size * 0.9}" viewBox="0 0 18 18">
              <defs>
                <radialGradient id="ember3_${uniqueId}" cx="50%" cy="50%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.main}"/>
                </radialGradient>
              </defs>
              <polygon points="9,1 12,6 17,6 13,10 15,16 9,12 3,16 5,10 1,6 6,6" fill="url(#ember3_${uniqueId})"/>
            </svg>`,
            // 余烬
            `<svg width="${size * 1.3}" height="${size * 0.5}" viewBox="0 0 25 10">
              <defs>
                <linearGradient id="ember4_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:${grad.main}" stop-opacity="0"/>
                  <stop offset="50%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.light}" stop-opacity="0"/>
                </linearGradient>
              </defs>
              <ellipse cx="12.5" cy="5" rx="12" ry="4" fill="url(#ember4_${uniqueId})"/>
            </svg>`
          ]
          return emberShapes[Math.floor(Math.random() * emberShapes.length)]
        
        case 'dust':
          // 古城 - 精美灰尘
          const dustShapes = [
            // 圆形灰尘
            `<svg width="${size}" height="${size}" viewBox="0 0 14 14">
              <defs>
                <radialGradient id="dust1_${uniqueId}" cx="30%" cy="30%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </radialGradient>
              </defs>
              <circle cx="7" cy="7" r="6" fill="url(#dust1_${uniqueId})"/>
            </svg>`,
            // 不规则灰尘
            `<svg width="${size}" height="${size}" viewBox="0 0 16 16">
              <defs>
                <linearGradient id="dust2_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <polygon points="4,2 12,3 15,9 11,14 5,13 2,7" fill="url(#dust2_${uniqueId})"/>
            </svg>`,
            // 椭圆灰尘
            `<svg width="${size * 1.2}" height="${size * 0.7}" viewBox="0 0 18 10">
              <defs>
                <linearGradient id="dust3_${uniqueId}" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:${grad.main}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </linearGradient>
              </defs>
              <ellipse cx="9" cy="5" rx="8" ry="4" fill="url(#dust3_${uniqueId})"/>
            </svg>`,
            // 方块灰尘
            `<svg width="${size * 0.85}" height="${size * 0.85}" viewBox="0 0 12 12">
              <defs>
                <radialGradient id="dust4_${uniqueId}" cx="50%" cy="50%">
                  <stop offset="0%" style="stop-color:${grad.light}"/>
                  <stop offset="100%" style="stop-color:${grad.dark}"/>
                </radialGradient>
              </defs>
              <rect x="1" y="1" width="10" height="10" rx="2" fill="url(#dust4_${uniqueId})" transform="rotate(15, 6, 6)"/>
            </svg>`
          ]
          return dustShapes[Math.floor(Math.random() * dustShapes.length)]
        
        default:
          return `<svg width="${size}" height="${size}" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4" fill="${color}"/>
          </svg>`
      }
    }
    
    // 生成游戏内粒子样式（根据主题）
    const generateGameParticleStyles = () => {
      if (!currentTheme.value?.particleStyle) {
        gameParticleStyles.value = []
        return
      }
      
      const style = currentTheme.value.particleStyle
      const particles = []
      
      for (let i = 0; i < style.count; i++) {
        const size = Math.random() * (style.sizeMax - style.sizeMin) + style.sizeMin
        const left = Math.random() * 100
        const duration = Math.random() * (style.speedMax - style.speedMin) + style.speedMin
        const delay = Math.random() * -duration  // 延迟范围限制在 -duration 内，确保粒子始终可见
        const opacity = Math.random() * (style.opacityMax - style.opacityMin) + style.opacityMin
        const color = style.colors[Math.floor(Math.random() * style.colors.length)]
        const swing = Math.random() * 100 - 50 // 左右摆动幅度
        
        // 生成SVG图形
        const svg = generateParticleSVG(style.shape, color, size)
        
        particles.push({
          svg: svg,
          style: {
            left: `${left}%`,
            animationDelay: `${delay}s`,
            animationDuration: `${duration}s`,
            '--swing': `${swing}px`,
            '--particle-color': color,
            '--particle-opacity': opacity
          }
        })
      }
      
      gameParticleStyles.value = particles
    }
    
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
      // 播放点击音效
      audioManager.playClick()
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
    
    // 是否处于选牌阶段
    const isSelectingPhase = computed(() => {
      return gameState.value.phase === 'selecting_priority' || 
             gameState.value.phase === 'selecting_normal' ||
             gameState.value.phase === 'ordering_priority' ||
             gameState.value.phase === 'ordering_normal'
    })
    
    // 获取当前玩家的主动技能
    const myActiveSkill = computed(() => {
      if (isPlayer1.value) {
        return player1Skill.value?.skillType === 'active' ? player1Skill.value : null
      } else {
        return player2Skill.value?.skillType === 'active' ? player2Skill.value : null
      }
    })
    
    // 获取当前玩家的技能冷却
    const mySkillCooldown = computed(() => {
      return isPlayer1.value ? player1SkillCooldown.value : player2SkillCooldown.value
    })
    
    // 计算当前选中的牌数（技能牌索引已在selectedCards中，无需额外计数）
    const totalSelectedCount = computed(() => {
      return selectedCards.value.length
    })
    
    // 检查是否可以确认选牌（技能牌和普通牌统一计算，选满3张即可）
    const canConfirmSelection = computed(() => {
      return selectedCards.value.length === 3
    })
    
    // 检查是否可以选择卡牌（在选牌阶段）
    const canSelectSkillInSelection = computed(() => {
      // 统一逻辑：没选满3张就可以选
      return selectedCards.value.length < 3
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
      
      // 单人模式开始
      socket.value.on('solo_game_started', (data) => {
        console.log('[客户端] 单人模式开始:', data)
        currentRoom.value = data.roomCode
        isPlayer1.value = data.isPlayer1
        isSoloMode.value = true
        // 进入地图配置阶段（单人模式下人类玩家就是房主）
        gameState.value.phase = 'configuring'
        // 使用 socket.value.id 而不是 socketId.value，确保获取最新的 socket ID
        creatorId.value = socket.value.id  // 单人模式自己就是房主
        console.log('[客户端] 单人模式设置 creatorId:', creatorId.value, 'socketId:', socketId.value)
        // 在配置界面播放背景音乐
        audioManager.playBgmusic()
      })
      
      // 进入地图配置阶段
      socket.value.on('enter_configuring', (data) => {
        console.log('[客户端] 进入地图配置阶段:', data)
        gameState.value.phase = data.phase
        mapSizeOptions.value = data.mapSizeOptions
        creatorId.value = data.creatorId
        selectedMapSize.value = null
        // 重置技能相关状态（确保再来一局时技能CD刷新）
        player1SkillCooldown.value = 0
        player2SkillCooldown.value = 0
        skillSelected.value = false
        console.log('[客户端] 已重置技能CD状态')
        // 在配置界面播放背景音乐
        audioManager.playBgmusic()
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
        // 保存玩家形象ID和技能信息
        if (data.players) {
          if (data.players[0]) {
            player1AvatarId.value = data.players[0].avatarId
            // 保存玩家1技能信息
            if (data.players[0].skill) {
              player1Skill.value = data.players[0].skill
              player1SkillCooldown.value = data.players[0].skillCooldown || 0
            }
          }
          if (data.players[1]) {
            player2AvatarId.value = data.players[1].avatarId
            // 保存玩家2技能信息
            if (data.players[1].skill) {
              player2Skill.value = data.players[1].skill
              player2SkillCooldown.value = data.players[1].skillCooldown || 0
            }
          }
        }
        // 兼容旧格式：直接从data读取技能信息
        if (data.player1Skill) {
          player1Skill.value = data.player1Skill
          player1SkillCooldown.value = data.player1SkillCooldown || 0
        }
        if (data.player2Skill) {
          player2Skill.value = data.player2Skill
          player2SkillCooldown.value = data.player2SkillCooldown || 0
        }
        // 古城技能封印状态
        if (data.skillSealed !== undefined) {
          skillSealed.value = data.skillSealed
          console.log('[客户端] 技能封印状态:', skillSealed.value)
        }
        // 保存主题数据并显示地图名称
        if (data.theme) {
          currentTheme.value = data.theme
          console.log('[客户端] 当前地图主题:', data.theme.nameCn)
          // 生成游戏内粒子样式
          generateGameParticleStyles()
          // 显示地图名称界面
          showMapName.value = true
          setTimeout(() => {
            showMapName.value = false
          }, 2500)
        }
        // 播放背景音乐
        audioManager.playBgmusic()
      })
      
      // 处理回合开始事件（双方同时显示"进入第X回合"提示）
      socket.value.on('round_start', (data) => {
        console.log('[客户端] 收到round_start:', data)
        
        nextRound.value = data.round
        showRoundTransition.value = true
        audioManager.playSwordCrash()
        
        // 1.5秒后隐藏提示
        setTimeout(() => {
          showRoundTransition.value = false
        }, 1500)
      })
      
      // 处理发牌事件（只负责发牌动画）
      socket.value.on('deal_cards', (data) => {
        console.log('[客户端] 收到deal_cards:', data)
        startDealingAnimation(data)
      })
      
      // 计算发牌动画中每张牌的目标位置（fallback方案）
      const calculateCardPositions = (cardCount) => {
        const cardWidth = 100  // 卡牌宽度
        const gap = 16         // 间距 1rem = 16px
        
        // 总宽度
        const totalWidth = cardCount * cardWidth + (cardCount - 1) * gap
        const startX = (window.innerWidth - totalWidth) / 2
        
        // 卡牌区域在屏幕中的Y位置（选牌区在下方，约65%位置）
        // 需要增加偏移量来补偿：提示文字(约24px) + 进度条(约48px) + 间距(约24px) = 96px
        const offsetY = 96  // 提示文字 + 进度条 + 间距的高度
        const targetY = window.innerHeight * 0.65 + offsetY
        
        return Array.from({ length: cardCount }, (_, i) => ({
          x: startX + i * (cardWidth + gap) + cardWidth / 2 - window.innerWidth / 2,
          y: targetY - window.innerHeight / 2
        }))
      }
      
      // 获取实际卡牌位置（通过DOM）
      const getActualCardPositions = (cardCount) => {
        if (!availableCardsRef.value) {
          return calculateCardPositions(cardCount)
        }
        
        const cards = availableCardsRef.value.querySelectorAll('.card')
        const positions = []
        const centerX = window.innerWidth / 2
        const centerY = window.innerHeight / 2
        
        cards.forEach((cardEl) => {
          const rect = cardEl.getBoundingClientRect()
          positions.push({
            x: rect.left + rect.width / 2 - centerX,
            y: rect.top + rect.height / 2 - centerY
          })
        })
        
        return positions
      }
      
      // 发牌动画函数 - 预发空牌方案：通过DOM获取精确位置
      const startDealingAnimation = (data) => {
        selectedCards.value = []
        skillSelected.value = false  // 重置技能选择状态
        isDealingAnimating.value = true
        
        // 接收并保存技能信息
        if (data.player1Skill) {
          player1Skill.value = data.player1Skill
          player1SkillCooldown.value = data.player1SkillCooldown || 0
        }
        if (data.player2Skill) {
          player2Skill.value = data.player2Skill
          player2SkillCooldown.value = data.player2SkillCooldown || 0
        }
        
        // 1. 立即切换到选牌阶段
        if (data.isPriority) {
          gameState.value.phase = 'selecting_priority'
          startSelectTimer()
        } else {
          gameState.value.phase = 'selecting_normal'
          startSelectTimer()
        }
        
        // 2. 预发占位牌（使用空对象，渲染真实内容但不可见）
        currentCards.value = data.cards.map(() => ({ icon: '', name: '' }))
        
        // 3. 等待DOM渲染后获取占位牌位置（增加延迟确保渲染完成）
        setTimeout(() => {
          // 获取占位牌DOM元素的实际位置
          const cardElements = availableCardsRef.value?.querySelectorAll('.card')
          const cardPositions = []
          
          console.log('[客户端] availableCardsRef:', availableCardsRef.value)
          console.log('[客户端] cardElements数量:', cardElements?.length)
          
          if (cardElements && cardElements.length > 0) {
            const centerX = window.innerWidth / 2
            const centerY = window.innerHeight / 2
            cardElements.forEach((el, idx) => {
              const rect = el.getBoundingClientRect()
              console.log(`[客户端] 卡牌${idx} rect:`, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })
              cardPositions.push({
                x: rect.left + rect.width / 2 - centerX,
                y: rect.top + rect.height / 2 - centerY
              })
            })
            console.log('[客户端] 从DOM获取占位牌位置:', cardPositions)
          } else {
            // fallback：使用计算位置
            const fallbackPositions = calculateCardPositions(data.cards.length)
            cardPositions.push(...fallbackPositions)
            console.log('[客户端] 使用fallback计算位置:', cardPositions)
          }
          
          // 4. 保持占位牌占据空间（不清空），但标记为动画中
          // 占位牌会继续显示并占据空间，保证按钮位置正确
          
          // 5. 播放发牌动画（牌从屏幕中心飞向各自位置）
          showDealingAnimation.value = true
          dealingCards.value = data.cards.map((card, index) => ({
            card,
            index,
            targetX: cardPositions[index].x,
            targetY: cardPositions[index].y,
            animating: true
          }))
          
          console.log('[客户端] 开始发牌动画，卡牌数量:', data.cards.length)
          
          // 6. 播放发牌音效
          audioManager.playCardslide()
          
          // 7. 动画结束后设置真实卡牌并启用点击
          const animationDuration = 100 + (data.cards.length - 1) * 120 + 400
          
          setTimeout(() => {
            showDealingAnimation.value = false
            dealingCards.value = []
            // 动画结束后设置真实卡牌（卡牌"落地"显示）
            currentCards.value = data.cards
            isDealingAnimating.value = false  // 启用点击
            opponentFirstCard.value = null
            isPriorityReceived.value = data.isPriority
            
            // ========== 女盗贼技能：隔墙有眼 ==========
            // 如果女盗贼技能触发，直接设置对手的第一张和最后一张手牌
            if (data.wallSkillTriggered && data.opponentFirstAndLastCard) {
              console.log('[客户端] 女盗贼技能触发，设置对手手牌显示:', data.opponentFirstAndLastCard)
              opponentFirstAndLastCard.value = data.opponentFirstAndLastCard
              // 同时设置 viewedOpponentCard 为第一张牌（默认显示第一张）
              viewedOpponentCard.value = data.opponentFirstAndLastCard.firstCard
              viewedCardChoice.value = 'first'
              // 设置 opponentFirstCard 以便在选牌和排序阶段显示
              opponentFirstCard.value = data.opponentFirstAndLastCard.firstCard
              
              // 显示技能触发提示弹窗
              wallSkillRevealedCards.value = {
                firstCard: data.opponentFirstAndLastCard.firstCard,
                lastCard: data.opponentFirstAndLastCard.lastCard,
                totalCards: data.opponentFirstAndLastCard.totalCards || 3
              }
              showWallSkillReveal.value = true
              console.log('[客户端] 显示女盗贼技能触发弹窗')
            } else {
              // 女盗贼技能未触发，清空两张牌的显示（确保不会显示上一回合的数据）
              opponentFirstAndLastCard.value = { firstCard: null, lastCard: null }
            }
          }, animationDuration)
        }, 50)  // 等待DOM渲染后获取占位牌位置
      }

      // 后手玩家收到先手的第一张牌
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
      // 注意：普通后手玩家只能选择一张牌，不应该设置 opponentFirstAndLastCard（两张牌）
      // opponentFirstAndLastCard 只在女盗贼技能触发时设置（见 deal_cards 处理）
      socket.value.on('choose_opponent_card_to_view', (data) => {
        console.log('[客户端] 收到选择观看对手手牌:', data)
        // 不设置 opponentFirstAndLastCard，让玩家选择后只显示一张牌
        // 保存数据用于弹窗选择，但不直接显示在界面上
        chooseOpponentCardData.value = {
          firstCard: data.firstCard,
          lastCard: data.lastCard
        }
        // 使用上次选择作为默认值（第一次默认'first'）
        viewedCardChoice.value = lastViewedCardChoice.value
        chooseOpponentCardVisible.value = true
        // 所有回合都启动倒计时
        startViewCardTimer()
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
        
        // 如果是自己打出的牌，立即更新手牌"已打出"状态
        if (isMyCard) {
          currentPlayIndex.value = data.cardIndex + 1
        }
        
        // 启动飞牌动画（纯视觉效果）
        // 先在中央展示，然后飞到出牌区
        flyingCard.value = {
          card: data.card,
          direction: isMyCard ? 'from-bottom' : 'from-top',
          isMyCard: isMyCard,
          isPriorityTurn: isPriorityTurn
        }
        
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
        // 注意：不再在这里更新 currentPlayIndex，因为它已经在 card_played 事件中正确设置
        // 这样可以确保每张牌打出后立即显示"已出"状态
        
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
      
      // 技能特效
      socket.value.on('skill_effect', (data) => {
        console.log('[客户端] 技能特效:', data)
        
        // 女盗贼技能：隔墙有眼 - 查看对手手牌
        if (data.skillId === 'thief_female_wall') {
          console.log('[调试] ====== 客户端收到女盗贼隔墙有眼 ======')
          console.log('[调试] 完整data对象:', JSON.stringify(data))
          // 正确读取 data.revealedCards 对象
          const revealed = data.revealedCards || data
          console.log('[调试] revealed对象:', JSON.stringify(revealed))
          console.log('[调试] firstCard:', JSON.stringify(revealed.firstCard))
          console.log('[调试] lastCard:', JSON.stringify(revealed.lastCard))
          console.log('[调试] totalCards:', revealed.totalCards)
          
          wallSkillRevealedCards.value = {
            firstCard: revealed.firstCard,
            lastCard: revealed.lastCard,
            totalCards: revealed.totalCards
          }
          console.log('[调试] wallSkillRevealedCards.value已设置:', JSON.stringify(wallSkillRevealedCards.value))
          
          showWallSkillReveal.value = true
          console.log('[调试] showWallSkillReveal.value已设置为true')
          // 不再自动关闭，让用户手动关闭或在回合结束时清除
          return
        }
        
        if (gameBoardRef.value) {
          gameBoardRef.value.setSkillEffect(data)
        }
      })
      
      // 障碍物销毁特效
      socket.value.on('obstacle_destroyed', (data) => {
        console.log('[客户端] 障碍物销毁:', data)
        if (gameBoardRef.value) {
          gameBoardRef.value.setObstacleDestroyed(data)
        }
      })
      
      // 寒流事件 - 冰原主题随机事件
      socket.value.on('cold_wave_triggered', (data) => {
        console.log('[客户端] 寒流触发:', data)
        showColdWaveEffect.value = true
        gameMessage.value = data.message
        messageType.value = 'warning'
        // 寒流特效持续整个出牌阶段，在 round_end 事件中关闭
      })
      
      // 沙丘移动事件（沙漠主题地图事件）
      socket.value.on('sand_dunes_moved', (data) => {
        console.log('[客户端] 沙丘移动:', data)
        // 更新地图中的沙丘位置
        if (data.sandDunes && gameState.value.map) {
          gameState.value.map.sandDunes = data.sandDunes
        }
        // 设置沙丘残影效果（旧位置渐隐 + 新位置汇聚）
        if (data.movedDunes && data.movedDunes.length > 0) {
          // 记录残影位置（旧位置）和出现位置（新位置）
          const duneGhostPositions = data.movedDunes.map(d => d.from)
          const duneAppearPositions = data.movedDunes.map(d => d.to)
          // 存储到地图对象中供 GameBoard 使用
          gameState.value.map.duneGhostPositions = duneGhostPositions
          gameState.value.map.duneAppearPositions = duneAppearPositions
          // 1.5秒后清除残影
          setTimeout(() => {
            if (gameState.value.map.duneGhostPositions === duneGhostPositions) {
              gameState.value.map.duneGhostPositions = []
              gameState.value.map.duneAppearPositions = []
            }
          }, 1500)
        }
        if (data.message) {
          gameMessage.value = data.message
          messageType.value = 'warning'
        }
      })

      // 火球事件（火山主题随机事件）
      socket.value.on('fireball_event', (data) => {
        console.log('[客户端] 火球触发:', data)
        
        // 显示火球特效
        if (gameBoardRef.value) {
          gameBoardRef.value.setFireballEffect(data)
        }
        
        // 显示消息提示
        gameMessage.value = data.message || '🔥 天降火球！障碍物被摧毁！'
        messageType.value = 'info'
      })

      // 火球伤害结果（更新地图和玩家HP）
      socket.value.on('fireball_damage', (data) => {
        console.log('[客户端] 火球伤害结果:', data)
        
        // 更新地图数据
        if (data.map && gameState.value.map) {
          gameState.value.map.obstacles = data.map.obstacles
          gameState.value.map.portals = data.map.portals
        }
        
        // 更新玩家HP（火球击中玩家）
        if (data.hitPlayers && data.hitPlayers.length > 0) {
          for (const hit of data.hitPlayers) {
            // 更新玩家HP
            if (gameState.value.players && gameState.value.players[hit.playerIndex]) {
              if (!hit.defended) {
                gameState.value.players[hit.playerIndex].hp -= 1
              }
            }
            // 通知GameBoard播放火球击中玩家特效
            if (gameBoardRef.value) {
              gameBoardRef.value.setFireballHitPlayer(hit)
            }
          }
        }
      })

      // 卡牌被冻结事件
      socket.value.on('card_frozen', (data) => {
        console.log('[客户端] 卡牌被冻结:', data)
        // 可以在这里添加冻结特效
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
        
        // 关闭寒流特效（回合结束时）
        showColdWaveEffect.value = false
        
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
        
        // 更新技能冷却显示（回合开始时同步）
        if (data.player1SkillCooldown !== undefined) {
          player1SkillCooldown.value = data.player1SkillCooldown
        }
        if (data.player2SkillCooldown !== undefined) {
          player2SkillCooldown.value = data.player2SkillCooldown
        }
        // 更新技能封印状态
        if (data.skillSealed !== undefined) {
          skillSealed.value = data.skillSealed
        }
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
        // 重置技能相关状态
        player1SkillCooldown.value = 0
        player2SkillCooldown.value = 0
        skillSelected.value = false
        console.log('[客户端] 已重置技能CD状态')
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
    
    // 卡牌选择（统一处理技能牌和普通牌）
    const toggleCardSelection = (index) => {
      // 古城封印：不允许选择被封印的技能牌
      const card = currentCards.value[index]
      if (card && card.isSkillCard && skillSealed.value) {
        console.log('[封印] 技能已被封印，无法选择')
        return
      }
      // 只有在选择阶段才能选择
      if (gameState.value.phase !== 'selecting_priority' && gameState.value.phase !== 'selecting_normal') return
      
      // 发牌动画期间禁用点击
      if (isDealingAnimating.value) return
      
      // 播放点击音效
      audioManager.playClick()
      // 只有当前玩家是优先/非优先玩家时才能选择
      if (gameState.value.phase === 'selecting_priority' && !isPriorityPlayer.value) return
      if (gameState.value.phase === 'selecting_normal' && isPriorityPlayer.value) return
      
      // 检查点击的是否是技能牌（card已在上面的封印检查中定义）
      const isSkillCard = card && card.isSkillCard
      
      // 统一选择逻辑：技能牌和普通牌一起计算，最多选3张
      const idx = selectedCards.value.indexOf(index)
      if (idx > -1) {
        // 取消选中
        selectedCards.value.splice(idx, 1)
        // 如果取消的是技能牌，同步取消 skillSelected
        if (isSkillCard) {
          skillSelected.value = false
          console.log('[技能] 通过选牌区取消选中技能牌')
        }
      } else {
        // 选中：检查数量限制（统一最多3张）
        if (selectedCards.value.length >= 3) {
          return
        }
        selectedCards.value.push(index)
        // 如果选中的是技能牌，同步设置 skillSelected
        if (isSkillCard) {
          skillSelected.value = true
          console.log('[技能] 通过选牌区选中技能牌')
        }
      }
    }
    
    // 处理 currentCards 中技能牌的点击（已整合到 toggleCardSelection）
    const handleSkillCardInCurrentCards = (index) => {
      // 统一使用 toggleCardSelection 处理
      toggleCardSelection(index)
    }
    
    // 处理技能卡牌点击
    const handleSkillClick = (playerIndex) => {
      // 只有自己的技能且是主动技能且不在冷却中才能选中
      const isMySkill = (playerIndex === 0 && isPlayer1.value) || (playerIndex === 1 && !isPlayer1.value)
      if (!isMySkill) return
      
      const skill = playerIndex === 0 ? player1Skill.value : player2Skill.value
      const cooldown = playerIndex === 0 ? player1SkillCooldown.value : player2SkillCooldown.value
      
      // 只有主动技能且不在冷却中才能操作
      if (!skill || skill.skillType !== 'active' || cooldown > 0) return
      
      // 只有在选牌阶段才能选择技能
      const canSelect = gameState.value.phase === 'selecting_priority' || gameState.value.phase === 'selecting_normal'
      if (!canSelect) return
      
      // 检查是否是当前应该选牌的玩家
      const isMyTurnToSelect = (gameState.value.phase === 'selecting_priority' && isPriorityPlayer.value) ||
                               (gameState.value.phase === 'selecting_normal' && !isPriorityPlayer.value)
      if (!isMyTurnToSelect) return
      
      // 找到 currentCards 中技能牌的索引
      const skillCardIndex = currentCards.value.findIndex(card => card && card.isSkillCard)
      
      // 切换选中状态
      if (skillSelected.value) {
        // 取消选中技能
        skillSelected.value = false
        // 同步从 selectedCards 中移除技能牌索引
        if (skillCardIndex !== -1) {
          const idx = selectedCards.value.indexOf(skillCardIndex)
          if (idx > -1) {
            selectedCards.value.splice(idx, 1)
          }
        }
        console.log(`[技能] 玩家${playerIndex + 1} 通过头像旁技能卡取消选中技能: ${skill.skillName}`)
      } else {
        // 选中技能：需要检查是否已选满3张牌
        if (selectedCards.value.length >= 3) {
          // 已选满3张，不能再选技能
          gameMessage.value = '已选满3张牌，请先取消选择其他牌'
          messageType.value = 'error'
          setTimeout(() => {
            gameMessage.value = ''
          }, 1500)
          return
        }
        skillSelected.value = true
        // 同步将技能牌索引添加到 selectedCards
        if (skillCardIndex !== -1 && !selectedCards.value.includes(skillCardIndex)) {
          selectedCards.value.push(skillCardIndex)
        }
        console.log(`[技能] 玩家${playerIndex + 1} 通过头像旁技能卡选中技能: ${skill.skillName}`)
      }
      
      // 播放点击音效
      audioManager.playClick()
    }
    
    const confirmCardSelection = () => {
      // 统一检查：必须选满3张牌
      if (selectedCards.value.length !== 3) return
      
      // 播放点击音效
      audioManager.playClick()
      
      const selected = selectedCards.value.map(i => currentCards.value[i])
      console.log('[客户端] 确认选牌:', selected)
      
      // 发送选牌结果（技能牌已包含在 selectedCards 中）
      socket.value.emit('select_cards', { 
        selectedCards: selectedCards.value
      })
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
          // 倒计时3秒时播放音效（需检查设置开关）
          if (selectTimer.value === 3 && audioManager.isCountdownSoundEnabled()) {
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
          // 倒计时3秒时播放音效（需检查设置开关）
          if (orderTimer.value === 3 && audioManager.isCountdownSoundEnabled()) {
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
      // 停止倒计时音效
      audioManager.stopCountdownSound()
    }
    
    // 选择观看手牌倒计时
    const startViewCardTimer = () => {
      viewCardTimer.value = 5
      stopTimer()
      timerInterval = setInterval(() => {
        if (viewCardTimer.value <= 0) {
          stopTimer()
          // 倒计时结束，使用当前选中的选项（默认是'first'，玩家可能已改为'last'）
          if (viewedCardChoice.value) {
            // 播放点击音效
            audioManager.playClick()
            // 保存玩家选择（记忆功能）
            lastViewedCardChoice.value = viewedCardChoice.value
            // 设置要显示的手牌（视觉反馈）- 使用 chooseOpponentCardData
            if (viewedCardChoice.value === 'first') {
              viewedOpponentCard.value = chooseOpponentCardData.value.firstCard
              opponentFirstCard.value = chooseOpponentCardData.value.firstCard
            } else {
              viewedOpponentCard.value = chooseOpponentCardData.value.lastCard
              opponentFirstCard.value = chooseOpponentCardData.value.lastCard
            }
            // 延迟发送，让用户看到选中效果
            setTimeout(() => {
              socket.value.emit('view_opponent_card', viewedCardChoice.value)
            }, 800)
          }
        } else {
          viewCardTimer.value--
          // 倒计时3秒时播放音效
          if (viewCardTimer.value === 3 && audioManager.isCountdownSoundEnabled()) {
            audioManager.playCountdown3s()
          }
        }
      }, 1000)
    }
    
    // 取消等待，返回主界面
    const cancelWaiting = () => {
      console.log('[客户端] 取消等待，返回主界面')
      
      // 播放点击音效
      audioManager.playClick()
      
      // 发送离开房间事件到服务器
      if (socket.value && currentRoom.value) {
        socket.value.emit('leave_room', currentRoom.value)
      }
      
      // 重置状态，返回主界面
      currentRoom.value = ''
      gameState.value.phase = 'connecting'
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
      // 重置单人模式标志
      isSoloMode.value = false
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
    
    // 获取主题特色地形信息
    const getThemeShapeInfo = (themeId) => {
      const shapeData = THEME_SHAPE_LAYOUTS[themeId]
      if (!shapeData) {
        return { icon: '🗺️', name: '特色地形', cells: 0 }
      }
      const cells = countThemeShapeCells(shapeData.layout)
      const theme = MAP_THEMES[themeId]
      return {
        icon: theme?.icon || '🗺️',
        name: shapeData.name,
        cells: cells
      }
    }
    
    const confirmMapSize = () => {
      if (!selectedMapSize.value) return
      console.log('[客户端] 确认地图配置:', selectedMapSize.value, '迷雾:', selectedFogEnabled.value, '主题:', selectedTheme.value)
      socket.value.emit('map_size_selected', { 
        mapSize: selectedMapSize.value, 
        fogEnabled: selectedFogEnabled.value,
        themeId: selectedTheme.value
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
      
      // 如果已在房间中，实时同步角色更新到服务器
      if (currentRoom.value && socket.value) {
        socket.value.emit('update_avatar', { avatarId })
        console.log('[客户端] 更新角色:', avatarId)
      }
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
    
    // 关闭女盗贼技能查看手牌弹窗
    const closeWallSkillReveal = () => {
      showWallSkillReveal.value = false
      audioManager.playClick()
      console.log('[调试] 用户关闭隔墙有眼弹窗，wallSkillRevealedCards数据保留:', JSON.stringify(wallSkillRevealedCards.value))
    }
    
    const confirmCardChoice = () => {
      if (!viewedCardChoice.value) return
      // 播放点击音效
      audioManager.playClick()
      console.log('[客户端] 选择查看对手的', viewedCardChoice.value, '牌')
      
      // 保存玩家选择（记忆功能）
      lastViewedCardChoice.value = viewedCardChoice.value
      
      // 设置要显示的手牌 - 使用 chooseOpponentCardData（普通后手玩家只能看到一张牌）
      if (viewedCardChoice.value === 'first') {
        viewedOpponentCard.value = chooseOpponentCardData.value.firstCard
        opponentFirstCard.value = chooseOpponentCardData.value.firstCard
      } else {
        viewedOpponentCard.value = chooseOpponentCardData.value.lastCard
        opponentFirstCard.value = chooseOpponentCardData.value.lastCard
      }
      
      // 发送选择到服务器
      socket.value.emit('view_opponent_card', viewedCardChoice.value)
    }
    
    onMounted(() => {
      initSocket()
      // 生成固定的粒子样式
      generateParticleStyles()
      // 首次进入时显示规则（如果用户没有勾选"不再显示"）
      if (!dontShowRules.value) {
        showRules.value = true
      }
      // 进入网页时播放背景音乐
      audioManager.playBgmusic()
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
      isFirstRoundForChoice,
      viewCardTimer,
      selectCardChoice,
      confirmCardChoice,
      // 出牌展示
      playedCardsDisplay,
      // 正在打出的牌
      playingCard,
      // 飞牌动画
      flyingCard,
      flyingCardStyle,
      showColdWaveEffect,
      isFrozenRound,
      // 发牌动画
      showDealingAnimation,
      dealingCards,
      isDealingAnimating,
      availableCardsRef,
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
      mySkill,
      showAvatarSelector,
      player1AvatarId,
      player2AvatarId,
      openAvatarSelector,
      onAvatarSelected,
      closeAvatarSelector,
      // 设置面板相关
      showSettings,
      openSettings,
      closeSettings,
      // 粒子背景
      particleStyles,
      // 游戏内主题粒子
      gameParticleStyles,
      // ID匹配相关
      selectedMatchMode,
      showIdMatchLobby,
      showInvitationDialog,
      currentInvitation,
      idMatchLobbyRef,
      selectMatchMode,
      startSoloGame,
      onIdMatchFound,
      onLeaveIdLobby,
      onInvitationReceived,
      onAcceptInvitation,
      onRejectInvitation,
      // 地图主题选择
      themeOptions,
      selectedTheme,
      // 特色地形信息
      getThemeShapeInfo,
      // 取消等待
      cancelWaiting,
      // 技能相关
      skillSealed,
      skillSelected,
      canSelectSkillInSelection,
      handleSkillClick,
      myActiveSkill,
      mySkillCooldown,
      // 选牌计数
      totalSelectedCount,
      canConfirmSelection,
      // 女盗贼技能：隔墙有眼
      showWallSkillReveal,
      wallSkillRevealedCards,
      closeWallSkillReveal,
      // 技能卡牌UI显示所需
      player1Skill,
      player2Skill,
      player1SkillCooldown,
      player2SkillCooldown,
      isSelectingPhase,
      // 随机事件悬停浮窗相关
      hoveredThemeId,
      showEventTooltip,
      tooltipPosition,
      hoveredEvent,
      currentMapEvent,
      handleThemeMouseEnter,
      handleThemeMouseLeave
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

.game-container.no-scroll {
  overflow: hidden;
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
  position: relative;
  overflow: hidden;
}

/* 全局粒子背景样式 */
.global-particles-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* 粒子背景样式（已弃用，保留兼容） */
.particles-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.particle {
  position: absolute;
  bottom: -20px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  animation: particle-float linear infinite;
}

@keyframes particle-float {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(-100vh) rotate(720deg);
    opacity: 0;
  }
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

.btn-id-match {
  background: linear-gradient(135deg, #6c5ce7, #a855f7);
  color: white;
  border: none;
  font-weight: bold;
}

.btn-id-match:hover {
  background: linear-gradient(135deg, #5b4cdb, #9333ea);
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(108, 92, 231, 0.4);
}

/* 匹配模式选择按钮 */
.match-mode-buttons {
  display: flex;
  gap: 2rem;
  justify-content: center;
  margin-top: 1rem;
}

.mode-btn {
  width: 180px;
  height: 200px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.mode-btn:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
}

.solo-mode-btn {
  border-color: #ed8936;
}

.solo-mode-btn:hover {
  background: linear-gradient(145deg, rgba(237, 137, 54, 0.1), #fff);
  border-color: #dd6b20;
}

.room-mode-btn {
  border-color: #48bb78;
}

.room-mode-btn:hover {
  background: linear-gradient(145deg, rgba(72, 187, 120, 0.1), #fff);
  border-color: #38a169;
}

.id-mode-btn {
  border-color: #6c5ce7;
}

.id-mode-btn:hover {
  background: linear-gradient(145deg, rgba(108, 92, 231, 0.1), #fff);
  border-color: #5b4cdb;
}

.mode-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.mode-title {
  font-size: 1.3rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.5rem;
}

.mode-desc {
  font-size: 0.9rem;
  color: #888;
}

/* 单人模式AI选择 */
.solo-ai-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.solo-ai-select h3 {
  font-size: 1.5rem;
  color: white;
  margin-bottom: 0.5rem;
}

.ai-type-options {
  display: flex;
  gap: 2rem;
  justify-content: center;
}

.ai-type-btn {
  width: 180px;
  height: 200px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 3px solid transparent;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

.ai-type-btn:hover {
  transform: translateY(-8px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
}

.rule-ai-btn {
  border-color: #ed8936;
}

.rule-ai-btn:hover {
  background: linear-gradient(145deg, rgba(237, 137, 54, 0.1), #fff);
  border-color: #dd6b20;
}

.neural-ai-btn {
  border-color: #6c5ce7;
}

.neural-ai-btn:hover {
  background: linear-gradient(145deg, rgba(108, 92, 231, 0.1), #fff);
  border-color: #5b4cdb;
}

.ai-type-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.ai-type-name {
  font-size: 1.3rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.5rem;
}

.ai-type-desc {
  font-size: 0.9rem;
  color: #888;
}

/* 房间匹配表单 */
.room-match-form {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.back-btn {
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.5);
  color: white;
  margin-bottom: 1.5rem;
  padding: 0.5rem 1.5rem;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: white;
}

.btn-confirm {
  background: #48bb78;
  color: white;
  margin-top: 1rem;
  display: block;
  margin-left: auto;
  margin-right: auto;
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
  position: relative;
  overflow: hidden;
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
  position: relative;
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
  position: relative;
  z-index: 1;
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
  position: relative;
  z-index: 1;
}

/* 玩家侧边面板 */
.player-side-panel {
  width: 280px;
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
  pointer-events: none;
  /* 动画期间正常显示内容，只是禁用点击 */
}

/* 占位牌：不可见但占据空间 */
.card.placeholder {
  visibility: hidden;
  pointer-events: none;
}

/* 选牌阶段的技能牌样式 */
.skill-card-in-selection {
  background: linear-gradient(145deg, #fff9e6, #fff3cc);
  border: 2px solid #ffd700;
}

.skill-card-in-selection:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(255, 215, 0, 0.4);
}

.skill-card-in-selection.selected {
  background: linear-gradient(145deg, #ffd700, #ffcc00);
  border-color: #f39c12;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.6);
}

/* 选牌阶段技能牌禁用状态 */
.skill-card-in-selection.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skill-card-in-selection.disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 技能标识 */
.skill-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

/* 禁用提示 */
.disabled-hint {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(220, 53, 69, 0.9);
  color: white;
  font-size: 0.55rem;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
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
  white-space: nowrap !important;
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
  position: relative;
  overflow: hidden;
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

/* 地图主题选择 */
.theme-selection {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

.theme-selection p {
  font-size: 1.2rem;
  margin-bottom: 0.8rem;
}

.theme-options {
  display: flex;
  gap: 0.8rem;
  justify-content: center;
  flex-wrap: wrap;
}

.theme-option-btn {
  width: auto;
  min-width: 90px;
  height: 50px;
  font-size: 1rem;
  background: white;
  color: #667eea;
  border: 3px solid transparent;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
}

.theme-option-btn.selected {
  background: #48bb78;
  color: white;
  border-color: #38a169;
}

.theme-option-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}

/* 特色地形选择 */
.shape-selection {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 215, 0, 0.15);
  border-radius: 12px;
  border: 2px solid rgba(255, 215, 0, 0.4);
}

.shape-selection p {
  font-size: 1.2rem;
  margin-bottom: 0.8rem;
  color: #ffd700;
}

.shape-options {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.shape-option-btn {
  width: auto;
  min-width: 180px;
  height: 60px;
  font-size: 1.1rem;
  background: linear-gradient(145deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1));
  color: white;
  border: 3px solid rgba(255, 215, 0, 0.5);
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1.5rem;
}

.shape-option-btn.selected {
  background: linear-gradient(145deg, #ffd700, #ffb700);
  color: #333;
  border-color: #ffd700;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
}

.shape-option-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.4);
}

.shape-cells {
  font-size: 0.85rem;
  opacity: 0.8;
  margin-left: 0.5rem;
}

/* 地图大小选择包装 */
.map-size-wrapper {
  margin: 1.5rem 0;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
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
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.rules-content {
  background: white;
  padding: 2rem 2.5rem;
  border-radius: 20px;
  width: 90%;
  max-width: 1000px;
  max-height: 85vh;
  overflow-y: auto;
  color: #333;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.rules-content .btn {
  display: block;
  margin: 1rem auto 0;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
}

.rules-content h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #667eea;
  font-size: 1.8rem;
}

/* 规则内容分栏布局 */
.rules-columns {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.rules-column {
  flex: 1;
  min-width: 0;
}

.rules-section {
  margin-bottom: 1.2rem;
}

.rules-section h3 {
  color: #48bb78;
  margin-bottom: 0.6rem;
  font-size: 1.1rem;
}

.rules-section ul, .rules-section ol {
  padding-left: 1.5rem;
}

.rules-section li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
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
  margin-bottom: 0.5rem;
}

/* 特色地形列表样式 */
.rules-section .terrain-list {
  font-size: 0.9rem;
  padding-left: 1rem;
}

.rules-section .terrain-list li {
  margin-bottom: 0.4rem;
}

/* 角色技能区域样式 */
.rules-skills-section {
  background: linear-gradient(145deg, #f8f9fa, #e9ecef);
  border-radius: 12px;
  padding: 1.2rem;
  margin-top: 1rem;
}

.rules-skills-section h3 {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 0.8rem;
}

.skill-intro {
  text-align: center;
  margin-bottom: 1rem;
  font-size: 0.95rem;
  color: #555;
}

.active-skill-text {
  color: #f39c12;
}

.passive-skill-text {
  color: #667eea;
}

/* 技能表格样式 */
.skills-table {
  border: 2px solid #dee2e6;
  border-radius: 10px;
  overflow: hidden;
  background: white;
}

.skill-row {
  display: flex;
  border-bottom: 1px solid #dee2e6;
}

.skill-row:last-child {
  border-bottom: none;
}

.skill-row.skill-header {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  font-weight: bold;
}

.skill-cell {
  flex: 1;
  padding: 0.7rem 0.8rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  border-right: 1px solid #dee2e6;
}

.skill-cell:last-child {
  border-right: none;
}

.skill-cell.profession {
  font-weight: bold;
  color: #667eea;
  background: rgba(102, 126, 234, 0.05);
}

.skill-cell.active-skill {
  background: linear-gradient(145deg, #fff9e6, #fff3cc);
}

.skill-cell.passive-skill {
  background: linear-gradient(145deg, #f0f4ff, #e8ecf8);
}

.skill-cell .skill-desc {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.3rem;
  line-height: 1.3;
}

.rules-checkbox {
  margin: 1rem 0;
  text-align: center;
}

.rules-checkbox label {
  cursor: pointer;
  color: #666;
  font-size: 0.95rem;
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

/* 选择观看手牌倒计时样式 */
.view-card-timer {
  font-size: 1.3rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 1rem;
  padding: 0.5rem 1.5rem;
  background: linear-gradient(145deg, #f0f4ff, #e8ecf8);
  border-radius: 8px;
  border: 2px solid #667eea;
}

.view-card-timer.timer-warning {
  color: #ff6b6b;
  border-color: #ff6b6b;
  background: linear-gradient(145deg, #fff0f0, #ffe8e8);
  animation: timerPulse 0.5s infinite;
}

@keyframes timerPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
}

.map-name-text .theme-icon {
  font-size: 4rem;
  /* emoji保持原色，不应用渐变 */
}

.map-name-text .theme-name {
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
  flex-direction: column;  /* 垂直布局，与 main-avatar-display 保持一致 */
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
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

/* 顶部工具栏样式 - 右上角固定 */
.top-toolbar {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  z-index: 100;
}

.settings-btn {
  width: 48px;
  height: 48px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  transition: all 0.3s;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: rotate(30deg) scale(1.1);
}

.main-avatar-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.main-avatar-display:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
}

.avatar-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 0.25rem;
}

/* 游戏内工具栏样式 */
.game-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 0 1rem;
  margin-bottom: 0.5rem;
}

.game-settings-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;
}

.game-settings-btn:hover {
  transform: rotate(30deg) scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* 游戏内粒子背景层 */
.game-particles-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.game-particle {
  position: absolute;
  top: -20px;
  animation: game-particle-fall linear infinite;
}

@keyframes game-particle-fall {
  0% {
    transform: translateY(0) translateX(0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.5);
  }
  90% {
    opacity: var(--particle-opacity, 0.5);
  }
  100% {
    transform: translateY(100vh) translateX(var(--swing, 0)) rotate(360deg);
    opacity: 0;
  }
}

/* 树叶粒子 - 森林主题 */
.game-particle.leaf {
  border-radius: 50% 0 50% 0;
  transform-origin: center;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
  animation: game-particle-leaf linear infinite;
}

@keyframes game-particle-leaf {
  0% {
    transform: translateY(0) translateX(0) rotate(-30deg) scale(0.8);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.5);
  }
  20% {
    transform: translateY(20vh) translateX(20px) rotate(30deg) scale(1);
  }
  40% {
    transform: translateY(40vh) translateX(-15px) rotate(-20deg) scale(1.1);
  }
  60% {
    transform: translateY(60vh) translateX(25px) rotate(40deg) scale(1);
  }
  80% {
    transform: translateY(80vh) translateX(-20px) rotate(-10deg) scale(0.9);
  }
  90% {
    opacity: var(--particle-opacity, 0.5);
  }
  100% {
    transform: translateY(100vh) translateX(var(--swing, 0)) rotate(30deg) scale(0.7);
    opacity: 0;
  }
}

/* 沙尘粒子 - 沙漠主题 */
.game-particle.sand {
  border-radius: 50%;
  filter: blur(0.5px);
  box-shadow: 0 0 4px rgba(212, 165, 116, 0.5);
  animation: game-particle-sand linear infinite;
}

@keyframes game-particle-sand {
  0% {
    transform: translateY(0) translateX(0) scale(0.6);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.4);
    transform: translateY(10vh) translateX(10px) scale(1);
  }
  30% {
    transform: translateY(30vh) translateX(35px) scale(1.1);
  }
  50% {
    transform: translateY(50vh) translateX(15px) scale(0.9);
  }
  70% {
    transform: translateY(70vh) translateX(40px) scale(1);
  }
  90% {
    opacity: var(--particle-opacity, 0.4);
    transform: translateY(90vh) translateX(20px) scale(0.8);
  }
  100% {
    transform: translateY(100vh) translateX(-20px) scale(0.5);
    opacity: 0;
  }
}

/* 雪花粒子 - 冰原主题 */
.game-particle.snow {
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9), 0 0 12px rgba(200, 230, 255, 0.5);
  animation: game-particle-snow linear infinite;
}

@keyframes game-particle-snow {
  0% {
    transform: translateY(0) translateX(0) rotate(0deg) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.6);
    transform: translateY(10vh) translateX(10px) rotate(60deg) scale(1);
  }
  25% {
    transform: translateY(25vh) translateX(25px) rotate(120deg) scale(1.1);
  }
  40% {
    transform: translateY(40vh) translateX(-15px) rotate(180deg) scale(1);
  }
  55% {
    transform: translateY(55vh) translateX(20px) rotate(240deg) scale(0.9);
  }
  70% {
    transform: translateY(70vh) translateX(-25px) rotate(300deg) scale(1);
  }
  85% {
    transform: translateY(85vh) translateX(15px) rotate(350deg) scale(0.8);
  }
  90% {
    opacity: var(--particle-opacity, 0.6);
  }
  100% {
    transform: translateY(100vh) translateX(-5px) rotate(360deg) scale(0.6);
    opacity: 0;
  }
}

/* 火星粒子 - 火山主题 */
.game-particle.ember {
  border-radius: 50%;
  animation: game-particle-ember linear infinite;
  box-shadow: 0 0 6px var(--particle-color, #ff6b35), 0 0 12px var(--particle-color, #ff6b35);
}

@keyframes game-particle-ember {
  0% {
    transform: translateY(100vh) translateX(0) scale(0.5);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.7);
    transform: translateY(90vh) translateX(5px) scale(1);
  }
  50% {
    transform: translateY(50vh) translateX(-10px) scale(0.9);
  }
  90% {
    opacity: calc(var(--particle-opacity, 0.7) * 0.5);
    transform: translateY(10vh) translateX(15px) scale(0.6);
  }
  100% {
    transform: translateY(-10vh) translateX(-5px) scale(0);
    opacity: 0;
  }
}

/* 灰尘粒子 - 古城主题 */
.game-particle.dust {
  border-radius: 50%;
  filter: blur(0.5px);
  box-shadow: 0 0 4px var(--particle-color, #8b4513);
  animation: game-particle-dust linear infinite;
}

@keyframes game-particle-dust {
  0% {
    transform: translateY(0) translateX(0) scale(0.6) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: var(--particle-opacity, 0.4);
    transform: translateY(10vh) translateX(15px) scale(0.9) rotate(45deg);
  }
  25% {
    transform: translateY(25vh) translateX(30px) scale(1) rotate(90deg);
  }
  40% {
    transform: translateY(40vh) translateX(-10px) scale(1.1) rotate(135deg);
  }
  55% {
    transform: translateY(55vh) translateX(25px) scale(0.9) rotate(180deg);
  }
  70% {
    transform: translateY(70vh) translateX(-20px) scale(1) rotate(225deg);
  }
  85% {
    transform: translateY(85vh) translateX(15px) scale(0.8) rotate(270deg);
  }
  90% {
    opacity: var(--particle-opacity, 0.4);
  }
  100% {
    transform: translateY(100vh) translateX(10px) scale(0.5) rotate(360deg);
    opacity: 0;
  }
}

/* 默认粒子样式 */
.game-particle.default {
  border-radius: 50%;
  animation: game-particle-fall linear infinite;
}

/* 发牌动画样式 */
.dealing-animation-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 3000;
}

.dealing-card {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 100px;
  height: 140px;
  background: linear-gradient(145deg, #f8f9fa, #e9ecef);
  border: 2px solid #dee2e6;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  animation: dealCard 0.4s ease-out forwards;
  animation-delay: var(--delay);
  opacity: 0;
  transform: translate(-50%, -50%);
}

.dealing-card .card-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.dealing-card .card-name {
  font-size: 0.85rem;
  text-align: center;
  color: #333;
  font-weight: bold;
}

@keyframes dealCard {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  30% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }
  100% {
    opacity: 1;
    transform: translate(calc(-50% + var(--target-x)), calc(-50% + var(--target-y, 200px))) scale(1);
  }
}

/* 女盗贼技能：隔墙有眼 - 查看对手手牌弹窗 */
.wall-skill-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  animation: fadeIn 0.3s ease-out;
}

.wall-skill-content {
  background: linear-gradient(145deg, #1a1a2e, #16213e);
  padding: 2rem 2.5rem;
  border-radius: 20px;
  text-align: center;
  color: white;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(102, 126, 234, 0.3);
  border: 2px solid rgba(102, 126, 234, 0.5);
  max-width: 400px;
  animation: scaleIn 0.3s ease-out;
}

@keyframes scaleIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.wall-skill-content h2 {
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
  color: #ffd700;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.wall-skill-tip {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 1.5rem;
}

.revealed-cards {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1rem;
}

.revealed-card {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.revealed-card .card-label {
  font-size: 0.9rem;
  color: #a0a0a0;
  margin-bottom: 0.5rem;
}

.wall-skill-card {
  width: 100px;
  height: 140px;
  background: linear-gradient(145deg, #2d2d44, #1a1a2e);
  border: 3px solid #667eea;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.4);
  animation: cardGlow 1.5s ease-in-out infinite;
}

.wall-skill-card .card-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.wall-skill-card .card-name {
  font-size: 0.85rem;
  color: white;
  text-align: center;
}

.wall-skill-note {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 1rem;
}

.wall-skill-close-btn {
  margin-top: 1.5rem;
  padding: 0.8rem 2.5rem;
  font-size: 1.1rem;
  background: linear-gradient(145deg, #48bb78, #38a169);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(72, 187, 120, 0.4);
}

.wall-skill-close-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(72, 187, 120, 0.6);
}

/* 女盗贼技能：选牌和排序阶段显示两张牌的样式 */
.wall-skill-cards {
  background: linear-gradient(145deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
  border: 2px solid rgba(102, 126, 234, 0.5);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.wall-skill-title {
  font-size: 1.1rem;
  color: #667eea;
  font-weight: bold;
  margin-bottom: 0.8rem;
  text-align: center;
}

.wall-skill-cards-row {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
}

.revealed-card-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.revealed-card-item .card-label {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.wall-skill-reveal-card {
  width: 90px;
  height: 120px;
  background: linear-gradient(145deg, #f0f4ff, #e8ecf8);
  border: 3px solid #667eea;
  box-shadow: 0 0 15px rgba(102, 126, 234, 0.4);
}

.wall-skill-reveal-card .card-icon {
  font-size: 2rem;
}

.wall-skill-reveal-card .card-name {
  font-size: 0.8rem;
}

/* ========== 技能卡牌UI样式 ========== */

/* 面板内容包裹层 */
.panel-content-wrapper {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
}

/* 玩家信息区域 */
.player-info-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

/* 技能卡牌区域 */
.skill-card-area {
  width: 110px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

/* 左侧面板：技能卡牌在最左边（远离棋盘） */
.skill-card-area.left-skill {
  order: -1;
}

/* 右侧面板：技能卡牌在最右边（远离棋盘） */
.skill-card-area.right-skill {
  order: 1;
}

/* 技能卡牌基础样式 */
.skill-card {
  width: 115px;
  height: 165px;
  padding: 0.6rem;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  transition: all 0.3s ease;
  cursor: default;
}

/* 主动技能卡牌样式（金色渐变） */
.skill-card.active-skill {
  background: linear-gradient(145deg, #fff9e6, #fff3cc);
  border: 2px solid #ffd700;
  box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3);
}

/* 被动技能卡牌样式（银色渐变） */
.skill-card.passive-skill {
  background: linear-gradient(145deg, #f0f0f0, #e8e8e8);
  border: 2px solid #c0c0c0;
  box-shadow: 0 4px 15px rgba(192, 192, 192, 0.3);
}

/* 技能图标 */
.skill-card .skill-icon {
  font-size: 2.2rem;
  margin-bottom: 0.3rem;
}

/* 技能名称 */
.skill-card .skill-name {
  font-size: 0.75rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.2rem;
}

/* 技能类型标签 */
.skill-card .skill-type-label {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 0.2rem;
}

.active-skill .skill-type-label {
  background: linear-gradient(135deg, #ffd700, #ffb700);
  color: #333;
}

.passive-skill .skill-type-label {
  background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
  color: #333;
}

/* 技能冷却状态文字 */
.skill-card .skill-cooldown {
  font-size: 0.65rem;
  color: #666;
  margin-bottom: 0.2rem;
}

/* 技能描述 - 可滚动 */
.skill-card .skill-description {
  font-size: 0.6rem;
  color: #888;
  line-height: 1.3;
  max-height: 65px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  padding-right: 2px;
}

/* 自定义滚动条样式(WebKit) */
.skill-card .skill-description::-webkit-scrollbar {
  width: 3px;
}

.skill-card .skill-description::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.4);
  border-radius: 3px;
}

.skill-card .skill-description::-webkit-scrollbar-track {
  background: transparent;
}

/* 可选中状态 - 脉冲动画 */
.skill-card.can-select {
  cursor: pointer;
  animation: skillPulse 2s ease-in-out infinite;
}

.skill-card.can-select:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.5);
}

@keyframes skillPulse {
  0%, 100% { box-shadow: 0 4px 15px rgba(255, 215, 0, 0.3); }
  50% { box-shadow: 0 4px 25px rgba(255, 215, 0, 0.6); }
}

/* 选中状态 */
.skill-card.selected {
  background: linear-gradient(145deg, #ffd700, #ffcc00);
  border-color: #ff8c00;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
  transform: scale(1.02);
}

/* 冷却中状态 */
.skill-card.on-cooldown {
  opacity: 0.7;
  filter: grayscale(0.5);
}

/* ==================== 古城技能封印样式 ==================== */

/* 封印状态 - 灰度化 */
.skill-card.sealed {
  filter: grayscale(1);
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none;
}

.skill-card.sealed:hover {
  transform: none;
  box-shadow: none;
}

/* 封印遮罩层 */
.seal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  z-index: 10;
}

.seal-icon {
  font-size: 2rem;
  animation: seal-lock-pulse 2s ease-in-out infinite;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.6));
}

.seal-text {
  font-size: 0.65rem;
  color: #ccc;
  font-weight: bold;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
  letter-spacing: 1px;
}

@keyframes seal-lock-pulse {
  0%, 100% { 
    opacity: 0.8; 
    transform: scale(1); 
  }
  50% { 
    opacity: 1; 
    transform: scale(1.1); 
  }
}

/* 选牌区技能牌封印样式 */
.skill-card-in-selection.sealed-card {
  filter: grayscale(1);
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
  position: relative;
}

.skill-card-in-selection.sealed-card:hover {
  transform: none;
  box-shadow: none;
}

/* 手牌区技能牌封印样式 */
.card.sealed-skill-card {
  filter: grayscale(1);
  opacity: 0.5;
  position: relative;
  cursor: not-allowed;
}

.card.sealed-skill-card:hover {
  transform: none;
}

/* 封印锁图标（选牌区/手牌区用，较小） */
.card-seal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  z-index: 5;
  pointer-events: none;
}

.card-seal-overlay .seal-icon {
  font-size: 1.4rem;
  animation: seal-lock-pulse 2s ease-in-out infinite;
}

.card-seal-overlay .seal-text {
  font-size: 0.5rem;
  color: #ccc;
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

/* 冷却遮罩层 */
.cooldown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cooldown-number {
  font-size: 2rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

/* ==================== 随机事件悬停浮窗样式 ==================== */

.event-tooltip {
  position: fixed;
  transform: translateX(-50%);
  background: linear-gradient(145deg, rgba(30, 30, 50, 0.98), rgba(20, 20, 35, 0.98));
  border: 2px solid rgba(102, 126, 234, 0.6);
  border-radius: 12px;
  padding: 1rem 1.2rem;
  min-width: 220px;
  max-width: 280px;
  z-index: 6000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(102, 126, 234, 0.3);
  pointer-events: none;
}

.event-tooltip-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}

.event-tooltip-icon {
  font-size: 1.5rem;
}

.event-tooltip-name {
  font-size: 1.1rem;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.4);
}

.event-tooltip-desc {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
  margin-bottom: 0.6rem;
}

.event-tooltip-trigger {
  display: flex;
  justify-content: center;
}

.trigger-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 500;
}

.trigger-tag.passive {
  background: linear-gradient(135deg, #48bb78, #38a169);
  color: white;
}

.trigger-tag.chance {
  background: linear-gradient(135deg, #ed8936, #dd6b20);
  color: white;
}

.trigger-tag.active {
  background: linear-gradient(135deg, #e53e3e, #c53030);
  color: white;
}

/* 浮窗淡入淡出动画 */
.tooltip-fade-enter-active {
  animation: tooltipFadeIn 0.2s ease-out;
}

.tooltip-fade-leave-active {
  animation: tooltipFadeOut 0.15s ease-in;
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes tooltipFadeOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-5px);
  }
}

/* ==================== 地图名称界面中的随机事件提示样式 ==================== */

.map-event-info {
  margin-top: 1.5rem;
  padding: 1rem 1.2rem;
  background: linear-gradient(145deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  border-radius: 12px;
  border: 2px solid rgba(102, 126, 234, 0.5);
  animation: eventInfoAppear 0.4s ease-out 0.3s both;
}

@keyframes eventInfoAppear {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

.event-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  margin-bottom: 0.8rem;
}

.event-label {
  font-size: 0.9rem;
  color: #ffd700;
  font-weight: 500;
  margin-bottom: 0.6rem;
  text-align: center;
}

.event-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.event-content .event-icon {
  font-size: 1.8rem;
}

.event-content .event-name {
  font-size: 1.3rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
}

.map-event-info .event-desc {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
  line-height: 1.4;
}

/* 事件淡入淡出动画 */
.event-fade-enter-active {
  animation: eventFadeIn 0.3s ease-out;
}

.event-fade-leave-active {
  animation: eventFadeOut 0.2s ease-in;
}

@keyframes eventFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes eventFadeOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

/* ==================== 寒流全屏特效样式 ==================== */

/* 寒流全屏覆盖层 */
.cold-wave-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 100;
  overflow: hidden;
}

/* 蓝色半透明遮罩 */
.cold-wave-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, 
    rgba(100, 149, 237, 0.15) 0%,
    rgba(70, 130, 180, 0.2) 50%,
    rgba(65, 105, 225, 0.25) 100%
  );
  animation: cold-pulse 3s ease-in-out infinite;
}

@keyframes cold-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.9; }
}

/* 全屏雪花容器 */
.snowflakes-fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 全屏雪花 - 30个不同大小和速度 */
.snowflake-full {
  position: absolute;
  top: -50px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.5rem;
  text-shadow: 0 0 10px rgba(200, 230, 255, 0.8);
  animation: snowfall linear infinite;
  pointer-events: none;
}

/* 为每个雪花设置不同的位置、大小、速度和延迟 */
.snowflake-full.snowflake-1 { left: 3%; font-size: 1.2rem; animation-duration: 8s; animation-delay: 0s; }
.snowflake-full.snowflake-2 { left: 7%; font-size: 1.8rem; animation-duration: 10s; animation-delay: 0.5s; }
.snowflake-full.snowflake-3 { left: 12%; font-size: 1.5rem; animation-duration: 7s; animation-delay: 1s; }
.snowflake-full.snowflake-4 { left: 18%; font-size: 2rem; animation-duration: 12s; animation-delay: 0.3s; }
.snowflake-full.snowflake-5 { left: 23%; font-size: 1.3rem; animation-duration: 9s; animation-delay: 1.5s; }
.snowflake-full.snowflake-6 { left: 28%; font-size: 1.7rem; animation-duration: 11s; animation-delay: 0.8s; }
.snowflake-full.snowflake-7 { left: 33%; font-size: 1.4rem; animation-duration: 8s; animation-delay: 2s; }
.snowflake-full.snowflake-8 { left: 38%; font-size: 2.2rem; animation-duration: 13s; animation-delay: 0.2s; }
.snowflake-full.snowflake-9 { left: 43%; font-size: 1.6rem; animation-duration: 9s; animation-delay: 1.2s; }
.snowflake-full.snowflake-10 { left: 48%; font-size: 1.9rem; animation-duration: 10s; animation-delay: 0.6s; }
.snowflake-full.snowflake-11 { left: 52%; font-size: 1.3rem; animation-duration: 7s; animation-delay: 1.8s; }
.snowflake-full.snowflake-12 { left: 57%; font-size: 2.1rem; animation-duration: 12s; animation-delay: 0.4s; }
.snowflake-full.snowflake-13 { left: 62%; font-size: 1.5rem; animation-duration: 8s; animation-delay: 2.2s; }
.snowflake-full.snowflake-14 { left: 67%; font-size: 1.8rem; animation-duration: 11s; animation-delay: 0.7s; }
.snowflake-full.snowflake-15 { left: 72%; font-size: 1.4rem; animation-duration: 9s; animation-delay: 1.4s; }
.snowflake-full.snowflake-16 { left: 77%; font-size: 2rem; animation-duration: 13s; animation-delay: 0.1s; }
.snowflake-full.snowflake-17 { left: 80%; font-size: 1.6rem; animation-duration: 8s; animation-delay: 1.9s; }
.snowflake-full.snowflake-18 { left: 84%; font-size: 1.2rem; animation-duration: 10s; animation-delay: 0.9s; }
.snowflake-full.snowflake-19 { left: 88%; font-size: 1.7rem; animation-duration: 11s; animation-delay: 2.5s; }
.snowflake-full.snowflake-20 { left: 92%; font-size: 1.9rem; animation-duration: 9s; animation-delay: 0.3s; }
.snowflake-full.snowflake-21 { left: 5%; font-size: 1.1rem; animation-duration: 14s; animation-delay: 2.1s; }
.snowflake-full.snowflake-22 { left: 15%; font-size: 1.4rem; animation-duration: 8s; animation-delay: 1.1s; }
.snowflake-full.snowflake-23 { left: 25%; font-size: 1.8rem; animation-duration: 12s; animation-delay: 0.5s; }
.snowflake-full.snowflake-24 { left: 35%; font-size: 1.3rem; animation-duration: 7s; animation-delay: 1.7s; }
.snowflake-full.snowflake-25 { left: 45%; font-size: 2.2rem; animation-duration: 11s; animation-delay: 0.2s; }
.snowflake-full.snowflake-26 { left: 55%; font-size: 1.2rem; animation-duration: 9s; animation-delay: 2.3s; }
.snowflake-full.snowflake-27 { left: 65%; font-size: 1.6rem; animation-duration: 10s; animation-delay: 0.8s; }
.snowflake-full.snowflake-28 { left: 75%; font-size: 1.9rem; animation-duration: 13s; animation-delay: 1.3s; }
.snowflake-full.snowflake-29 { left: 85%; font-size: 1.4rem; animation-duration: 8s; animation-delay: 2s; }
.snowflake-full.snowflake-30 { left: 95%; font-size: 1.7rem; animation-duration: 11s; animation-delay: 0.6s; }

@keyframes snowfall {
  0% {
    transform: translateY(-50px) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
    opacity: 0;
  }
}

/* 寒风流动效果 */
.cold-wind-flow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.wind-stream {
  position: absolute;
  height: 3px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(200, 230, 255, 0.3) 20%, 
    rgba(255, 255, 255, 0.5) 50%, 
    rgba(200, 230, 255, 0.3) 80%, 
    transparent 100%
  );
  animation: wind-flow 4s linear infinite;
  border-radius: 2px;
}

.wind-stream-1 {
  top: 20%;
  width: 200px;
  animation-delay: 0s;
}

.wind-stream-2 {
  top: 50%;
  width: 150px;
  animation-delay: 1.5s;
}

.wind-stream-3 {
  top: 80%;
  width: 180px;
  animation-delay: 3s;
}

@keyframes wind-flow {
  0% {
    left: -200px;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}

/* 寒流警告提示 */
.cold-wave-warning {
  text-align: center;
  padding: 0.8rem 1.5rem;
  background: linear-gradient(145deg, rgba(100, 149, 237, 0.9), rgba(70, 130, 180, 0.95));
  border-radius: 12px;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(200, 230, 255, 0.5);
  animation: warning-pulse 1.5s ease-in-out infinite;
  box-shadow: 0 4px 20px rgba(100, 149, 237, 0.5);
}

@keyframes warning-pulse {
  0%, 100% {
    box-shadow: 0 4px 20px rgba(100, 149, 237, 0.5);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 4px 30px rgba(100, 149, 237, 0.8);
    transform: scale(1.02);
  }
}

/* 打出的牌冻结效果 - 纯冰蓝色覆盖 */
.played-card.frozen {
  /* 完全移除滤镜，避免色相旋转导致颜色不一致 */
  filter: none !important;
  /* 高不透明度冰蓝色背景直接覆盖原色 */
  background: linear-gradient(145deg, 
    rgba(30, 144, 255, 0.88) 0%, 
    rgba(65, 105, 225, 0.92) 50%,
    rgba(100, 149, 237, 0.88) 100%) !important;
  border-color: #1e90ff !important;  /* 道奇蓝 */
  /* 强制文字为白色 */
  color: white !important;
  box-shadow: 
    0 0 25px rgba(30, 144, 255, 0.8),
    0 0 50px rgba(65, 105, 225, 0.5),
    inset 0 0 20px rgba(135, 206, 250, 0.4) !important;
  animation: frozen-card-pulse 2s ease-in-out infinite;
}

/* 冻结卡牌内的图标和文字颜色 */
.played-card.frozen .card-icon {
  color: white !important;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.8)) !important;
}

.played-card.frozen .card-name {
  color: white !important;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5) !important;
}

@keyframes frozen-card-pulse {
  0%, 100% {
    box-shadow: 
      0 0 20px rgba(65, 105, 225, 0.7),
      0 0 40px rgba(30, 144, 255, 0.4),
      inset 0 0 15px rgba(135, 206, 250, 0.3);
  }
  50% {
    box-shadow: 
      0 0 30px rgba(65, 105, 225, 0.9),
      0 0 50px rgba(30, 144, 255, 0.6),
      inset 0 0 20px rgba(135, 206, 250, 0.5);
  }
}

/* 冻结覆盖层 - 冰蓝色调 */
.card-frozen-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* 冰蓝色渐变，模拟冰晶效果 */
  background: linear-gradient(135deg, 
    rgba(65, 105, 225, 0.5) 0%, 
    rgba(30, 144, 255, 0.35) 30%,
    rgba(70, 130, 180, 0.4) 60%,
    rgba(135, 206, 250, 0.3) 100%);
  border-radius: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  /* 冰晶纹理效果 */
  backdrop-filter: blur(1px);
}

.card-frozen-overlay .frozen-icon {
  font-size: 2.5rem;
  animation: frozen-icon-float 1.5s ease-in-out infinite;
  filter: drop-shadow(0 0 15px rgba(135, 206, 250, 1)) drop-shadow(0 0 5px white);
}

@keyframes frozen-icon-float {
  0%, 100% { 
    opacity: 0.85; 
    transform: scale(1) rotate(0deg); 
    filter: drop-shadow(0 0 15px rgba(135, 206, 250, 1)) drop-shadow(0 0 5px white);
  }
  50% { 
    opacity: 1; 
    transform: scale(1.15) rotate(10deg); 
    filter: drop-shadow(0 0 20px rgba(65, 105, 225, 1)) drop-shadow(0 0 8px white);
  }
}
</style>
