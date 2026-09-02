// 双模式 + 短奖励全链路：连接微信开发者工具自动化端口 9420
const automator = require('miniprogram-automator')
const path = require('path')

const SHOT_DIR = __dirname
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const consoleErrors = []
let failed = 0

function ok(name, condition, extra) {
  const mark = condition ? 'PASS' : 'FAIL'
  if (!condition) failed++
  console.log(`[${mark}] ${name}${extra === undefined ? '' : ' :: ' + JSON.stringify(extra)}`)
}

async function shot(mp, name) {
  await mp.screenshot({ path: path.join(SHOT_DIR, name + '.png') })
}

async function reset(mp) {
  await mp.evaluate(() => {
    wx.clearStorageSync()
    wx.setStorageSync('profile', { pricePerPack: 20, cigsPerDay: 20, quitStartAt: Date.now() })
    wx.setStorageSync('days', {})
    wx.setStorageSync('total', 0)
    wx.setStorageSync('skins', { owned: { redgold: 1 }, currentId: 'redgold', totalDraws: 0 })
    wx.setStorageSync('rewards', {
      version: 1,
      fragments: 0,
      freeDraws: 0,
      packDraws: 0,
      totalDraws: 0,
      firstCompletionGranted: false,
      claims: []
    })
  })
}

async function main() {
  const mp = await automator.connect({ wsEndpoint: 'ws://localhost:9420' })
  mp.on('console', message => {
    if (message.type === 'error') consoleErrors.push(message.args.map(String).join(' '))
  })
  mp.on('exception', error => consoleErrors.push('EXCEPTION: ' + (error && (error.message || error.errorMessage || error))))
  await reset(mp)

  let page = await mp.reLaunch('/pages/index/index')
  await sleep(900)
  let data = await page.data()
  ok('首页初始资源', data.total === 0 && data.fragments === 0 && data.freeDraws === 0 && data.packDraws === 0, data)
  await page.callMethod('onSmoke')
  data = await page.data()
  ok('首页打开模式选择', data.showModePicker === true)
  await shot(mp, '01-mode-picker')

  page = await mp.reLaunch('/pages/smoke/smoke?mode=free')
  await sleep(1300)
  data = await page.data()
  ok('自由模式进入', data.mode === 'free' && data.showHint === true)
  await page.callMethod('onTouchStart')
  await sleep(800)
  await page.callMethod('onTouchEnd')
  await page.callMethod('finish')
  await sleep(1100)
  data = await page.data()
  ok('自由模式统一结算', data.showSettle && data.settle.modeName === '自由模式' && data.settle.reward.fragments >= 1, data.settle)
  await page.callMethod('onRevealReward')
  await sleep(1000)
  data = await page.data()
  ok('本局奖励翻开', data.rewardPhase === 'revealed')
  await shot(mp, '02-free-reward')

  let stored = await mp.evaluate(() => ({ total: wx.getStorageSync('total'), rewards: wx.getStorageSync('rewards') }))
  ok('首局奖励入库', stored.total === 1 && stored.rewards.fragments >= 1 && stored.rewards.freeDraws >= 1, stored)

  page = await mp.reLaunch('/pages/box/box')
  await sleep(800)
  data = await page.data()
  ok('收藏页显示奖励账户', data.canSingle && data.fragments >= 1 && data.freeDraws >= 1, data)
  const freeBefore = data.freeDraws
  await shot(mp, '03-box-wallet')

  page = await mp.reLaunch('/pages/draw/draw?kind=single')
  await sleep(700)
  await page.callMethod('onOpen')
  await sleep(1200)
  data = await page.data()
  ok('免费单抽揭晓', data.phase === 'reveal' && data.result && data.result.id, data)
  ok('免费次数消费一次', data.account.freeDraws === freeBefore - 1, data.account)
  const singleId = data.result.id
  await shot(mp, '04-single-draw')
  await page.callMethod('onOk')
  await sleep(400)
  stored = await mp.evaluate(() => wx.getStorageSync('skins'))
  ok('抽到烟盒后自动换肤', stored.currentId === singleId, stored)

  page = await mp.reLaunch('/pages/smoke/smoke?mode=rhythm')
  await sleep(1400)
  data = await page.data()
  ok('节奏模式启动', data.mode === 'rhythm' && data.rhythmPhase && data.remainingSeconds <= 45, data)
  await shot(mp, '05-rhythm')
  await page.callMethod('finish')
  await sleep(1100)
  data = await page.data()
  ok('节奏模式进入同一结算', data.showSettle && data.settle.modeName === '节奏模式' && data.settle.reward.fragments >= 1, data.settle)

  await mp.evaluate(() => {
    const account = wx.getStorageSync('rewards')
    account.packDraws = 1
    wx.setStorageSync('rewards', account)
  })
  page = await mp.reLaunch('/pages/draw/draw?kind=pack')
  await sleep(700)
  await page.callMethod('onOpen')
  await sleep(1200)
  data = await page.data()
  ok('整包保底不出普通', data.phase === 'reveal' && data.result && data.result.rarity !== 'common', data.result)
  await shot(mp, '06-pack-draw')

  page = await mp.reLaunch('/pages/box/box')
  await sleep(700)
  data = await page.data()
  ok('收藏与抽数同步', data.draws === 2 && data.collected >= 2, { draws: data.draws, collected: data.collected })

  page = await mp.reLaunch('/pages/stats/stats')
  await sleep(700)
  data = await page.data()
  ok('两种模式累计统计', data.total === 2 && data.streak === 1 && data.cells.length === 30, data)

  page = await mp.reLaunch('/pages/settings/settings')
  await sleep(700)
  data = await page.data()
  ok('设置页正常', data.profile && data.profile.pricePerPack === 20)

  page = await mp.reLaunch('/pages/index/index')
  await sleep(700)
  data = await page.data()
  ok('首页联动奖励与皮肤', data.total === 2 && data.skin && data.skin.id === singleId && data.fragments >= 2, data)
  await shot(mp, '07-index-after')

  console.log('\nconsole errors:', consoleErrors.length)
  consoleErrors.slice(0, 10).forEach(error => console.log('  ERR:', error.slice(0, 300)))
  console.log('failed:', failed)

  await reset(mp)
  await mp.reLaunch('/pages/index/index')
  await sleep(300)
  await mp.disconnect()
  process.exit(failed || consoleErrors.length ? 1 : 0)
}

main().catch(error => {
  console.error('SCRIPT ERROR:', error)
  process.exit(2)
})
