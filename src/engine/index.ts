import { createChessEngine } from '@/engine/createChessEngine'
import { DEFAULT_FLAIR_CONFIG_ID, FLAIR_CONFIGS } from '@/engine/flair/configs'
import { getBrowserStockfishBackend } from '@/engine/stockfish/browser'
import type { ChessEngine, DifficultyOption } from '@/engine/types'

export type { ChessEngine, DifficultyOption, StockfishBackend, UciMove, UciScore } from '@/engine/types'
export { createChessEngine, recentMovesFromChess } from '@/engine/createChessEngine'
export {
  fenSideToMove,
  scoreToWhiteBlackPct,
} from '@/engine/uci'
export {
  getFlairMatchLog,
  printFlairMatchStats,
  recordFlairMove,
  resetFlairMatchLog,
} from '@/engine/flair/log'
export type { FlairLogQuality } from '@/engine/flair/log'

export const DIFFICULTY_OPTIONS: readonly DifficultyOption[] = FLAIR_CONFIGS.map((c) => ({
  id: c.id,
  label: c.label,
}))

export const DEFAULT_DIFFICULTY_ID = DEFAULT_FLAIR_CONFIG_ID

const difficultyIds = new Set(DIFFICULTY_OPTIONS.map((c) => c.id))

export const resolveDifficultyId = (raw: unknown): string => {
  if (typeof raw === 'string' && difficultyIds.has(raw)) {
    return raw
  }
  return DEFAULT_DIFFICULTY_ID
}

let engine: ChessEngine | null = null
let engineOverride: ChessEngine | null = null

export const getEngine = (): ChessEngine => {
  if (engineOverride) {
    return engineOverride
  }
  if (!engine) {
    engine = createChessEngine(getBrowserStockfishBackend())
  }
  return engine
}

/** Tests: override the app engine. Pass null to clear. */
export const setEngine = (next: ChessEngine | null) => {
  engineOverride = next
}

/** Tests: clear override and forget the singleton. */
export const resetEngine = () => {
  engineOverride = null
  if (engine) {
    void engine.stopAndDrain()
  }
  engine = null
}
