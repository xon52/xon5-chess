import {
  DEFAULT_DIFFICULTY_ID,
  resolveDifficultyId,
  type DifficultyId,
} from '@/game/difficulty'

const DIFFICULTY_KEY = 'xon5.difficultyId'
const ACTIVE_COLOR_KEY = 'xon5.activeColor'

export type ActiveColor = 'w' | 'b'

export type Prefs = {
  difficultyId: DifficultyId
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

/** True when the user has ever persisted difficulty or side. */
export const hasStoredPrefs = (): boolean =>
  readItem(DIFFICULTY_KEY) !== null || readItem(ACTIVE_COLOR_KEY) !== null

export const loadPrefs = (): Prefs => ({
  difficultyId: resolveDifficultyId(readItem(DIFFICULTY_KEY)),
  activeColor: resolveActiveColor(readItem(ACTIVE_COLOR_KEY)),
})

export const saveDifficulty = (id: DifficultyId) => {
  writeItem(DIFFICULTY_KEY, resolveDifficultyId(id))
}

export const saveActiveColor = (color: ActiveColor) => {
  writeItem(ACTIVE_COLOR_KEY, resolveActiveColor(color))
}

/** Persist product defaults (lowest difficulty, White) for a first visit. */
export const seedDefaultPrefs = () => {
  saveDifficulty(DEFAULT_DIFFICULTY_ID)
  saveActiveColor('w')
}

export { DEFAULT_DIFFICULTY_ID }
