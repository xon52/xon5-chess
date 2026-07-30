import { Chess, type Color, type Square } from 'chess.js'

import type { UciMove } from '@/engines/shared/uci'

type VerboseMove = {
  from: Square
  to: Square
  promotion?: string
  captured?: string
}

const toUci = (move: VerboseMove): UciMove => {
  const promotion =
    move.promotion === 'q' ||
    move.promotion === 'r' ||
    move.promotion === 'b' ||
    move.promotion === 'n'
      ? move.promotion
      : undefined
  return { from: move.from, to: move.to, promotion }
}

const pickFrom = <T>(items: T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)]!

const isFreeCapture = (chess: Chess, move: VerboseMove, enemy: Color): boolean => {
  if (!move.captured) {
    return false
  }
  return !chess.isAttacked(move.to, enemy)
}

const hangsMovedPiece = (fen: string, move: VerboseMove, us: Color, enemy: Color): boolean => {
  const chess = new Chess(fen)
  try {
    chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    })
  } catch {
    return false
  }
  return chess.isAttacked(move.to, enemy) && !chess.isAttacked(move.to, us)
}

/**
 * True-beginner move choice:
 * - depth 1: prefer hanging own pieces; usually refuse free captures.
 * - depth 2+: still often hang, but usually take free pieces.
 */
export const pickHeuristicMove = (
  fen: string,
  depth: number,
  rng: () => number = Math.random,
): UciMove | null => {
  const chess = new Chess(fen)
  const us = chess.turn()
  const enemy: Color = us === 'w' ? 'b' : 'w'
  const moves = chess.moves({ verbose: true }) as VerboseMove[]
  if (moves.length === 0) {
    return null
  }

  const hanging: VerboseMove[] = []
  const freeCaptures: VerboseMove[] = []
  const other: VerboseMove[] = []

  for (const move of moves) {
    const free = isFreeCapture(chess, move, enemy)
    const hangs = hangsMovedPiece(fen, move, us, enemy)
    if (hangs) {
      hanging.push(move)
    } else if (free) {
      freeCaptures.push(move)
    } else {
      other.push(move)
    }
  }

  const trueBeginner = depth <= 1

  if (trueBeginner) {
    if (hanging.length > 0 && rng() < 0.8) {
      return toUci(pickFrom(hanging, rng))
    }
    const safePool = other.length > 0 ? other : moves
    if (freeCaptures.length > 0 && other.length > 0 && rng() < 0.08) {
      return toUci(pickFrom(freeCaptures, rng))
    }
    return toUci(pickFrom(safePool, rng))
  }

  if (freeCaptures.length > 0 && rng() < 0.75) {
    return toUci(pickFrom(freeCaptures, rng))
  }
  if (hanging.length > 0 && rng() < 0.5) {
    return toUci(pickFrom(hanging, rng))
  }
  return toUci(pickFrom(moves, rng))
}
