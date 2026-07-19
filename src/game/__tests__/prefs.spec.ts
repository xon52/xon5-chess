import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_DIFFICULTY_ID } from '@/game/difficulty'
import {
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveDifficulty,
  seedDefaultPrefs,
} from '@/game/prefs'

describe('prefs', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('defaults when storage is empty', () => {
    localStorage.clear()
    expect(hasStoredPrefs()).toBe(false)
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })

  it('round-trips difficulty and activeColor', () => {
    saveDifficulty('level-6')
    saveActiveColor('b')
    expect(hasStoredPrefs()).toBe(true)
    expect(loadPrefs()).toEqual({
      difficultyId: 'level-6',
      activeColor: 'b',
    })
  })

  it('migrates legacy skill-depth ids on load', () => {
    localStorage.setItem('xon5.difficultyId', 's6-d7')
    expect(loadPrefs()).toEqual({
      difficultyId: 'level-6',
      activeColor: 'w',
    })
  })

  it('falls back on invalid stored values', () => {
    localStorage.setItem('xon5.difficultyId', 'nope')
    localStorage.setItem('xon5.activeColor', 'x')
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })

  it('seedDefaultPrefs writes lowest difficulty and White', () => {
    seedDefaultPrefs()
    expect(hasStoredPrefs()).toBe(true)
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })
})
