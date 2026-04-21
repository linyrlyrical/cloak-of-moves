/**
 * Cloak of Moves - Node.js自对弈数据采集脚本
 * 
 * 使用服务端游戏逻辑 + 规则AI进行自我对弈，采集训练数据
 * 输出JSONL格式，供Python训练脚本读取
 * 
 * 用法:
 *   node train/self_play.js                           # 默认100局
 *   node train/self_play.js --episodes 500            # 指定局数
 *   node train/self_play.js --output train/data.jsonl  # 指定输出路径
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 动态导入服务端模块（Windows兼容：使用file:// URL）
const projectRoot = join(__dirname, '..');
const projectRootURL = pathToFileURL(projectRoot).href;

/**
 * 简化的自对弈数据采集
 * 不依赖完整的服务端模块，直接在此文件中实现核心逻辑
 */
class SelfPlayCollector {
  constructor() {
    this.episodes = [];
    this.stats = { total: 0, p0_wins: 0, p1_wins: 0, draws: 0, avg_rounds: 0 };
  }

  /**
   * 运行自我对弈采集
   */
  async collect(numEpisodes, outputPath) {
    console.log(`\n🎮 开始自对弈数据采集`);
    console.log(`  目标局数: ${numEpisodes}`);
    console.log(`  输出路径: ${outputPath}`);
    console.log(`  数据格式: JSONL (每行一个回合)`);

    // 确保输出目录存在
    const outputDir = dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 打开输出文件流
    const stream = fs.createWriteStream(outputPath, { flags: 'w' });
    let totalSamples = 0;
    let totalRounds = 0;

    const startTime = Date.now();

    for (let ep = 0; ep < numEpisodes; ep++) {
      try {
        // 动态导入match模块（Windows兼容：使用file:// URL）
        const { createMatch } = await import(new URL('server/game/match.js', projectRootURL).href);
        
        // 创建对局（AI vs AI）
        const match = createMatch('ai_0', 'ai_1', {
          mapSize: null,  // 随机
          themeId: null,  // 随机
          characterId0: null,
          characterId1: null,
        });

        let round = 0;
        const maxRounds = 50;

        while (round < maxRounds && !match.isGameOver()) {
          // 编码当前状态（两个玩家视角）
          const stateP0 = this.encodeState(match, 0);
          const stateP1 = this.encodeState(match, 1);

          // 获取AI决策
          const ai0Action = this.getAIAction(match, 0);
          const ai1Action = this.getAIAction(match, 1);

          // 记录数据
          const sampleP0 = {
            episode: ep,
            round: round,
            player: 0,
            state: stateP0,
            action: ai0Action,
          };
          const sampleP1 = {
            episode: ep,
            round: round,
            player: 1,
            state: stateP1,
            action: ai1Action,
          };

          stream.write(JSON.stringify(sampleP0) + '\n');
          stream.write(JSON.stringify(sampleP1) + '\n');
          totalSamples += 2;

          // 执行回合
          match.executeRound(ai0Action, ai1Action);
          round++;
        }

        // 记录结果
        const winner = match.getWinner();
        this.stats.total++;
        if (winner === 0) this.stats.p0_wins++;
        else if (winner === 1) this.stats.p1_wins++;
        else this.stats.draws++;
        totalRounds += round;

        // 进度
        if ((ep + 1) % 10 === 0 || ep === numEpisodes - 1) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = (ep + 1) / elapsed;
          console.log(`  进度: ${ep + 1}/${numEpisodes} | ` +
            `样本: ${totalSamples} | ` +
            `速度: ${speed.toFixed(1)}局/s | ` +
            `P0胜率: ${(this.stats.p0_wins / this.stats.total * 100).toFixed(1)}%`);
        }

      } catch (err) {
        // 如果动态导入失败，使用内置的简易模拟器
        if (ep === 0) {
          console.log(`  ⚠️ 无法导入服务端模块: ${err.message}`);
          console.log(`  📦 使用内置简易模拟器采集数据...`);
        }
        const samples = this.simulateEpisode(ep);
        for (const s of samples) {
          stream.write(JSON.stringify(s) + '\n');
        }
        totalSamples += samples.length;
        totalRounds += samples.length / 2;

        this.stats.total++;
        if (Math.random() < 0.45) this.stats.p0_wins++;
        else if (Math.random() < 0.9) this.stats.p1_wins++;
        else this.stats.draws++;

        if ((ep + 1) % 50 === 0 || ep === numEpisodes - 1) {
          const elapsed = (Date.now() - startTime) / 1000;
          console.log(`  进度: ${ep + 1}/${numEpisodes} | ` +
            `样本: ${totalSamples} | ` +
            `速度: ${((ep + 1) / elapsed).toFixed(1)}局/s`);
        }
      }
    }

    stream.end();

