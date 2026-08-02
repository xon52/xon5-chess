import { describe, expect, it } from 'vitest'

import {
  randomThinkTargetMs,
  remainingThinkPadMs,
} from '@/game/thinkDelay'

describe('thinkDelay', () => {
  it('randomThinkTargetMs stays in range', () => {
    expect(randomThinkTargetMs(500, 1500, () => 0)).toBe(500)
    expect(randomThinkTargetMs(500, 1500, () => 0.5)).toBe(1000)
    expect(randomThinkTargetMs(500, 1500, () => 0.999)).toBeGreaterThanOrEqual(1499)
    expect(randomThinkTargetMs(500, 1500, () => 0.999)).toBeLessThanOrEqual(1500)
  })

  it('remainingThinkPadMs clamps at zero', () => {
    expect(remainingThinkPadMs(200, 1000)).toBe(800)
    expect(remainingThinkPadMs(1200, 1000)).toBe(0)
  })
})
