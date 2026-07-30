import type { UciMove } from '@/engine/uci'

const fileOf = (sq: string) => sq.charCodeAt(0) - 97
const rankOf = (sq: string) => Number(sq[1]) - 1

const chebyshev = (a: string, b: string): number =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)))

/**
 * Heuristic "tunnel vision" score. Beginners overweight recency:
 * takebacks on the last square, continuing the piece that just moved,
 * and activity near the recent theatre of the board.
 */
export const recencyScore = (move: UciMove, recentMoves: readonly UciMove[]): number => {
  if (recentMoves.length === 0) {
    return 0
  }

  let score = 0
  const last = recentMoves[recentMoves.length - 1]!

  // Obvious takeback / recapture onto the square just played to.
  if (move.to === last.to) {
    score += 100
  }
  // Keep moving the piece that just arrived (single-piece focus).
  if (move.from === last.to) {
    score += 45
  }
  if (move.to === last.from || move.from === last.from) {
    score += 20
  }

  const window = recentMoves.slice(-3)
  for (const recent of window) {
    score += Math.max(0, 6 - chebyshev(move.from, recent.to))
    score += Math.max(0, 6 - chebyshev(move.to, recent.to))
    score += Math.max(0, 4 - chebyshev(move.from, recent.from))
    score += Math.max(0, 4 - chebyshev(move.to, recent.from))
  }

  return score
}

/** Softmax-ish pick: blend uniform with recency. bias 0 = uniform, 1 = strongly recent. */
export const pickWithRecency = <T extends { move: UciMove }>(
  items: T[],
  recentMoves: readonly UciMove[],
  bias: number,
  rng: () => number,
): T => {
  if (items.length === 1) {
    return items[0]!
  }
  const b = Math.max(0, Math.min(1, bias))
  if (b <= 0 || recentMoves.length === 0) {
    return items[Math.floor(rng() * items.length)]!
  }

  const weights = items.map((item) => {
    const r = recencyScore(item.move, recentMoves)
    return (1 - b) * 1 + b * (1 + r)
  })
  const total = weights.reduce((a, w) => a + w, 0)
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!
    if (roll < 0) {
      return items[i]!
    }
  }
  return items[items.length - 1]!
}

const moveKey = (m: UciMove) => `${m.from}${m.to}${m.promotion ?? ''}`

/**
 * Merge shallow engine candidates with high-recency legal moves (prefer takebacks).
 * Always reserves room for at least one shallow engine move when present, so a low
 * multipvCap cannot become takeback-only (that forced GM/cap-1 into bad recaptures).
 */
export const buildCandidateMoves = (
  shallow: UciMove[],
  legal: UciMove[],
  recentMoves: readonly UciMove[],
  cap: number,
): UciMove[] => {
  const limit = Math.max(1, cap)
  const out: UciMove[] = []
  const seen = new Set<string>()
  const push = (m: UciMove) => {
    const k = moveKey(m)
    if (seen.has(k)) {
      return
    }
    seen.add(k)
    out.push(m)
  }

  const last = recentMoves[recentMoves.length - 1]
  const takebacks: UciMove[] = []
  if (last) {
    for (const m of legal) {
      if (m.to === last.to) {
        takebacks.push(m)
      }
    }
  }

  const reservedForShallow = shallow.length > 0 ? 1 : 0
  const takebackRoom = Math.max(0, limit - reservedForShallow)
  for (const m of takebacks) {
    if (out.length >= takebackRoom) {
      break
    }
    push(m)
  }

  for (const m of shallow) {
    if (out.length >= limit) {
      break
    }
    push(m)
  }

  const ranked = [...legal].sort(
    (a, b) => recencyScore(b, recentMoves) - recencyScore(a, recentMoves),
  )
  for (const m of ranked) {
    if (out.length >= limit) {
      break
    }
    push(m)
  }

  return out
}
