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
    hint: '按住松开 · 成绩决定奖励'
  }
}

const FREE_BURN_MS = 12000
const RHYTHM_DURATION_MS = 45000
const RHYTHM_INHALE_MS = 3000
const RHYTHM_EXHALE_MS = 4500
const RHYTHM_CYCLE_MS = RHYTHM_INHALE_MS + RHYTHM_EXHALE_MS
const RHYTHM_ROUNDS = 6

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
    cycle: Math.min(RHYTHM_ROUNDS, Math.floor(safeElapsed / RHYTHM_CYCLE_MS) + 1),
    phase,
    finished
  }
}

function timingPoint(deltaMs) {
  const delta = Math.abs(Number(deltaMs))
  if (!Number.isFinite(delta)) return 0
  if (delta <= 600) return 1
  if (delta <= 1400) return 0.7
  if (delta <= 2500) return 0.35
  return 0
}

function rhythmRoundScore(attempt) {
  if (!attempt || attempt.pressDeltaMs === undefined || attempt.releaseDeltaMs === undefined) return 0
  return (timingPoint(attempt.pressDeltaMs) + timingPoint(attempt.releaseDeltaMs)) / 2
}

function rhythmGrade(attempts = []) {
  let totalScore = 0
  let hitRounds = 0
  for (let i = 0; i < RHYTHM_ROUNDS; i++) {
    const score = rhythmRoundScore(attempts[i])
    totalScore += score
    if (score >= 0.5) hitRounds++
  }
  const ratio = totalScore / RHYTHM_ROUNDS
  if (ratio >= 0.85) return { key: 'perfect', name: 'PERFECT', multiplier: 4, ratio, hitRounds }
  if (ratio >= 0.65) return { key: 'great', name: 'GREAT', multiplier: 3, ratio, hitRounds }
  if (ratio >= 0.4) return { key: 'good', name: 'GOOD', multiplier: 2, ratio, hitRounds }
  return { key: 'bad', name: 'BAD', multiplier: 0, ratio, hitRounds }
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
  RHYTHM_ROUNDS,
  normalizeMode,
  getMode,
  createSessionId,
  rhythmState,
  timingPoint,
  rhythmRoundScore,
  rhythmGrade
}
