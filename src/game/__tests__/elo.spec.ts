import { describe, expect, it } from 'vitest'

import { ELO_DEFAULT, ELO_MAX, ELO_MIN, ELO_STEP, snapElo } from '@/game/elo'

describe('snapElo', () => {
  it('clamps to the product Elo bounds', () => {
    expect(snapElo(ELO_MIN - 100)).toBe(ELO_MIN)
    expect(snapElo(ELO_MAX + 100)).toBe(ELO_MAX)
  })

  it('snaps to the Elo step grid', () => {
    expect(snapElo(1510)).toBe(1500)
    expect(snapElo(1524)).toBe(1500)
    expect(snapElo(1525)).toBe(1550)
    expect(snapElo(ELO_DEFAULT)).toBe(ELO_DEFAULT)
  })

  it('keeps exact step values', () => {
    for (let elo = ELO_MIN; elo <= ELO_MAX; elo += ELO_STEP) {
      expect(snapElo(elo)).toBe(elo)
    }
  })
})
