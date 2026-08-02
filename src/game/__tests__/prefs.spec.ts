import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_DIFFICULTY_ID } from '@/engine'
import {
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveBoardTheme,
  saveDifficultyId,
  savePanelOpen,
  savePanelPinned,
  saveShowMoveQualities,
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
      boardTheme: 'classic',
      panelPinned: false,
      panelOpen: true,
      showMoveQualities: true,
    })
  })

  it('round-trips difficulty and color', () => {
    saveDifficultyId('club')
    saveActiveColor('b')
    expect(hasStoredPrefs()).toBe(true)
    expect(loadPrefs()).toEqual({
      difficultyId: 'club',
      activeColor: 'b',
      boardTheme: 'classic',
      panelPinned: false,
      panelOpen: true,
      showMoveQualities: true,
    })
  })

  it('round-trips ui prefs', () => {
    saveBoardTheme('grey')
    savePanelPinned(true)
    savePanelOpen(true)
    saveShowMoveQualities(false)
    expect(loadPrefs()).toMatchObject({
      boardTheme: 'grey',
      panelPinned: true,
      panelOpen: true,
      showMoveQualities: false,
    })
  })

  it('migrates legacy difficultyId to Flair beginner when unknown', () => {
    localStorage.setItem('xon5.difficultyId', 's6-d7')
    expect(loadPrefs()).toEqual({
      difficultyId: 'beginner',
      activeColor: 'w',
      boardTheme: 'classic',
      panelPinned: false,
      panelOpen: true,
      showMoveQualities: true,
    })
  })

  it('falls back on invalid stored values', () => {
    localStorage.setItem('xon5.engineId', 'lozza')
    localStorage.setItem('xon5.configId', 'level-3')
    localStorage.setItem('xon5.activeColor', 'x')
    expect(loadPrefs()).toEqual({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
      boardTheme: 'classic',
      panelPinned: false,
      panelOpen: true,
      showMoveQualities: true,
    })
  })

  it('seedDefaultPrefs writes Flair beginner and White', () => {
    seedDefaultPrefs()
    expect(loadPrefs()).toMatchObject({
      difficultyId: DEFAULT_DIFFICULTY_ID,
      activeColor: 'w',
    })
  })
})
