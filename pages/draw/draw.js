// 开盒抽奖：抖动 → 翻转揭晓，稀有度光效 + 重复彩蛋
const skins = require('../../utils/skins')
const rewards = require('../../utils/rewards')

Page({
  data: {
    phase: 'ready', // ready | shaking | reveal
    mystery: skins.MYSTERY_SKIN,
    result: null,
    resultRarity: null,
    isNew: false,
    line: '',
    count: 0,
    kind: 'single',
    kindName: '单抽',
    costText: '',
    refund: 0,
    account: null
  },

  onLoad(options = {}) {
    const kind = options.kind === 'pack' ? 'pack' : 'single'
    const account = rewards.getAccount()
    const availability = rewards.drawAvailability(account)
    const allowed = kind === 'pack' ? availability.canPack : availability.canSingle
    this.setData({
      kind,
      kindName: kind === 'pack' ? '稀有保底' : '烟盒单抽',
      costText: kind === 'pack'
        ? '消耗 1 次保底资格'
        : (account.freeDraws > 0 ? '本次免费' : '消耗烟标碎片 ×5'),
      account
    })
    if (!allowed) {
      wx.showToast({ title: '当前没有可用抽卡', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
    }
  },

  onUnload() {
    clearTimeout(this.revealTimer)
  },

  onOpen() {
    if (this.data.phase !== 'ready') return
    this.setData({ phase: 'shaking' })
    this.revealTimer = setTimeout(() => this.reveal(), 950)
  },

  reveal() {
    if (this.data.phase !== 'shaking') return
    const draw = rewards.performDraw(this.data.kind)
    if (!draw.ok) {
      this.setData({ phase: 'ready' })
      wx.showToast({ title: '抽卡资源不足，请返回刷新', icon: 'none' })
      return
    }
    const skin = draw.skin
    const isNew = !draw.duplicate
    const count = draw.count
    const line = isNew
      ? skins.pick(skins.FIRST_LINES)
      : skins.renderLine(skins.pick(skins.DUPE_LINES), { name: skin.name, n: count })

    wx.vibrateShort({ type: 'medium' })
    this.setData({
      phase: 'reveal',
      result: skin,
      resultRarity: skins.RARITY[skin.rarity],
      isNew,
      line,
      count,
      refund: draw.refund,
      account: draw.account
    })
  },

  onOk() {
    // 拥有即换上，新皮肤直接装备
    const store = wx.getStorageSync('skins') || {}
    if (this.data.result && store.owned[this.data.result.id]) {
      store.currentId = this.data.result.id
      wx.setStorageSync('skins', store)
    }
    wx.navigateBack()
  }
})
