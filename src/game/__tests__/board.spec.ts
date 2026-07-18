import { describe, expect, it } from 'vitest'
import { Chess } from 'chess.js'

import {
  buildLegalDests,
  canUndo,
  getLastMove,
  isPromotionMove,
} from '@/game/board'

const load = (fen: string) => {
  const chess = new Chess()
  chess.load(fen)
  return chess
}

describe('buildLegalDests', () => {
  it('maps from-squares to legal destinations at the start', () => {
    const dests = buildLegalDests(new Chess())
    expect(dests.get('e2')).toEqual(expect.arrayContaining(['e3', 'e4']))
    expect(dests.get('e7')).toBeUndefined()
  })
})

describe('getLastMove', () => {
  it('is undefined before any ply', () => {
    expect(getLastMove(new Chess())).toBeUndefined()
  })

  it('returns the last from/to squares', () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    expect(getLastMove(chess)).toEqual(['e7', 'e5'])
  })
})

describe('isPromotionMove', () => {
  it('detects white, black, and capture promotions', () => {
    expect(isPromotionMove(load('8/P7/8/8/8/8/8/4K2k w - - 0 1'), 'a7', 'a8')).toBe(true)
    expect(isPromotionMove(load('4K2k/8/8/8/8/8/p7/8 b - - 0 1'), 'a2', 'a1')).toBe(true)
    expect(isPromotionMove(load('r1r5/1P6/8/8/8/8/8/4K2k w - - 0 1'), 'b7', 'a8')).toBe(true)
    expect(isPromotionMove(load('r1r5/1P6/8/8/8/8/8/4K2k w - - 0 1'), 'b7', 'c8')).toBe(true)
  })

  it('is false for non-promoting moves', () => {
    const start = new Chess()
    expect(isPromotionMove(start, 'e2', 'e4')).toBe(false)
    expect(isPromotionMove(start, 'g1', 'f3')).toBe(false)

    // Knight on g7 can go to h5/f5/e6/e8 — not a promotion even toward rank 8.
    const knight = load('8/6N1/8/8/8/8/8/4K2k w - - 0 1')
    expect(isPromotionMove(knight, 'g7', 'e8')).toBe(false)
    expect(isPromotionMove(knight, 'g7', 'h5')).toBe(false)
  })
})

describe('canUndo', () => {
  it('is false with no human color', () => {
    expect(canUndo(null, 5)).toBe(false)
  })

  it('requires ≥1 ply as White and ≥2 plies as Black', () => {
    expect(canUndo('w', 0)).toBe(false)
    expect(canUndo('w', 1)).toBe(true)
    expect(canUndo('b', 1)).toBe(false)
    expect(canUndo('b', 2)).toBe(true)
  })
})
