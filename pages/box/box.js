// 烟盒收藏：换肤 + 开盒入口
const calc = require('../../utils/calc')
const skins = require('../../utils/skins')
const rewards = require('../../utils/rewards')

Page({
  data: {
    list: [], // { skin, owned, count, isCurrent, rarityName }
    fragments: 0,
    freeDraws: 0,
    packDraws: 0,
    canSingle: false,
    draws: 0,
    collected: 0,
    total: skins.SKINS.length,
    allCollected: false,
    cigsToNext: 20
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const store = wx.getStorageSync('skins') || {}
    const owned = store.owned || {}
    const total = calc.getTotal()
    const account = rewards.getAccount()
    const availability = rewards.drawAvailability(account)
    const draws = account.totalDraws
    const list = skins.SKINS.map(s => ({
      skin: s,
      rarityName: skins.RARITY[s.rarity].name,
      owned: !!owned[s.id],
      count: owned[s.id] || 0,
      isCurrent: store.currentId === s.id
    }))
    const collected = list.filter(x => x.owned).length
    this.setData({
      list,
      fragments: account.fragments,
      freeDraws: account.freeDraws,
      packDraws: account.packDraws,
      canSingle: availability.canSingle,
      draws,
      collected,
      allCollected: collected === skins.SKINS.length,
      cigsToNext: account.packDraws > 0 ? 0 : calc.CIGS_PER_PACK - (total % calc.CIGS_PER_PACK)
    })
  },

  onPick(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.list[idx]
    if (!item || !item.owned) {
      wx.showToast({ title: '还未拥有，去开盒抽它', icon: 'none' })
      return
    }
    const store = wx.getStorageSync('skins') || {}
    store.currentId = item.skin.id
    wx.setStorageSync('skins', store)
    wx.showToast({ title: '已换上 · ' + item.skin.name, icon: 'none' })
    this.refresh()
  },

  onSingleDraw() {
    if (!this.data.canSingle) {
      wx.showToast({ title: '还差 ' + Math.max(0, rewards.FRAGMENTS_PER_DRAW - this.data.fragments) + ' 个碎片', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/draw/draw?kind=single' })
  },

  onPackDraw() {
    if (this.data.packDraws <= 0) {
      wx.showToast({ title: '还差 ' + this.data.cigsToNext + ' 根获得保底', icon: 'none' })
      return
    }
    wx.navigateTo({ url: '/pages/draw/draw?kind=pack' })
  }
})
