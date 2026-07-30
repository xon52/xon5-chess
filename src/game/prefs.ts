import {
  DEFAULT_CONFIG_ID,
  DEFAULT_ENGINE_ID,
  resolveConfigId,
  resolveEngineId,
} from '@/engines/registry'
import type { EngineId } from '@/engines/types'
import { resolveStockfishConfigId } from '@/engines/stockfish/configs'

const ENGINE_KEY = 'xon5.engineId'
const CONFIG_KEY = 'xon5.configId'
const DIFFICULTY_KEY = 'xon5.difficultyId'
const ACTIVE_COLOR_KEY = 'xon5.activeColor'

export type ActiveColor = 'w' | 'b'

export type Prefs = {
  engineId: EngineId
  configId: string
  activeColor: ActiveColor
}

const canUseStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

const readItem = (key: string): string | null => {
  if (!canUseStorage()) {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeItem = (key: string, value: string) => {
  if (!canUseStorage()) {
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const resolveActiveColor = (raw: unknown): ActiveColor =>
  raw === 'b' ? 'b' : 'w'

/** True when the user has ever persisted engine/config/difficulty or side. */
export const hasStoredPrefs = (): boolean =>
  readItem(ENGINE_KEY) !== null ||
  readItem(CONFIG_KEY) !== null ||
  readItem(DIFFICULTY_KEY) !== null ||
  readItem(ACTIVE_COLOR_KEY) !== null

export const loadPrefs = (): Prefs => {
  const storedEngine = readItem(ENGINE_KEY)
  const storedConfig = readItem(CONFIG_KEY)
  const legacyDifficulty = readItem(DIFFICULTY_KEY)

  // Migrate pre-multi-engine difficultyId → stockfish + config.
  if (!storedEngine && legacyDifficulty) {
    const engineId: EngineId = 'stockfish'
    const configId = resolveStockfishConfigId(legacyDifficulty)
    writeItem(ENGINE_KEY, engineId)
    writeItem(CONFIG_KEY, configId)
    return {
      engineId,
      configId,
      activeColor: resolveActiveColor(readItem(ACTIVE_COLOR_KEY)),
    }
  }

  const engineId = resolveEngineId(storedEngine)
  const configId = resolveConfigId(engineId, storedConfig)
  return {
    engineId,
    configId,
    activeColor: resolveActiveColor(readItem(ACTIVE_COLOR_KEY)),
  }
}

export const saveEngineSelection = (engineId: EngineId, configId: string) => {
  const eng = resolveEngineId(engineId)
  const cfg = resolveConfigId(eng, configId)
  writeItem(ENGINE_KEY, eng)
  writeItem(CONFIG_KEY, cfg)
}

export const saveActiveColor = (color: ActiveColor) => {
  writeItem(ACTIVE_COLOR_KEY, resolveActiveColor(color))
}

/** Persist product defaults (Stockfish beginner, White) for a first visit. */
export const seedDefaultPrefs = () => {
  saveEngineSelection(DEFAULT_ENGINE_ID, DEFAULT_CONFIG_ID)
  saveActiveColor('w')
}

export { DEFAULT_ENGINE_ID, DEFAULT_CONFIG_ID }
