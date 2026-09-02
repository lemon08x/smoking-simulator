// 页面逻辑轻量测试：不依赖开发者工具，验证路由、会话和重复结算

const path = require('path')
const store = {}
const calls = { navigate: [], vibrate: 0 }

global.wx = {
  getStorageSync: key => (key in store ? store[key] : ''),
  setStorageSync: (key, value) => { store[key] = value },
  removeStorageSync: key => { delete store[key] },
  navigateTo: ({ url }) => calls.navigate.push(url),
  navigateBack() {},
  switchTab() {},
  vibrateShort: () => { calls.vibrate++ },
  showModal() {},
  showToast() {}
}

let definition = null
global.Page = page => { definition = page }

let passed = 0
let failed = 0
function ok(name, condition, extra) {
  if (condition) {
    passed++
    console.log('[PASS]', name)
  } else {
    failed++
    console.log('[FAIL]', name, extra === undefined ? '' : ':: ' + JSON.stringify(extra))
  }
}

function loadPage(relativePath) {
  definition = null
  const file = path.join(__dirname, '..', relativePath)
  delete require.cache[require.resolve(file)]
  require(file)
  const page = Object.assign({}, definition)
  page.data = JSON.parse(JSON.stringify(definition.data))
  page.setData = update => { page.data = Object.assign({}, page.data, update) }
  return page
}

const calc = require('../utils/calc')
calc.initStorage()
require('../utils/rewards').initStorage()

// 首页模式选择和路由
const index = loadPage('pages/index/index.js')
index.onSmoke()
ok('首页：点击点一根打开模式选择', index.data.showModePicker === true)
index.startMode({ currentTarget: { dataset: { mode: 'rhythm' } } })
ok('首页：节奏模式路由参数正确', calls.navigate.pop() === '/pages/smoke/smoke?mode=rhythm')
ok('首页：记住上次模式', store.lastSmokeMode === 'rhythm')
index.startMode({ currentTarget: { dataset: { mode: 'invalid' } } })
ok('首页：非法模式回退自由模式', calls.navigate.pop() === '/pages/smoke/smoke?mode=free')

// 节奏模式按经过时间完成，同一会话只结算一次
const rhythm = loadPage('pages/smoke/smoke.js')
rhythm.onLoad({ mode: 'rhythm' })
rhythm.spawnAshFall = () => {}
rhythm.stopLoop = () => {}
rhythm.rhythmStartedAt = Date.now() - 45000
rhythm.sessionStartedAt = rhythm.rhythmStartedAt
rhythm.started = true
rhythm.rhythmAttempts = Array.from({ length: 6 }, () => ({ pressDeltaMs: 200, releaseDeltaMs: 250 }))
rhythm.syncRhythm(Date.now())
rhythm.stopRhythmVibration()
ok('节奏页：45 秒后自动完成', rhythm.data.finished === true && rhythm.data.settle && rhythm.data.settle.modeName === '节奏模式')
ok('节奏页：完成一根只入库一次', calc.getTotal() === 1)
ok('节奏页：PERFECT 结算获得四倍奖励', rhythm.data.settle.grade.key === 'perfect' && rhythm.data.settle.reward.fragments === 4)
rhythm.finish()
ok('节奏页：重复 finish 不重复入库', calc.getTotal() === 1)
rhythm.onUnload()

const rhythmInput = loadPage('pages/smoke/smoke.js')
rhythmInput.onLoad({ mode: 'rhythm' })
rhythmInput.spawnExhale = () => {}
rhythmInput.stopLoop = () => {}
rhythmInput.startRhythm()
rhythmInput.onTouchStart()
rhythmInput.rhythmStartedAt -= 3000
rhythmInput.onTouchEnd()
ok('节奏页：按吸入提示按住并在吐出点松开得到 PERFECT', rhythmInput.data.rhythmFeedback === 'PERFECT' && rhythmInput.rhythmAttempts.length === 1)
rhythmInput.onUnload()

const rewards = require('../utils/rewards')
const progressBeforeBad = rewards.getAccount().rewardedCompletions
const rhythmBad = loadPage('pages/smoke/smoke.js')
rhythmBad.onLoad({ mode: 'rhythm' })
rhythmBad.spawnAshFall = () => {}
rhythmBad.stopLoop = () => {}
rhythmBad.rhythmStartedAt = Date.now() - 45000
rhythmBad.sessionStartedAt = rhythmBad.rhythmStartedAt
rhythmBad.started = true
rhythmBad.syncRhythm(Date.now())
ok('节奏页：无操作得到 BAD 且不发奖励', rhythmBad.data.settle.grade.key === 'bad' && rhythmBad.data.settle.reward.fragments === 0)
ok('节奏页：BAD 不推进有效完成进度', rewards.getAccount().rewardedCompletions === progressBeforeBad)
rhythmBad.onUnload()

const rhythmLifecycle = loadPage('pages/smoke/smoke.js')
rhythmLifecycle.onLoad({ mode: 'rhythm' })
rhythmLifecycle.node = {}
rhythmLifecycle.startLoop = () => {}
rhythmLifecycle.stopLoop = () => {}
rhythmLifecycle.startRhythm()
rhythmLifecycle.onHide()
ok('节奏页：切后台停止振动', !rhythmLifecycle.rhythmVibrationTimer)
rhythmLifecycle.onShow()
ok('节奏页：返回吸入阶段恢复振动', !!rhythmLifecycle.rhythmVibrationTimer)
rhythmLifecycle.onUnload()

// 收藏页显示奖励账户，并可进入免费单抽
const box = loadPage('pages/box/box.js')
box.refresh()
ok('收藏页：首局后显示碎片和免费抽', box.data.fragments >= 1 && box.data.freeDraws >= 1, { fragments: box.data.fragments, freeDraws: box.data.freeDraws, rewardStore: store.rewards })
box.onSingleDraw()
const singleRoute = calls.navigate.pop()
ok('收藏页：免费单抽路由正确', singleRoute === '/pages/draw/draw?kind=single', singleRoute)

// 单抽消费免费次数并持久化烟盒
const draw = loadPage('pages/draw/draw.js')
draw.onLoad({ kind: 'single' })
draw.setData({ phase: 'shaking' })
draw.reveal()
ok('抽卡页：单抽揭晓烟盒', draw.data.phase === 'reveal' && draw.data.result && draw.data.result.id, draw.data)
ok('抽卡页：免费次数已消费', draw.data.account && draw.data.account.freeDraws === box.data.freeDraws - 1, draw.data.account)
draw.onUnload()

// 统计页的保底进度与有效奖励次数保持一致
const statsAccount = rewards.getAccount()
statsAccount.rewardedCompletions = 7
rewards.saveAccount(statsAccount)
const statsPage = loadPage('pages/stats/stats.js')
statsPage.refresh()
ok('统计页：保底进度使用有效完成次数', statsPage.data.inPack === 7)

// 自由模式保持原有按住/松开交互
const free = loadPage('pages/smoke/smoke.js')
free.onLoad({ mode: 'free' })
free.spawnExhale = () => {}
free.onTouchStart()
free.stopLoop = () => {}
free.onHide()
ok('自由页：切后台等同松开并计一口', free.data.puffs === 1 && free.started === true && free.inhaling === false)
free.onUnload()

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed ? 1 : 0)
