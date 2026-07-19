import { Chess, type Color, type Square } from 'chess.js'

import type { UciMove } from '@/engine/uci'

type VerboseMove = {
  from: Square
  to: Square
  promotion?: string
  captured?: string
}

/**
 * Chance to ignore the engine and use the beginner picker instead.
 * Skill 0 never uses the engine (handled separately). Fades out by skill 6.
 */
export const randomMoveChance = (skill: number): number => {
  if (skill <= 0) {
    return 1
  }
  if (skill >= 6) {
    return 0
  }
  return 1 - skill / 6
}

/** Stockfish picks the weak move at depth === 1 + skill; search must reach that depth. */
export const effectivePlayDepth = (skill: number, depth: number): number =>
  Math.max(depth, skill + 1)

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

/** True if capturing on `to` takes an undefended enemy piece (free material). */
const isFreeCapture = (chess: Chess, move: VerboseMove, enemy: Color): boolean => {
  if (!move.captured) {
    return false
  }
  return !chess.isAttacked(move.to, enemy)
}

/**
 * True if after the move, our piece on `to` is attacked and not defended
 * (classic 1-move hang of the piece we just moved).
 */
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
 * - depth 1: prefer hanging own pieces; usually refuse free captures (no calculation).
 * - depth 2+: still often hang, but usually take free pieces (matches band profiles).
 */
export const pickBeginnerMove = (
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
    // Hang material when possible.
    if (hanging.length > 0 && rng() < 0.8) {
      return toUci(pickFrom(hanging, rng))
    }
    // Almost never take free pieces.
    const safePool = other.length > 0 ? other : moves
    if (freeCaptures.length > 0 && other.length > 0 && rng() < 0.08) {
      return toUci(pickFrom(freeCaptures, rng))
    }
    return toUci(pickFrom(safePool, rng))
  }

  // Skill 0 but deeper band: often take freebies; still walk into hangs.
  if (freeCaptures.length > 0 && rng() < 0.75) {
    return toUci(pickFrom(freeCaptures, rng))
  }
  if (hanging.length > 0 && rng() < 0.5) {
    return toUci(pickFrom(hanging, rng))
  }
  return toUci(pickFrom(moves, rng))
}

export const pickRandomLegalMove = (
  fen: string,
  rng: () => number = Math.random,
): UciMove | null => {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true }) as VerboseMove[]
  if (moves.length === 0) {
    return null
  }
  return toUci(pickFrom(moves, rng))
}

/** Replace or ignore an engine move based on skill (skill 0 should not reach here). */
export const maybeWeakenMove = (
  fen: string,
  skill: number,
  depth: number,
  engineMove: UciMove | null,
  rng: () => number = Math.random,
): UciMove | null => {
  if (skill <= 0) {
    return pickBeginnerMove(fen, depth, rng)
  }
  if (rng() >= randomMoveChance(skill)) {
    return engineMove
  }
  // Low skill but > 0: mix beginner-ish random with less hang bias.
  if (skill <= 2 && rng() < 0.5) {
    return pickBeginnerMove(fen, Math.max(depth, 2), rng) ?? engineMove
  }
  return pickRandomLegalMove(fen, rng) ?? engineMove
}

/** Skill 0 never needs Stockfish — beginner picker is the whole play strength. */
export const skipsEngineSearch = (skill: number): boolean => skill <= 0
