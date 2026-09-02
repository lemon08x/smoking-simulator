// 吸烟会话：模式配置与可独立测试的节奏计算

const MODE_FREE = 'free'
const MODE_RHYTHM = 'rhythm'

const MODES = {
  [MODE_FREE]: {
    key: MODE_FREE,
    name: '自由模式',
    hint: '按住吸入 · 松开吐烟'
  },
  [MODE_RHYTHM]: {
    key: MODE_RHYTHM,
    name: '节奏模式',
    hint: '跟随提示 · 自然呼吸'
  }
}

const FREE_BURN_MS = 12000
const RHYTHM_DURATION_MS = 45000
const RHYTHM_INHALE_MS = 3000
const RHYTHM_EXHALE_MS = 4500
const RHYTHM_CYCLE_MS = RHYTHM_INHALE_MS + RHYTHM_EXHALE_MS

function normalizeMode(mode) {
  return MODES[mode] ? mode : MODE_FREE
}

function getMode(mode) {
  return MODES[normalizeMode(mode)]
}

function createSessionId(now = Date.now(), random = Math.random()) {
  return 'smoke_' + now.toString(36) + '_' + Math.floor(random * 0xFFFFFF).toString(36)
}

function rhythmState(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const finished = elapsed >= RHYTHM_DURATION_MS
  const safeElapsed = Math.min(elapsed, RHYTHM_DURATION_MS)
  const inCycle = safeElapsed % RHYTHM_CYCLE_MS
  const phase = finished ? 'done' : (inCycle < RHYTHM_INHALE_MS ? 'inhale' : 'exhale')
  return {
    elapsedMs: safeElapsed,
    progress: safeElapsed / RHYTHM_DURATION_MS,
    remainingSeconds: Math.max(0, Math.ceil((RHYTHM_DURATION_MS - safeElapsed) / 1000)),
    cycle: Math.min(6, Math.floor(safeElapsed / RHYTHM_CYCLE_MS) + 1),
    phase,
    finished
  }
}

module.exports = {
  MODE_FREE,
  MODE_RHYTHM,
  MODES,
  FREE_BURN_MS,
  RHYTHM_DURATION_MS,
  RHYTHM_INHALE_MS,
  RHYTHM_EXHALE_MS,
  RHYTHM_CYCLE_MS,
  normalizeMode,
  getMode,
  createSessionId,
  rhythmState
}
