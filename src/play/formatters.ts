import type { Color } from 'chess.js'

import type { GameStatus } from '@/game/status'

export type PromotionPiece = 'q' | 'r' | 'b' | 'n'

export const PROMOTION_CHOICES: {
  piece: PromotionPiece
  name: 'queen' | 'rook' | 'bishop' | 'knight'
  label: string
}[] = [
  { piece: 'q', name: 'queen', label: 'Queen' },
  { piece: 'r', name: 'rook', label: 'Rook' },
  { piece: 'b', name: 'bishop', label: 'Bishop' },
  { piece: 'n', name: 'knight', label: 'Knight' },
]

export const formatEvalDisplay = (
  whiteWinPct: number | null,
  blackWinPct: number | null,
): string => {
  if (whiteWinPct === null) {
    return '50 / 50'
  }
  return `${whiteWinPct} / ${blackWinPct}`
}

const WHITE_PIECES: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
}

const BLACK_PIECES: Record<string, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
  P: '♟',
}

/** Figurine SAN: piece letters → Unicode glyphs; pawns get ♙/♟. */
export const formatFigurineSan = (san: string, color: 'w' | 'b'): string => {
  if (san.startsWith('O-O')) {
    return san
  }
  const pieces = color === 'w' ? WHITE_PIECES : BLACK_PIECES
  let out: string
  const first = san[0]
  if (first && 'KQRBN'.includes(first)) {
    out = `${pieces[first]}${san.slice(1)}`
  } else {
    out = `${pieces.P}${san}`
  }
  return out.replace(/=([QRBN])/g, (_, p: string) => `=${pieces[p]}`)
}

/** Side that played ply `index` (0-based) in starting-position games. */
export const plyColor = (index: number): 'w' | 'b' => (index % 2 === 0 ? 'w' : 'b')

export const formatStatusText = (opts: {
  gameStarted: boolean
  status: GameStatus
  turn: Color
}): string => {
  if (!opts.gameStarted) {
    return 'Ready to play'
  }
  const s = opts.status
  if (s.kind === 'checkmate') {
    return s.winner === 'w' ? 'Checkmate — White wins' : 'Checkmate — Black wins'
  }
  if (s.kind === 'draw') {
    const reasons: Record<typeof s.reason, string> = {
      stalemate: 'Draw — stalemate',
      insufficient: 'Draw — insufficient material',
      'fifty-move': 'Draw — fifty-move rule',
      threefold: 'Draw — threefold repetition',
    }
    return reasons[s.reason]
  }
  return opts.turn === 'w' ? 'White to move' : 'Black to move'
}
