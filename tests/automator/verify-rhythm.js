// 节奏模式真实时长专项：完整等待约 45 秒，不使用快进
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' })
  const page = await mp.reLaunch('/pages/smoke/smoke?mode=rhythm')
  await sleep(1500)
  let data = await page.data()
  if (data.mode !== 'rhythm' || data.finished) throw new Error('节奏模式未正确启动')

  await sleep(3000)
  data = await page.data()
  if (!['inhale', 'exhale'].includes(data.rhythmPhase) || data.remainingSeconds >= 45) {
    throw new Error('节奏提示或倒计时未推进')
  }

  await sleep(42000)
  data = await page.data()
  if (!data.finished || !data.showSettle || !data.settle || data.settle.modeName !== '节奏模式') {
    throw new Error('45 秒后没有自动结算')
  }

  console.log('PASS: 节奏模式真实 45 秒燃尽并自动结算')
  await mp.disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(2)
})
