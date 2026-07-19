import { describe, expect, it } from 'vitest'

import {
  effectivePlayDepth,
  maybeWeakenMove,
  pickBeginnerMove,
  pickRandomLegalMove,
  randomMoveChance,
  skipsEngineSearch,
} from '@/engine/weaken'

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** Black to move: free white queen on e1 (Re8xe1). */
const FREE_QUEEN = '4r1k1/5ppp/8/8/8/8/5PPP/4Q1K1 b - - 0 1'

/** White rook can step to a3 and hang to the black pawn on b4. */
const HANG_ROOK = '4k3/8/8/8/1p6/8/8/R3K3 w - - 0 1'


describe('weaken', () => {
  it('makes skill 0 always skip the engine and skill 6+ never randomize', () => {
    expect(skipsEngineSearch(0)).toBe(true)
    expect(skipsEngineSearch(1)).toBe(false)
    expect(randomMoveChance(0)).toBe(1)
    expect(randomMoveChance(3)).toBeCloseTo(0.5)
    expect(randomMoveChance(6)).toBe(0)
  })

  it('raises search depth so Stockfish Skill Level can fire', () => {
    expect(effectivePlayDepth(0, 1)).toBe(1)
    expect(effectivePlayDepth(8, 8)).toBe(9)
    expect(effectivePlayDepth(3, 10)).toBe(10)
  })

  it('picks a legal random move from the start position', () => {
    const move = pickRandomLegalMove(START, () => 0)
    expect(move).toEqual({ from: 'a2', to: 'a3', promotion: undefined })
  })

  it('depth-1 beginner usually refuses a free queen', () => {
    let took = 0
    for (let i = 0; i < 40; i++) {
      const move = pickBeginnerMove(FREE_QUEEN, 1)
      expect(move).not.toBeNull()
      if (move!.from === 'e8' && move!.to === 'e1') {
        took++
      }
    }
    expect(took).toBeLessThan(8)
  })

  it('depth-2 beginner usually takes a free queen', () => {
    let took = 0
    for (let i = 0; i < 40; i++) {
      const move = pickBeginnerMove(FREE_QUEEN, 2)
      if (move!.from === 'e8' && move!.to === 'e1') {
        took++
      }
    }
    expect(took).toBeGreaterThan(20)
  })

  it('depth-1 beginner often plays a hanging rook move when available', () => {
    let hung = 0
    for (let i = 0; i < 40; i++) {
      const move = pickBeginnerMove(HANG_ROOK, 1)
      if (move?.from === 'a1' && move.to === 'a3') {
        hung++
      }
    }
    expect(hung).toBeGreaterThan(15)
  })

  it('maybeWeakenMove at skill 0 ignores the engine move', () => {
    const engine = { from: 'e8', to: 'e1' as const }
    const weakened = maybeWeakenMove(FREE_QUEEN, 0, 1, engine, () => 0.99)
    expect(weakened).not.toEqual(engine)
  })
})
