# 🎭 Cloak of Moves - 双人联机卡牌对抗游戏

## 项目结构

```
cloak-of-moves/
├── client/              # 前端 (Vue 3 + Vite)
│   ├── src/
│   │   ├── components/  # Vue组件
│   │   ├── App.vue      # 主应用组件
│   │   └── main.js     # 入口文件
│   ├── index.html
│   └── vite.config.js
├── server/             # 后端 (Node.js + Express + Socket.io)
│   ├── game/
│   │   ├── match.js     # 对局逻辑
│   │   └── room.js      # 房间管理
│   └── index.js         # 服务器入口
├── shared/
│   └── constants.js     # 共享常量
└── package.json         # 根配置
```

## 启动步骤

### 1. 安装依赖

在终端中分别执行以下命令：

```bash
# 安装服务器依赖
cd server
npm install

# 安装客户端依赖
cd ../client
npm install
```

### 2. 启动服务器

在 `server` 目录下执行：

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动

### 3. 启动客户端

在 `client` 目录下执行：

```bash
npm run dev
```

客户端将在 `http://localhost:5173` 启动

### 4. 测试游戏

1. 打开两个浏览器窗口，访问 `http://localhost:5173`
2. 在第一个窗口点击"创建新房间"，会显示房间号
3. 在第二个窗口输入房间号，点击"加入房间"
4. 游戏开始！

## 游戏规则

- **卡牌类型**：移动牌(4种)、攻击牌(8种)、防御牌(1种)
- **回合流程**：发牌 → 选择3张手牌 → 调整出牌顺序 → 交替出牌
- **胜利条件**：击败对方玩家（对方血量归零）

## 🔧 重要配置说明

### 端口占用问题

如果遇到 `EADDRINUSE` 错误（端口被占用），请先结束占用端口的进程：

```bash
# 查找占用端口的进程
netstat -ano | findstr :3000    # 查找3000端口
netstat -ano | findstr :5173    # 查找5173端口

# 终止进程（将 PID 替换为实际进程ID）
taskkill /F /PID <进程ID>
```

### 启动顺序

**正确的启动顺序**：

1. **先启动服务器**：
```bash
cd server
npm install  # 如果还没安装依赖
node index.js
```
服务器将显示：`🎮 游戏服务器已启动: http://localhost:3000`

2. **再启动客户端**（在新终端）：
```bash
cd client
npm install  # 如果还没安装依赖
npm run dev
```
客户端将在 `http://localhost:5173` 启动

3. **打开浏览器访问**：
   - 打开两个浏览器窗口
   - 都访问 `http://localhost:5173`

### 🔧 修复内容

#### 1. 根目录package.json添加"type": "module"
这是最重要的修复！使ES6模块导入正常工作。

#### 2. Socket连接稳定性优化
- 调整transports顺序：`['polling', 'websocket']`
- 添加自动重连机制
- 配置重连参数和超时

#### 3. MatchManager错误处理增强
- 添加参数验证和详细日志
- 改进socket ID为null/undefined时的处理

#### 4. 调试功能
- 服务器和客户端都添加了详细的console.log输出
- 便于排查连接问题

### 如何排查问题

如果在启动过程中遇到问题，请：

1. **检查服务器终端**
   - 查看是否有 `[连接]` 开头的日志
   - 查看是否有 `[事件]` 开头的日志
   - 查看是否有 `[错误]` 开头的日志

2. **检查浏览器控制台 (F12)**
   - 查看是否有 `[客户端]` 开头的日志
   - 查看是否有红色的错误信息

3. **常见问题**
   - **无法连接**：确保先启动服务器，再启动客户端
   - **端口被占用**：使用 `netstat` 和 `taskkill` 命令释放端口
   - **模块导入错误**：确保根目录package.json包含 `"type": "module"`

## 技术栈

- **前端**：Vue 3, Vite, Socket.io-client
- **后端**：Node.js, Express, Socket.io
- **实时通信**：WebSocket
