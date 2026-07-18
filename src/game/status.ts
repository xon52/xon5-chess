import type { Chess, Color } from 'chess.js'

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: Color }
  | {
      kind: 'draw'
      reason: 'stalemate' | 'insufficient' | 'fifty-move' | 'threefold'
    }

export const deriveStatus = (chess: Chess): GameStatus => {
  if (chess.isCheckmate()) {
    // Side to move is checkmated; the other side won.
    const winner: Color = chess.turn() === 'w' ? 'b' : 'w'
    return { kind: 'checkmate', winner }
  }

  if (chess.isStalemate()) {
    return { kind: 'draw', reason: 'stalemate' }
  }
  if (chess.isInsufficientMaterial()) {
    return { kind: 'draw', reason: 'insufficient' }
  }
  if (chess.isThreefoldRepetition()) {
    return { kind: 'draw', reason: 'threefold' }
  }
  if (chess.isDrawByFiftyMoves()) {
    return { kind: 'draw', reason: 'fifty-move' }
  }

  return { kind: 'playing' }
}
