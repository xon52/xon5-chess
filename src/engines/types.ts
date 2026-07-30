import type { UciMove, UciScore } from '@/engines/shared/uci'

export type EngineId = 'stockfish' | 'lozza' | 'maia' | 'heuristic' | 'flair'

export type EngineConfig = {
  id: string
  label: string
}

export type EngineCatalogEntry = {
  id: EngineId
  label: string
  configs: readonly EngineConfig[]
  defaultConfigId: string
}

export type PlayEngine = {
  readonly id: EngineId
  playSearch(opts: {
    fen: string
    configId: string
    /** Recent UCI moves for Flair tunnel-vision / takeback bias. Ignored by other engines. */
    recentMoves?: UciMove[]
  }): Promise<UciMove | null>
  notifyNewGame(): void
  stop(): void
  stopAndDrain(): Promise<void>
}

export type EvalEngine = {
  evalSearch(opts: { fen: string }): Promise<UciScore | null>
  stop(): void
  stopAndDrain(): Promise<void>
  notifyNewGame?(): void
}

export type { UciMove, UciScore }
