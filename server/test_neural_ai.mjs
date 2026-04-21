/**
 * 快速测试: 验证ONNX模型可在Node.js中加载和推理
 */
import ort from 'onnxruntime-node'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function testModel() {
  const modelPath = join(__dirname, 'model.onnx')
  console.log(`📂 模型路径: ${modelPath}`)

  // 1. 加载模型
  console.log('⏳ 加载ONNX模型...')
  const session = await ort.InferenceSession.create(modelPath, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
  })
  console.log('✅ 模型加载成功!')

  // 输入/输出名称
  console.log(`  输入: ${session.inputNames.join(', ')}`)
  console.log(`  输出: ${session.outputNames.join(', ')}`)

  // 2. 构造测试输入 (v2: 4输入, 30维标量)
  const mapFeatures = new Float32Array(10 * 11 * 11)  // 全零
  const cardFeatures = new Float32Array(8 * 8)          // 全零
  const oppCardFeatures = new Float32Array(3 * 8)       // 对手牌编码(新增)
  const scalarFeatures = new Float32Array(30)            // 30维标量(原20+10新增)
  scalarFeatures[0] = 0.05   // round/20
  scalarFeatures[3] = 1.0    // my hp ratio
  scalarFeatures[4] = 1.0    // opp hp ratio
  scalarFeatures[12] = 7/11  // map width
  scalarFeatures[13] = 7/11  // map height
  scalarFeatures[20] = 0.3   // manhattan distance
  scalarFeatures[25] = 0.2   // opp card type: move
  scalarFeatures[26] = 0.2   // opp card type: attack
  scalarFeatures[27] = 0.2   // opp card type: defense
  scalarFeatures[28] = 0.2   // opp card type: scout
  scalarFeatures[29] = 0.2   // opp card type: skill

  const mapTensor = new ort.Tensor('float32', mapFeatures, [1, 10, 11, 11])
  const cardTensor = new ort.Tensor('float32', cardFeatures, [1, 8, 8])
  const oppCardTensor = new ort.Tensor('float32', oppCardFeatures, [1, 3, 8])
  const scalarTensor = new ort.Tensor('float32', scalarFeatures, [1, 30])

  // 3. 运行推理
  console.log('⏳ 运行推理...')
  const results = await session.run({
    map_input: mapTensor,
    card_input: cardTensor,
    opp_card_input: oppCardTensor,
    scalar_input: scalarTensor,
  })

  // 4. 检查输出
  const cardLogits = Array.from(results.card_logits.data)
  const orderLogits = Array.from(results.order_logits.data)
  const value = results.value.data[0]

  console.log('✅ 推理成功!')
  console.log(`  card_logits: [${cardLogits.map(v => v.toFixed(4)).join(', ')}]`)
  console.log(`  order_logits: [${orderLogits.map(v => v.toFixed(4)).join(', ')}]`)
  console.log(`  value: ${value.toFixed(4)}`)

  // 5. 验证输出形状
  console.log('\n📊 输出形状:')
  console.log(`  card_logits: ${JSON.stringify(results.card_logits.dims)} (期望: [1,8])`)
  console.log(`  order_logits: ${JSON.stringify(results.order_logits.dims)} (期望: [1,3])`)
  console.log(`  value: ${JSON.stringify(results.value.dims)} (期望: [1,1])`)

  const shapesOk = 
    results.card_logits.dims[1] === 8 &&
    results.order_logits.dims[1] === 3 &&
    results.value.dims[1] === 1

  if (shapesOk) {
    console.log('\n🎉 所有测试通过! NeuralAIPlayer 可以正常使用此模型。')
  } else {
    console.log('\n❌ 输出形状不匹配，需要检查模型。')
  }
}

testModel().catch(err => {
  console.error('❌ 测试失败:', err.message)
  process.exit(1)
})