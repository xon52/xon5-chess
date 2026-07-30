import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import {
  getFlairMatchLog,
  printFlairMatchStats,
  recordFlairMove,
  resetFlairMatchLog,
} from '@/engine/flair/log'

describe('flair match log stats', () => {
  beforeEach(() => {
    resetFlairMatchLog()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetFlairMatchLog()
  })

  it('prints early/mid/end counts for human and computer', () => {
    const qualities = ['great', 'good', 'poor', 'mistake', 'blunder', 'poor'] as const
    for (const q of qualities) {
      recordFlairMove({ side: 'human', quality: q, move: 'e2e4', swingCp: -10 })
      recordFlairMove({ side: 'computer', quality: q, move: 'e7e5', swingCp: -20 })
    }

    printFlairMatchStats()
    expect(console.log).toHaveBeenCalledWith(
      '[flair] match stats',
      expect.objectContaining({
        human: expect.objectContaining({
          totalSampled: 6,
          early: expect.objectContaining({ total: 2 }),
          mid: expect.objectContaining({ total: 2 }),
          end: expect.objectContaining({ total: 2 }),
        }),
        computer: expect.objectContaining({
          totalSampled: 6,
        }),
      }),
    )
    // Idempotent
    printFlairMatchStats()
    const statsCalls = vi.mocked(console.log).mock.calls.filter((c) => c[0] === '[flair] match stats')
    expect(statsCalls).toHaveLength(1)
    expect(getFlairMatchLog()).toHaveLength(12)
  })
})
