import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTY_PRESETS,
  formatDifficultyLabel,
  getDifficulty,
  resolveDifficultyId,
} from '@/game/difficulty'

describe('difficulty', () => {
  it('exposes ten named presets', () => {
    expect(DIFFICULTY_PRESETS).toHaveLength(10)
    expect(DEFAULT_DIFFICULTY_ID).toBe('level-1')
  })

  it('keeps skill and depth in UCI-safe ranges', () => {
    for (const preset of DIFFICULTY_PRESETS) {
      expect(preset.playSkill).toBeGreaterThanOrEqual(0)
      expect(preset.playSkill).toBeLessThanOrEqual(20)
      expect(preset.playDepth).toBeGreaterThanOrEqual(1)
      expect(preset.playDepth).toBeLessThanOrEqual(20)
    }
  })

  it('resolves known ids, migrates legacy ids, and falls back to default', () => {
    expect(resolveDifficultyId('level-5')).toBe('level-5')
    expect(resolveDifficultyId('s4-d5')).toBe('level-5')
    expect(resolveDifficultyId('s0-d1')).toBe('level-1')
    expect(resolveDifficultyId('s8-d8')).toBe('level-7')
    expect(resolveDifficultyId('missing')).toBe(DEFAULT_DIFFICULTY_ID)
    expect(resolveDifficultyId(null)).toBe(DEFAULT_DIFFICULTY_ID)
    expect(resolveDifficultyId(42)).toBe(DEFAULT_DIFFICULTY_ID)
  })

  it('getDifficulty returns the matching preset', () => {
    expect(getDifficulty('level-10')).toMatchObject({
      name: 'Maximum',
      playSkill: 20,
      playDepth: 14,
    })
  })

  it('formats dropdown labels with name, skill, and depth', () => {
    expect(formatDifficultyLabel(getDifficulty('level-6'))).toBe(
      'Strong club · Skill 9 · Depth 6',
    )
  })
})
