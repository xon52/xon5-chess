import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DIFFICULTY_ID,
  DIFFICULTY_PRESETS,
  formatDifficultyLabel,
  getDifficulty,
  resolveDifficultyId,
} from '@/game/difficulty'

describe('difficulty', () => {
  it('exposes seven product-capped presets', () => {
    expect(DIFFICULTY_PRESETS).toHaveLength(7)
    expect(DEFAULT_DIFFICULTY_ID).toBe('s0-d1')
  })

  it('keeps playSkill and playDepth at or below 8', () => {
    for (const preset of DIFFICULTY_PRESETS) {
      expect(preset.playSkill).toBeLessThanOrEqual(8)
      expect(preset.playDepth).toBeLessThanOrEqual(8)
      expect(preset.playSkill).toBeGreaterThanOrEqual(0)
      expect(preset.playDepth).toBeGreaterThanOrEqual(1)
    }
  })

  it('resolves known ids and falls back to default', () => {
    expect(resolveDifficultyId('s4-d5')).toBe('s4-d5')
    expect(resolveDifficultyId('missing')).toBe(DEFAULT_DIFFICULTY_ID)
    expect(resolveDifficultyId(null)).toBe(DEFAULT_DIFFICULTY_ID)
    expect(resolveDifficultyId(42)).toBe(DEFAULT_DIFFICULTY_ID)
  })

  it('getDifficulty returns the matching preset', () => {
    expect(getDifficulty('s8-d8')).toMatchObject({
      playSkill: 8,
      playDepth: 8,
      eloDisplay: '1800 – 2100',
    })
  })

  it('formats dropdown labels with skill, depth, and elo range', () => {
    expect(formatDifficultyLabel(getDifficulty('s1-d3'))).toBe(
      'Skill 1 – 2 · Depth 3 – 4 · Elo 700 – 900',
    )
  })
})
