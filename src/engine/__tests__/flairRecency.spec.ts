import { describe, expect, it } from 'vitest'

import { buildCandidateMoves, recencyScore } from '@/engine/flair/recency'

describe('flair recency', () => {
  it('scores takebacks highest', () => {
    const recent = [{ from: 'e4', to: 'd5' }]
    const takeback = recencyScore({ from: 'c6', to: 'd5' }, recent)
    const elsewhere = recencyScore({ from: 'a7', to: 'a6' }, recent)
    expect(takeback).toBeGreaterThan(elsewhere)
    expect(takeback).toBeGreaterThanOrEqual(100)
  })

  it('always keeps takebacks in the candidate set', () => {
    const legal = [
      { from: 'a7', to: 'a6' },
      { from: 'c6', to: 'd5' },
      { from: 'g8', to: 'f6' },
    ]
    const shallow = [{ from: 'a7', to: 'a6' }]
    const recent = [{ from: 'e4', to: 'd5' }]
    const candidates = buildCandidateMoves(shallow, legal, recent, 2)
    expect(candidates.some((m) => m.from === 'c6' && m.to === 'd5')).toBe(true)
  })

  it('reserves a slot for the shallow engine move when cap is 1', () => {
    const legal = [
      { from: 'c6', to: 'd5' },
      { from: 'e4', to: 'd5' },
      { from: 'g1', to: 'f3' },
    ]
    const shallow = [{ from: 'g1', to: 'f3' }]
    const recent = [{ from: 'e7', to: 'd5' }]
    const candidates = buildCandidateMoves(shallow, legal, recent, 1)
    expect(candidates).toEqual([{ from: 'g1', to: 'f3' }])
  })
})