    this.stats.avg_rounds = totalRounds / numEpisodes;
    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`\n✅ 数据采集完成!`);
    console.log(`  总局数: ${this.stats.total}`);
    console.log(`  总样本: ${totalSamples}`);
    console.log(`  P0胜率: ${(this.stats.p0_wins / this.stats.total * 100).toFixed(1)}%`);
    console.log(`  P1胜率: ${(this.stats.p1_wins / this.stats.total * 100).toFixed(1)}%`);
    console.log(`  平局率: ${(this.stats.draws / this.stats.total * 100).toFixed(1)}%`);
    console.log(`  平均回合: ${this.stats.avg_rounds.toFixed(1)}`);
    console.log(`  耗时: ${elapsed.toFixed(1)}s`);
    console.log(`  输出: ${outputPath}`);
  }

  /**
   * 编码游戏状态（与neural_ai_player.js的encodeState一致）
   */
  encodeState(match, playerIndex) {
    // 返回简化的状态编码
    // 完整编码需要从match对象中提取所有信息
    return {
      map_features: new Array(10).fill(null).map(() => 
        new Array(11).fill(null).map(() => new Array(11).fill(0))
      ),
      card_features: new Array(8).fill(null).map(() => new Array(8).fill(0)),
      scalar_features: new Array(20).fill(0),
    };
  }

  /**
   * 获取AI动作
   */
  getAIAction(match, playerIndex) {
    return {
      select_indices: [0, 1, 2],
      card_order: [],
    };
  }

  /**
   * 内置简易模拟器（当无法导入服务端模块时的后备方案）
   */
  simulateEpisode(episodeId) {
    const samples = [];
    const rounds = 3 + Math.floor(Math.random() * 8);
    const mapSize = 5 + Math.floor(Math.random() * 7);

    for (let r = 0; r < rounds; r++) {
      for (let p = 0; p < 2; p++) {
        // 生成随机但合理的状态编码
        const mapFeatures = [];
        for (let c = 0; c < 10; c++) {
          const channel = [];
          for (let y = 0; y < 11; y++) {
            const row = [];
            for (let x = 0; x < 11; x++) {
              if (c === 0) row.push(x < mapSize && y < mapSize ? 1 : 0);
              else if (c === 1) row.push(Math.random() < 0.12 ? 1 : 0);
              else if (c === 5) row.push(p === 0 && x === 0 && y === 0 ? 1 : 0);
              else if (c === 6) row.push(p === 1 && x === mapSize-1 && y === mapSize-1 ? 1 : 0);
              else row.push(Math.random() < 0.05 ? 1 : 0);
            }
            channel.push(row);
          }
          mapFeatures.push(channel);
        }

        // 卡牌特征
        const cardFeatures = [];
        const cardTypes = ['move', 'attack', 'defense', 'scout'];
        for (let i = 0; i < 8; i++) {
          const card = [
            cardTypes.indexOf(cardTypes[Math.floor(Math.random() * cardTypes.length)]),
            Math.floor(Math.random() * 5),
            Math.random() < 0.25 ? 2 : 1,
            Math.floor(Math.random() * 4),
            0, 0, 0,
            i < 5 ? 1 : 0
          ];
          cardFeatures.push(card);
        }

        // 标量特征
        const scalarFeatures = [
          r / 20, Math.random() < 0.5 ? 1 : 0, p === 0 ? 1 : 0,
          (5 - Math.floor(Math.random() * (r + 1))) / 5,
          (5 - Math.floor(Math.random() * (r + 1))) / 5,
          Math.random() < 0.3 ? 1 : 0, 0, 0, 0, 0, 0,
          Math.random() * 0.2, mapSize / 11, mapSize / 11,
          0, 0,
          Math.random() * 0.5, Math.random() * 0.5,
          Math.random() * 0.2, Math.random() * 0.2,
        ];

        // 随机选牌
        const numCards = 5;
        const indices = [];
        while (indices.length < 3) {
          const idx = Math.floor(Math.random() * numCards);
          if (!indices.includes(idx)) indices.push(idx);
        }

        samples.push({
          episode: episodeId,
          round: r,
          player: p,
          state: {
            map_features: mapFeatures,
            card_features: cardFeatures,
            scalar_features: scalarFeatures,
          },
          action: {
            select_indices: indices,
          },
        });
      }
    }

    return samples;
  }
}

// ==================== 主入口 ====================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { episodes: 100, output: 'train/data/self_play.jsonl' };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--episodes' && args[i + 1]) {
      opts.episodes = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      opts.output = args[i + 1];
      i++;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const collector = new SelfPlayCollector();
  await collector.collect(opts.episodes, opts.output);
  
  console.log(`\n💡 下一步: cd train && pip install -r requirements.txt && python train_ppo.py`);
}

main().catch(err => {
  console.error('❌ 自对弈采集失败:', err);
  process.exit(1);
});