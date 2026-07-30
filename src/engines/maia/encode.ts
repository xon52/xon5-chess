/**
 * Lc0-style board encoding for Maia ONNX ([1, 112, 8, 8]).
 * History slots (0..7) are filled with the current position (nodes=1 play).
 *
 * Plane layout follows the classical Lc0 input used by Maia nets:
 * per history step: 6 our pieces, 6 their pieces, 2 repetition; then castling,
 * no-progress, and side-to-move planes.
 */

import { Chess, type PieceSymbol, type Square } from 'chess.js'

const PIECE_ORDER: PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k']

const sqIndex = (sq: Square): number => {
  const file = sq.charCodeAt(0) - 97
  const rank = Number(sq[1]) - 1
  return rank * 8 + file
}

/** Build Float32Array NCHW [1, 112, 8, 8] flattened length 112*64. */
export const encodeMaiaInput = (fen: string): Float32Array => {
  const chess = new Chess(fen)
  const us = chess.turn()
  const them = us === 'w' ? 'b' : 'w'
  const out = new Float32Array(112 * 64)

  const setPlane = (plane: number, sq: number, value = 1) => {
    out[plane * 64 + sq] = value
  }

  const fillHistoryStep = (histBase: number) => {
    const board = chess.board()
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[7 - rank]![file]
        if (!piece) {
          continue
        }
        const sq = rank * 8 + file
        const typeIdx = PIECE_ORDER.indexOf(piece.type)
        if (typeIdx < 0) {
          continue
        }
        if (piece.color === us) {
          setPlane(histBase + typeIdx, sq)
        } else if (piece.color === them) {
          setPlane(histBase + 6 + typeIdx, sq)
        }
      }
    }
    // Repetition planes left 0 for nodes=1.
  }

  for (let h = 0; h < 8; h++) {
    fillHistoryStep(h * 13)
  }

  const castling = chess.fen().split(' ')[2] ?? '-'
  const ourKingSide = us === 'w' ? castling.includes('K') : castling.includes('k')
  const ourQueenSide = us === 'w' ? castling.includes('Q') : castling.includes('q')
  const theirKingSide = us === 'w' ? castling.includes('k') : castling.includes('K')
  const theirQueenSide = us === 'w' ? castling.includes('q') : castling.includes('Q')

  const fillConst = (plane: number, on: boolean) => {
    if (!on) {
      return
    }
    for (let i = 0; i < 64; i++) {
      setPlane(plane, i)
    }
  }

  fillConst(104, ourKingSide)
  fillConst(105, ourQueenSide)
  fillConst(106, theirKingSide)
  fillConst(107, theirQueenSide)

  // No-progress rule (50-move halfmove clock / 99).
  const halfmove = Number(chess.fen().split(' ')[4] ?? 0)
  const progress = Math.min(halfmove, 99) / 99
  for (let i = 0; i < 64; i++) {
    out[108 * 64 + i] = progress
  }

  // All zeros plane 109 (unused / total move count historically).
  // Side to move: always "us" to move in our encoding → plane 110 = 1.
  fillConst(110, true)
  // Plane 111 unused (rule50 alternate / en passant sometimes).

  void sqIndex
  return out
}
