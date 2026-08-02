import { Chess, type Color, type PieceSymbol } from 'chess.js'

const PIECE_ORDER: PieceSymbol[] = ['q', 'r', 'b', 'n', 'p']

export type CapturedPiece = {
  type: PieceSymbol
  color: Color
}

/** Captured pieces for each side (pieces that color lost), ordered Q→P. */
export const capturesBySide = (
  chess: Chess,
): { w: CapturedPiece[]; b: CapturedPiece[] } => {
  const lost: { w: CapturedPiece[]; b: CapturedPiece[] } = { w: [], b: [] }
  const history = chess.history({ verbose: true }) as Array<{
    captured?: PieceSymbol
    color: Color
  }>

  for (const move of history) {
    if (!move.captured) {
      continue
    }
    // Captured piece belongs to the opponent of the mover.
    const lostColor: Color = move.color === 'w' ? 'b' : 'w'
    lost[lostColor].push({ type: move.captured, color: lostColor })
  }

  const sortLost = (pieces: CapturedPiece[]) =>
    [...pieces].sort(
      (a, b) => PIECE_ORDER.indexOf(a.type) - PIECE_ORDER.indexOf(b.type),
    )

  return { w: sortLost(lost.w), b: sortLost(lost.b) }
}
