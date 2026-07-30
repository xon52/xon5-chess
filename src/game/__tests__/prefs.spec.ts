import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_DIFFICULTY_ID } from '@/engine'
import {
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveDifficultyId,
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

  it('round-trips difficulty and color', () => {
    saveDifficultyId('club')
    saveActiveColor('b')
    expect(hasStoredPrefs()).toBe(true)
    expect(loadPrefs()).toEqual({
      difficultyId: 'club',
      activeColor: 'b',
    })
  })

  it('migrates legacy difficultyId to Flair beginner when unknown', () => {
    localStorage.setItem('xon5.difficultyId', 's6-d7')
    expect(loadPrefs()).toEqual({
      difficultyId: 'beginner',
      activeColor: 'w',
    })
  })

  it('falls back on invalid stored values', () => {
    localStorage.setItem('xon5.engineId', 'lozza')
    localStorage.setItem('xon5.configId', 'level-3')
    localStorage.setItem('xon5.activeColor', 'x')
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })

  it('seedDefaultPrefs writes Flair beginner and White', () => {
    seedDefaultPrefs()
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })
})
