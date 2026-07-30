import { describe, expect, it } from 'vitest'

import {
  DIFFICULTY_OPTIONS,
  DEFAULT_DIFFICULTY_ID,
  resolveDifficultyId,
} from '@/engine'

describe('engine difficulty options', () => {
  it('exposes Flair difficulty options with beginner default', () => {
    expect(DIFFICULTY_OPTIONS.map((c) => c.id)).toEqual([
      'beginner',
      'novice',
      'club',
      'solid',
      'expert',
      'master',
      'grandmaster',
    ])
    expect(DEFAULT_DIFFICULTY_ID).toBe('beginner')
  })

  it('resolveDifficultyId accepts Flair ids and falls back otherwise', () => {
    expect(resolveDifficultyId('club')).toBe('club')
    expect(resolveDifficultyId('level-5')).toBe('beginner')
    expect(resolveDifficultyId('nope')).toBe('beginner')
    expect(resolveDifficultyId(null)).toBe('beginner')
  })
})
