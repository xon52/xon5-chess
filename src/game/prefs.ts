import {
  DEFAULT_DIFFICULTY_ID,
  resolveDifficultyId,
} from '@/engine'

const ENGINE_KEY = 'xon5.engineId'
/** Persisted difficulty; key kept as configId for migration compatibility. */
const CONFIG_KEY = 'xon5.configId'
const DIFFICULTY_KEY = 'xon5.difficultyId'
const ACTIVE_COLOR_KEY = 'xon5.activeColor'

export type ActiveColor = 'w' | 'b'

export type Prefs = {
  difficultyId: string
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

/** True when the user has ever persisted config/difficulty/engine or side. */
export const hasStoredPrefs = (): boolean =>
  readItem(ENGINE_KEY) !== null ||
  readItem(CONFIG_KEY) !== null ||
  readItem(DIFFICULTY_KEY) !== null ||
  readItem(ACTIVE_COLOR_KEY) !== null

export const loadPrefs = (): Prefs => {
  const storedConfig = readItem(CONFIG_KEY)
  const legacyDifficulty = readItem(DIFFICULTY_KEY)

  let difficultyId = DEFAULT_DIFFICULTY_ID
  if (storedConfig !== null) {
    difficultyId = resolveDifficultyId(storedConfig)
    if (difficultyId !== storedConfig) {
      writeItem(CONFIG_KEY, difficultyId)
    }
  } else if (legacyDifficulty !== null) {
    // Pre-Flair difficulty ids are not Flair configs → beginner.
    difficultyId = resolveDifficultyId(legacyDifficulty)
    writeItem(CONFIG_KEY, difficultyId)
  }

  return {
    difficultyId,
    activeColor: resolveActiveColor(readItem(ACTIVE_COLOR_KEY)),
  }
}

export const saveDifficultyId = (difficultyId: string) => {
  writeItem(CONFIG_KEY, resolveDifficultyId(difficultyId))
}

export const saveActiveColor = (color: ActiveColor) => {
  writeItem(ACTIVE_COLOR_KEY, resolveActiveColor(color))
}

/** Persist product defaults (Flair beginner, White) for a first visit. */
export const seedDefaultPrefs = () => {
  saveDifficultyId(DEFAULT_DIFFICULTY_ID)
  saveActiveColor('w')
}

export { DEFAULT_DIFFICULTY_ID }
