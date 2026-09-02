// 短奖励账户：碎片、免费单抽、整包保底与一次性领取

const skins = require('./skins')

const STORAGE_KEY = 'rewards'
const FRAGMENTS_PER_DRAW = 5
const CLAIM_HISTORY_LIMIT = 100
const BONUS_DOUBLE_MAX = 0.95
const BONUS_NONE_MAX = 0.8
const DUPLICATE_REFUND = { common: 1, rare: 2, legend: 3 }

function defaultAccount(total = 0, skinStore = {}) {
  return {
    version: 1,
    fragments: 0,
    freeDraws: 0,
    packDraws: Math.max(0, Math.floor(total / 20) - (skinStore.totalDraws || 0)),
    totalDraws: skinStore.totalDraws || 0,
    rewardedCompletions: total,
    firstCompletionGranted: total > 0,
    claims: []
  }
}

function normalizeAccount(raw, total = 0, skinStore = {}) {
  const base = defaultAccount(total, skinStore)
  const account = Object.assign(base, raw || {})
  account.version = 1
  account.fragments = Math.max(0, Number(account.fragments) || 0)
  account.freeDraws = Math.max(0, Number(account.freeDraws) || 0)
  account.packDraws = Math.max(0, Number(account.packDraws) || 0)
  account.totalDraws = Math.max(0, Number(account.totalDraws) || 0)
  account.rewardedCompletions = Math.max(0, Number(account.rewardedCompletions) || 0)
  account.firstCompletionGranted = !!account.firstCompletionGranted
  account.claims = Array.isArray(account.claims) ? account.claims.slice(-CLAIM_HISTORY_LIMIT) : []
  return account
}

function initStorage(total = wx.getStorageSync('total') || 0, skinStore = wx.getStorageSync('skins') || {}) {
  const raw = wx.getStorageSync(STORAGE_KEY)
  const account = normalizeAccount(raw, total, skinStore)
  wx.setStorageSync(STORAGE_KEY, account)
  return account
}

function getAccount() {
  const raw = wx.getStorageSync(STORAGE_KEY)
  return raw
    ? normalizeAccount(raw, wx.getStorageSync('total') || 0, wx.getStorageSync('skins') || {})
    : initStorage()
}

function saveAccount(account) {
  const normalized = normalizeAccount(account)
  wx.setStorageSync(STORAGE_KEY, normalized)
  return normalized
}

function bonusOf(randomValue = Math.random()) {
  const value = Math.max(0, Math.min(0.999999, Number(randomValue) || 0))
  if (value < BONUS_NONE_MAX) return 'none'
  if (value < BONUS_DOUBLE_MAX) return 'double'
  return 'free_draw'
}

function claimCompletion(sessionId, total, randomValue = Math.random(), options = {}) {
  const account = getAccount()
  const previous = account.claims.find(item => item.sessionId === sessionId)
  if (previous) return Object.assign({}, previous.reward, { duplicate: true })

  const fixedMultiplier = Number.isFinite(options.fragmentMultiplier)
    ? Math.max(0, Math.floor(options.fragmentMultiplier))
    : null
  const bonus = fixedMultiplier === null ? bonusOf(randomValue) : 'rhythm_grade'
  const fragments = fixedMultiplier === null ? (bonus === 'double' ? 2 : 1) : fixedMultiplier
  let freeDraws = fixedMultiplier === null && bonus === 'free_draw' ? 1 : 0
  let firstFree = false
  if (fragments > 0 && !account.firstCompletionGranted) {
    account.firstCompletionGranted = true
    freeDraws++
    firstFree = true
  }
  if (fragments > 0) account.rewardedCompletions++
  const packDraws = fragments > 0 && account.rewardedCompletions % 20 === 0 ? 1 : 0

  account.fragments += fragments
  account.freeDraws += freeDraws
  account.packDraws += packDraws
  const reward = {
    fragments,
    bonus,
    freeDraws,
    firstFree,
    packDraws,
    grade: options.grade || null,
    duplicate: false
  }
  account.claims.push({ sessionId, reward })
  account.claims = account.claims.slice(-CLAIM_HISTORY_LIMIT)
  saveAccount(account)
  return reward
}

function drawAvailability(account = getAccount()) {
  return {
    canSingle: account.freeDraws > 0 || account.fragments >= FRAGMENTS_PER_DRAW,
    singleCost: account.freeDraws > 0 ? 'free' : 'fragments',
    canPack: account.packDraws > 0
  }
}

function performDraw(kind = 'single', randomTier = Math.random(), randomItem = Math.random()) {
  const account = getAccount()
  const availability = drawAvailability(account)
  let cost = ''
  if (kind === 'pack') {
    if (!availability.canPack) return { ok: false, reason: 'no_pack_draw' }
    account.packDraws--
    cost = 'pack'
  } else if (account.freeDraws > 0) {
    account.freeDraws--
    cost = 'free'
  } else if (account.fragments >= FRAGMENTS_PER_DRAW) {
    account.fragments -= FRAGMENTS_PER_DRAW
    cost = 'fragments'
  } else {
    return { ok: false, reason: 'no_single_draw' }
  }

  const skin = skins.rollSkin({
    randomTier,
    randomItem,
    rarities: kind === 'pack' ? ['rare', 'legend'] : undefined
  })
  const skinStore = wx.getStorageSync('skins') || {}
  skinStore.owned = skinStore.owned || {}
  const previousCount = skinStore.owned[skin.id] || 0
  const duplicate = previousCount > 0
  skinStore.owned[skin.id] = previousCount + 1
  skinStore.totalDraws = (skinStore.totalDraws || 0) + 1

  const refund = duplicate ? DUPLICATE_REFUND[skin.rarity] : 0
  account.fragments += refund
  account.totalDraws++

  // 先保存烟盒结果，再保存资源消费；异常中断时优先保证用户不会丢奖励。
  wx.setStorageSync('skins', skinStore)
  saveAccount(account)
  return {
    ok: true,
    skin,
    count: skinStore.owned[skin.id],
    duplicate,
    refund,
    cost,
    kind,
    account: getAccount()
  }
}

module.exports = {
  STORAGE_KEY,
  FRAGMENTS_PER_DRAW,
  DUPLICATE_REFUND,
  defaultAccount,
  normalizeAccount,
  initStorage,
  getAccount,
  saveAccount,
  bonusOf,
  claimCompletion,
  drawAvailability,
  performDraw
}
