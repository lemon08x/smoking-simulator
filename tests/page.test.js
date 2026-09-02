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
rhythm.syncRhythm(Date.now())
rhythm.stopRhythmVibration()
ok('节奏页：45 秒后自动完成', rhythm.data.finished === true && rhythm.data.settle && rhythm.data.settle.modeName === '节奏模式')
ok('节奏页：完成一根只入库一次', calc.getTotal() === 1)
rhythm.finish()
ok('节奏页：重复 finish 不重复入库', calc.getTotal() === 1)
rhythm.onUnload()

// 自由模式保持原有按住/松开交互
const free = loadPage('pages/smoke/smoke.js')
free.onLoad({ mode: 'free' })
free.spawnExhale = () => {}
free.onTouchStart()
free.onTouchEnd()
ok('自由页：按住松开计一口', free.data.puffs === 1 && free.started === true)
free.onUnload()

console.log(`\n结果：${passed} 通过，${failed} 失败`)
process.exit(failed ? 1 : 0)
