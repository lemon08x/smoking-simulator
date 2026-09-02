// 首页：数据总览 + 当前烟盒 + 点一根入口
const calc = require('../../utils/calc')
const skins = require('../../utils/skins')
const session = require('../../utils/session')
const rewards = require('../../utils/rewards')

Page({
  data: {
    today: 0,
    total: 0,
    moneyText: '¥0',
    lifeText: '0 分钟',
    streak: 0,
    skin: null,
    rarityName: '',
    fragments: 0,
    freeDraws: 0,
    packDraws: 0,
    canDraw: false,
    ms: { title: '', desc: '', pct: 0 },
    showModePicker: false,
    lastMode: session.MODE_FREE
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const profile = calc.getProfile()
    const days = calc.getDays()
    const total = calc.getTotal()
    const today = days[calc.todayStr()] || 0
    const skinStore = wx.getStorageSync('skins') || {}
    const skin = skins.getSkin(skinStore.currentId)
    const account = rewards.getAccount()
    const availability = rewards.drawAvailability(account)
    this.setData({
      today,
      total,
      moneyText: calc.moneyText(calc.moneyOf(total, profile)),
      lifeText: calc.lifeText(calc.lifeMinutesOf(total)),
      streak: calc.streakOf(days),
      skin,
      rarityName: skins.RARITY[skin.rarity].name,
      fragments: account.fragments,
      freeDraws: account.freeDraws,
      packDraws: account.packDraws,
      canDraw: availability.canSingle || availability.canPack,
      ms: calc.nextMilestone(profile.quitStartAt || Date.now()),
      lastMode: session.normalizeMode(wx.getStorageSync('lastSmokeMode'))
    })
  },

  onSmoke() {
    this.setData({ showModePicker: true })
  },

  closeModePicker() {
    this.setData({ showModePicker: false })
  },

  startMode(e) {
    const mode = session.normalizeMode(e.currentTarget.dataset.mode)
    wx.setStorageSync('lastSmokeMode', mode)
    this.setData({ showModePicker: false, lastMode: mode })
    wx.navigateTo({ url: '/pages/smoke/smoke?mode=' + mode })
  },

  noop() {},

  goBox() {
    wx.switchTab({ url: '/pages/box/box' })
  }
})
