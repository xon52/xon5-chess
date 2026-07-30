import type { FlairMoveLog } from '@/engine/flair/log'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import type { UciMove, UciScore } from '@/engine/uci'

export type DifficultyOption = {
  id: string
  label: string
}

export type ChessEngine = {
  playSearch(opts: {
    fen: string
    difficultyId: string
    recentMoves?: UciMove[]
  }): Promise<UciMove | null>
  evalSearch(opts: { fen: string }): Promise<UciScore | null>
  analyzeMove(fenBefore: string, move: UciMove): Promise<Omit<FlairMoveLog, 'side'>>
  notifyNewGame(): void
  stop(): void
  stopAndDrain(): Promise<void>
}

export type { StockfishBackend, UciMove, UciScore }
