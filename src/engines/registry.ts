import type {
  EngineCatalogEntry,
  EngineId,
  EvalEngine,
  PlayEngine,
} from '@/engines/types'
import {
  createStockfishEvalEngine,
  createStockfishPlayEngine,
} from '@/engines/stockfish/client'
import {
  DEFAULT_STOCKFISH_CONFIG_ID,
  STOCKFISH_CONFIGS,
  resolveStockfishConfigId,
} from '@/engines/stockfish/configs'
import { createLozzaPlayEngine } from '@/engines/lozza/client'
import { DEFAULT_LOZZA_CONFIG_ID, LOZZA_CONFIGS } from '@/engines/lozza/configs'
import { createHeuristicPlayEngine } from '@/engines/heuristic/client'
import {
  DEFAULT_HEURISTIC_CONFIG_ID,
  HEURISTIC_CONFIGS,
} from '@/engines/heuristic/configs'
import { createMaiaPlayEngine } from '@/engines/maia/client'
import { DEFAULT_MAIA_CONFIG_ID, MAIA_CONFIGS } from '@/engines/maia/configs'
import { createFlairPlayEngine } from '@/engines/flair/client'
import { DEFAULT_FLAIR_CONFIG_ID, FLAIR_CONFIGS } from '@/engines/flair/configs'

export const ENGINE_CATALOG: readonly EngineCatalogEntry[] = [
  {
    id: 'stockfish',
    label: 'Stockfish',
    configs: STOCKFISH_CONFIGS.map((c) => ({ id: c.id, label: c.label })),
    defaultConfigId: DEFAULT_STOCKFISH_CONFIG_ID,
  },
  {
    id: 'lozza',
    label: 'Lozza',
    configs: LOZZA_CONFIGS.map((c) => ({ id: c.id, label: c.label })),
    defaultConfigId: DEFAULT_LOZZA_CONFIG_ID,
  },
  {
    id: 'maia',
    label: 'Maia',
    configs: MAIA_CONFIGS.map((c) => ({ id: c.id, label: c.label })),
    defaultConfigId: DEFAULT_MAIA_CONFIG_ID,
  },
  {
    id: 'heuristic',
    label: 'Heuristic',
    configs: HEURISTIC_CONFIGS.map((c) => ({ id: c.id, label: c.label })),
    defaultConfigId: DEFAULT_HEURISTIC_CONFIG_ID,
  },
  {
    id: 'flair',
    label: 'Flair',
    configs: FLAIR_CONFIGS.map((c) => ({ id: c.id, label: c.label })),
    defaultConfigId: DEFAULT_FLAIR_CONFIG_ID,
  },
] as const

export const DEFAULT_ENGINE_ID: EngineId = 'stockfish'
export const DEFAULT_CONFIG_ID = DEFAULT_STOCKFISH_CONFIG_ID

const catalogById = new Map(ENGINE_CATALOG.map((e) => [e.id, e]))

export const getEngineCatalogEntry = (id: EngineId): EngineCatalogEntry =>
  catalogById.get(id) ?? ENGINE_CATALOG[0]!

export const resolveEngineId = (raw: unknown): EngineId => {
  if (
    raw === 'stockfish' ||
    raw === 'lozza' ||
    raw === 'maia' ||
    raw === 'heuristic' ||
    raw === 'flair'
  ) {
    return raw
  }
  return DEFAULT_ENGINE_ID
}

export const resolveConfigId = (engineId: EngineId, raw: unknown): string => {
  const entry = getEngineCatalogEntry(engineId)
  if (typeof raw === 'string' && entry.configs.some((c) => c.id === raw)) {
    return raw
  }
  if (engineId === 'stockfish') {
    return resolveStockfishConfigId(raw)
  }
  return entry.defaultConfigId
}

const playSingletons = new Map<EngineId, PlayEngine>()
let evalEngine: EvalEngine | null = null

const playOverrides = new Map<EngineId, PlayEngine>()
let evalOverride: EvalEngine | null = null

const createPlay = (id: EngineId): PlayEngine => {
  switch (id) {
    case 'stockfish':
      return createStockfishPlayEngine()
    case 'lozza':
      return createLozzaPlayEngine()
    case 'maia':
      return createMaiaPlayEngine()
    case 'heuristic':
      return createHeuristicPlayEngine()
    case 'flair':
      return createFlairPlayEngine()
  }
}

export const getPlayEngine = (id: EngineId): PlayEngine => {
  const override = playOverrides.get(id)
  if (override) {
    return override
  }
  let eng = playSingletons.get(id)
  if (!eng) {
    eng = createPlay(id)
    playSingletons.set(id, eng)
  }
  return eng
}

export const getEvalEngine = (): EvalEngine => {
  if (evalOverride) {
    return evalOverride
  }
  if (!evalEngine) {
    evalEngine = createStockfishEvalEngine()
  }
  return evalEngine
}

/** Tests: override play engine for a specific id. Pass null to clear. */
export const setPlayEngine = (id: EngineId, engine: PlayEngine | null) => {
  if (!engine) {
    playOverrides.delete(id)
    return
  }
  playOverrides.set(id, engine)
}

/** Tests: override eval engine. Pass null to clear. */
export const setEvalEngine = (engine: EvalEngine | null) => {
  evalOverride = engine
}

/** Tests: clear all overrides and forget singletons (except recreating on next get). */
export const resetEngineRegistry = () => {
  playOverrides.clear()
  evalOverride = null
  for (const eng of playSingletons.values()) {
    void eng.stopAndDrain()
  }
  playSingletons.clear()
  evalEngine = null
}
