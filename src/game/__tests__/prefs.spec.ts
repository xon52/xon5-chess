import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_CONFIG_ID, DEFAULT_ENGINE_ID } from '@/engines/registry'
import {
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveEngineSelection,
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
      engineId: DEFAULT_ENGINE_ID,
      configId: DEFAULT_CONFIG_ID,
      activeColor: 'w',
    })
  })

  it('round-trips engine and config', () => {
    saveEngineSelection('lozza', 'level-3')
    saveActiveColor('b')
    expect(hasStoredPrefs()).toBe(true)
    expect(loadPrefs()).toEqual({
      engineId: 'lozza',
      configId: 'level-3',
      activeColor: 'b',
    })
  })

  it('migrates legacy difficultyId to stockfish config', () => {
    localStorage.setItem('xon5.difficultyId', 's6-d7')
    expect(loadPrefs()).toEqual({
      engineId: 'stockfish',
      configId: 'level-6',
      activeColor: 'w',
    })
  })

  it('falls back on invalid stored values', () => {
    localStorage.setItem('xon5.engineId', 'nope')
    localStorage.setItem('xon5.configId', 'nope')
    localStorage.setItem('xon5.activeColor', 'x')
    expect(loadPrefs()).toEqual({
      engineId: DEFAULT_ENGINE_ID,
      configId: DEFAULT_CONFIG_ID,
      activeColor: 'w',
    })
  })

  it('seedDefaultPrefs writes stockfish beginner and White', () => {
    seedDefaultPrefs()
    expect(loadPrefs()).toEqual({
      engineId: DEFAULT_ENGINE_ID,
      configId: DEFAULT_CONFIG_ID,
      activeColor: 'w',
    })
  })
})
