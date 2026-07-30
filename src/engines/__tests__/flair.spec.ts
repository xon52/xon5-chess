import { describe, expect, it } from 'vitest'

import { classifyLines } from '@/engines/flair/classify'
import { clampFlairMultipvCap, FLAIR_MIN_MULTIPV_CAP } from '@/engines/flair/configs'
import { sampleClassifiedMove } from '@/engines/flair/sample'
import type { MultipvScoredLine } from '@/engines/shared/uci'

const line = (
  from: string,
  to: string,
  score: MultipvScoredLine['score'],
): MultipvScoredLine => ({
  move: { from, to },
  score,
})

describe('flair classify', () => {
  it('buckets by STM swing vs root and marks brilliant on large gap', () => {
    const result = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 200 }),
      line('d2', 'd4', { kind: 'cp', value: 20 }),
      line('g1', 'f3', { kind: 'cp', value: -10 }),
      line('a2', 'a3', { kind: 'cp', value: -120 }),
      line('h2', 'h4', { kind: 'cp', value: -250 }),
    ])
    expect(result).not.toBeNull()
    expect(result!.brilliantGapCp).toBe(180)
    expect(result!.lines.map((l) => l.swingCp)).toEqual([0, -180, -210, -320, -450])
    expect(result!.lines.map((l) => l.quality)).toEqual([
      'brilliant',
      'mistake',
      'mistake',
      'blunder',
      'blunder',
    ])
  })

  it('splits the old normal band into good and poor', () => {
    const result = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 0 }),
      line('d2', 'd4', { kind: 'cp', value: -40 }),
      line('c2', 'c4', { kind: 'cp', value: -70 }),
    ])
    expect(result!.lines.map((l) => l.quality)).toEqual(['great', 'good', 'poor'])
  })

  it('uses great/good/poor when best gap is small', () => {
    const result = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 40 }),
      line('d2', 'd4', { kind: 'cp', value: 30 }),
      line('c2', 'c4', { kind: 'cp', value: -20 }),
    ])
    // swings: 0, -10, -60 → great, great, poor (-60 is below goodMin -55)
    expect(result!.lines.map((l) => l.quality)).toEqual(['great', 'great', 'poor'])
  })

  it('treats missed mate as a huge negative swing', () => {
    const result = classifyLines([
      line('e2', 'e4', { kind: 'mate', value: 2 }),
      line('d2', 'd4', { kind: 'cp', value: 50 }),
    ])
    expect(result!.lines[1]!.swingCp).toBeLessThan(-50_000)
    expect(result!.lines[1]!.quality).toBe('blunder')
  })
})

describe('flair sample', () => {
  it('renormalizes to available buckets and picks with rng', () => {
    const classified = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 0 }),
      line('d2', 'd4', { kind: 'cp', value: -100 }),
    ])!
    // Only great (root, small/no gap) and mistake (-100) under -300 blunder floor.
    expect(classified.buckets.great.length).toBe(1)
    expect(classified.buckets.mistake.length).toBe(1)
    expect(classified.buckets.blunder.length).toBe(0)

    const weights = { brilliant: 1, great: 59, good: 0, poor: 0, mistake: 20, blunder: 10 }
    // Waterfall: brilliant empty → great first. pStop=59/79≈0.75; rng 0.8 falls to mistake.
    const picked = sampleClassifiedMove(classified, weights, { rng: () => 0.8 })
    expect(picked).not.toBeNull()
    expect(picked!.quality).toBe('mistake')
    expect(picked!.move).toEqual({ from: 'd2', to: 'd4' })
    expect(picked!.activeWeights).toEqual({ great: 59, mistake: 20 })
  })

  it('falls back to multipv 1 when weights are all zero', () => {
    const classified = classifyLines([line('e2', 'e4', { kind: 'cp', value: 0 })])!
    const picked = sampleClassifiedMove(
      classified,
      { brilliant: 0, great: 0, good: 0, poor: 0, mistake: 0, blunder: 0 },
      { rng: () => 0 },
    )
    expect(picked!.fallback).toBe(true)
    expect(picked!.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('picks the least-bad move inside a blunder bucket', () => {
    const classified = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 0 }),
      line('a2', 'a3', { kind: 'cp', value: -400 }),
      line('h2', 'h4', { kind: 'cp', value: -900 }),
    ])!
    expect(classified.buckets.blunder.map((l) => l.move.from + l.move.to)).toEqual([
      'a2a3',
      'h2h4',
    ])
    // Waterfall: great pStop=10/100=0.1; rng 0.5 falls through → blunder.
    const picked = sampleClassifiedMove(
      classified,
      { brilliant: 0, great: 10, good: 0, poor: 0, mistake: 0, blunder: 90 },
      { rng: () => 0.5 },
    )
    expect(picked!.quality).toBe('blunder')
    expect(picked!.move).toEqual({ from: 'a2', to: 'a3' })
  })

  it('takes brilliant when present and rng stops there', () => {
    const classified = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 200 }),
      line('d2', 'd4', { kind: 'cp', value: 20 }),
    ])!
    expect(classified.buckets.brilliant.length).toBe(1)
    const picked = sampleClassifiedMove(
      classified,
      { brilliant: 40, great: 50, good: 10, poor: 0, mistake: 0, blunder: 0 },
      { rng: () => 0.1 },
    )
    expect(picked!.quality).toBe('brilliant')
    expect(picked!.move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('falls from missing brilliant to great instead of dumping into mistake', () => {
    // Small gap → root is great, not brilliant; blunder line also present.
    const classified = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 0 }),
      line('d2', 'd4', { kind: 'cp', value: -10 }),
      line('a2', 'a3', { kind: 'cp', value: -400 }),
    ])!
    expect(classified.buckets.brilliant.length).toBe(0)
    expect(classified.buckets.great.length).toBeGreaterThan(0)
    // Brilliant weight ignored (empty). First tier great: only great+blunder left;
    // pStop = 80/(80+20)=0.8 — use rng 0 so we always stop on great.
    const picked = sampleClassifiedMove(
      classified,
      { brilliant: 50, great: 80, good: 0, poor: 0, mistake: 0, blunder: 20 },
      { rng: () => 0 },
    )
    expect(picked!.quality).toBe('great')
    expect(picked!.renormalized).toBe(true)
  })

  it('preferBest picks highest swing in the rolled bucket', () => {
    const classified = classifyLines([
      line('e2', 'e4', { kind: 'cp', value: 40 }),
      line('d2', 'd4', { kind: 'cp', value: 30 }),
      line('a2', 'a3', { kind: 'cp', value: -200 }),
    ])!
    // Both e4 and d4 are great (swings 0 and -10); without preferBest, uniform.
    const picked = sampleClassifiedMove(
      classified,
      { brilliant: 0, great: 100, good: 0, poor: 0, mistake: 0, blunder: 0 },
      { preferBest: true, rng: () => 0.99 },
    )
    expect(picked!.move).toEqual({ from: 'e2', to: 'e4' })
  })
})

describe('flair multipv floor', () => {
  it('clamps below FLAIR_MIN_MULTIPV_CAP up to legal count', () => {
    expect(clampFlairMultipvCap(1, 20)).toBe(FLAIR_MIN_MULTIPV_CAP)
    expect(clampFlairMultipvCap(2, 20)).toBe(FLAIR_MIN_MULTIPV_CAP)
    expect(clampFlairMultipvCap(6, 20)).toBe(6)
    expect(clampFlairMultipvCap(6, 2)).toBe(2)
  })
})
