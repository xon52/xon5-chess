/**
 * Map legal UCI moves to scores from Maia's 5120-length convolutional policy.
 * Classical Lc0 indexing: from_square * 73 + move_type.
 */

import { Chess, type Square } from 'chess.js'

import type { UciMove } from '@/engines/shared/uci'

const knightDeltas = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const

const queenDirs = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
] as const

const sqToCoords = (sq: string): { file: number; rank: number } | null => {
  if (sq.length < 2) {
    return null
  }
  const file = sq.charCodeAt(0) - 97
  const rank = Number(sq[1]) - 1
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null
  }
  return { file, rank }
}

export const moveToPolicyIndex = (from: string, to: string, promotion?: string): number | null => {
  const a = sqToCoords(from)
  const b = sqToCoords(to)
  if (!a || !b) {
    return null
  }
  const df = b.file - a.file
  const dr = b.rank - a.rank
  const fromIdx = a.rank * 8 + a.file

  if (promotion && promotion !== 'q') {
    const promoPiece = promotion === 'r' ? 0 : promotion === 'b' ? 1 : 2
    let dir = -1
    if (df === -1) {
      dir = 0
    } else if (df === 0) {
      dir = 1
    } else if (df === 1) {
      dir = 2
    }
    if (dir < 0) {
      return null
    }
    return fromIdx * 73 + 64 + promoPiece * 3 + dir
  }

  for (let i = 0; i < knightDeltas.length; i++) {
    if (df === knightDeltas[i]![0] && dr === knightDeltas[i]![1]) {
      return fromIdx * 73 + 56 + i
    }
  }

  for (let d = 0; d < queenDirs.length; d++) {
    const [dx, dy] = queenDirs[d]!
    if (dx === 0) {
      if (df !== 0 || dr === 0 || Math.sign(dr) !== Math.sign(dy)) {
        continue
      }
      const dist = Math.abs(dr)
      if (dist < 1 || dist > 7) {
        continue
      }
      return fromIdx * 73 + d * 7 + (dist - 1)
    }
    if (dy === 0) {
      if (dr !== 0 || df === 0 || Math.sign(df) !== Math.sign(dx)) {
        continue
      }
      const dist = Math.abs(df)
      if (dist < 1 || dist > 7) {
        continue
      }
      return fromIdx * 73 + d * 7 + (dist - 1)
    }
    if (Math.abs(df) !== Math.abs(dr)) {
      continue
    }
    if (Math.sign(df) !== Math.sign(dx) || Math.sign(dr) !== Math.sign(dy)) {
      continue
    }
    const dist = Math.abs(df)
    if (dist < 1 || dist > 7) {
      continue
    }
    return fromIdx * 73 + d * 7 + (dist - 1)
  }

  return null
}

export const pickMoveFromPolicy = (
  fen: string,
  policy: Float32Array | number[],
  rng: () => number = Math.random,
): UciMove | null => {
  const chess = new Chess(fen)
  const legal = chess.moves({ verbose: true }) as {
    from: Square
    to: Square
    promotion?: string
  }[]
  if (legal.length === 0) {
    return null
  }

  let best: UciMove | null = null
  let bestScore = -Infinity

  for (const m of legal) {
    const promotion =
      m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
        ? m.promotion
        : undefined
    const idx = moveToPolicyIndex(m.from, m.to, promotion)
    const score = idx !== null && idx < policy.length ? Number(policy[idx]) : -1e9
    if (score > bestScore) {
      bestScore = score
      best = { from: m.from, to: m.to, promotion }
    }
  }

  if (!best || bestScore <= -1e9) {
    const m = legal[Math.floor(rng() * legal.length)]!
    const promotion =
      m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
        ? m.promotion
        : undefined
    return { from: m.from, to: m.to, promotion }
  }

  return best
}
