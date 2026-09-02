// 节奏模式真实时长专项：完整等待约 45 秒，不使用快进
const automator = require('miniprogram-automator')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' })
  const page = await mp.reLaunch('/pages/smoke/smoke?mode=rhythm')
  await sleep(700)
  let data = await page.data()
  if (data.mode !== 'rhythm' || data.finished) throw new Error('节奏模式未正确启动')

  let pressing = false
  let previousCycle = 0
  const deadline = Date.now() + 50000
  while (Date.now() < deadline) {
    data = await page.data()
    if (data.finished) break
    if (data.rhythmPhase === 'inhale' && !pressing && data.rhythmCycle !== previousCycle) {
      await page.callMethod('onTouchStart')
      pressing = true
      previousCycle = data.rhythmCycle
    } else if (data.rhythmPhase === 'exhale' && pressing) {
      await page.callMethod('onTouchEnd')
      pressing = false
    }
    await sleep(100)
  }
  if (pressing) await page.callMethod('onTouchEnd')
  await sleep(1100)
  data = await page.data()
  if (!data.finished || !data.showSettle || !data.settle || data.settle.modeName !== '节奏模式') {
    throw new Error('45 秒后没有自动结算')
  }
  if (data.settle.grade.key !== 'perfect' || data.settle.reward.fragments !== 4) {
    throw new Error('完整跟拍没有得到 PERFECT ×4：' + JSON.stringify(data.settle.grade))
  }

  console.log('PASS: 节奏模式真实 45 秒完成并获得 PERFECT ×4')
  await mp.disconnect()
}

main().catch(error => {
  console.error(error)
  process.exit(2)
})
