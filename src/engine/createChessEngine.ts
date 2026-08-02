import { Chess, type Square } from 'chess.js'

import { analyzePlayedMove } from '@/engine/flair/analyze'
import { FLAIR_ANALYSIS } from '@/engine/flair/configs'
import { flairPlaySearch } from '@/engine/flair/play'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import type { ChessEngine } from '@/engine/types'
import type { UciMove } from '@/engine/uci'

/** Last N verbose history plies as UCI moves (Flair recency bias). */
export const recentMovesFromChess = (chess: Chess, n = 6): UciMove[] =>
  (
    chess.history({ verbose: true }) as Array<{
      from: Square
      to: Square
      promotion?: string
    }>
  )
    .slice(-n)
    .map((m) => ({
      from: m.from,
      to: m.to,
      promotion:
        m.promotion === 'q' || m.promotion === 'r' || m.promotion === 'b' || m.promotion === 'n'
          ? m.promotion
          : undefined,
    }))

export const createChessEngine = (backend: StockfishBackend): ChessEngine => ({
  playSearch: (opts) => flairPlaySearch(backend, opts),
  evalSearch: (opts) => backend.evalSearch(opts),
  hintSearch: async ({ fen }) => {
    const lines = await backend.multipvSearch({
      fen,
      depth: FLAIR_ANALYSIS.depth,
      multipv: 1,
    })
    return lines[0]?.move ?? null
  },
  analyzeMove: (fenBefore, move) => analyzePlayedMove(backend, fenBefore, move),
  notifyNewGame: () => backend.notifyNewGame(),
  stop: () => backend.stop(),
  stopAndDrain: () => backend.stopAndDrain(),
})
