import { type Chess, type Square } from 'chess.js'

/** Legal move destinations for chessground. */
export const buildLegalDests = (chess: Chess): Map<Square, Square[]> => {
  const dests = new Map<Square, Square[]>()
  for (const move of chess.moves({ verbose: true })) {
    const from = move.from
    const targets = dests.get(from)
    if (targets) {
      targets.push(move.to)
    } else {
      dests.set(from, [move.to])
    }
  }
  return dests
}

/** Last ply [from, to] for chessground highlighting; undefined at start. */
export const getLastMove = (chess: Chess): [Square, Square] | undefined => {
  const plies = chess.history({ verbose: true })
  if (plies.length === 0) {
    return undefined
  }
  const last = plies[plies.length - 1]!
  return [last.from, last.to]
}

/** True when from→to is a legal pawn promotion (any promotion piece). */
export const isPromotionMove = (chess: Chess, from: string, to: string): boolean =>
  chess
    .moves({ square: from as Square, verbose: true })
    .some((m) => m.to === to && m.promotion !== undefined)

/**
 * True when Undo can restore the human’s turn without stranded engine-to-move.
 * White: ≥1 ply (human has moved). Black: ≥2 plies (engine opening + human).
 */
export const canUndo = (
  humanColor: 'w' | 'b' | null,
  historyLength: number,
): boolean => {
  if (humanColor === null) {
    return false
  }
  return humanColor === 'w' ? historyLength >= 1 : historyLength >= 2
}
