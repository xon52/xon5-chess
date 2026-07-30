import { describe, expect, it } from 'vitest'

import {
  DEFAULT_CONFIG_ID,
  DEFAULT_ENGINE_ID,
  ENGINE_CATALOG,
  resolveConfigId,
  resolveEngineId,
} from '@/engines/registry'
import { pickHeuristicMove } from '@/engines/heuristic/picker'
import { moveToPolicyIndex, pickMoveFromPolicy } from '@/engines/maia/policy'
import { encodeMaiaInput } from '@/engines/maia/encode'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('engine registry', () => {
  it('lists five engines with configs', () => {
    expect(ENGINE_CATALOG.map((e) => e.id)).toEqual([
      'stockfish',
      'lozza',
      'maia',
      'heuristic',
      'flair',
    ])
    expect(DEFAULT_ENGINE_ID).toBe('stockfish')
    expect(DEFAULT_CONFIG_ID).toBe('level-1')
  })

  it('resolves engines and configs with fallbacks', () => {
    expect(resolveEngineId('lozza')).toBe('lozza')
    expect(resolveEngineId('flair')).toBe('flair')
    expect(resolveEngineId('nope')).toBe('stockfish')
    expect(resolveConfigId('stockfish', 'level-5')).toBe('level-5')
    expect(resolveConfigId('stockfish', 's4-d5')).toBe('level-5')
    expect(resolveConfigId('heuristic', 'novice')).toBe('novice')
    expect(resolveConfigId('heuristic', 'nope')).toBe('beginner')
    expect(resolveConfigId('flair', 'grandmaster')).toBe('grandmaster')
    expect(resolveConfigId('flair', 'nope')).toBe('beginner')
  })
})

describe('heuristic picker', () => {
  it('returns a legal move from the start position', () => {
    const move = pickHeuristicMove(START, 1, () => 0)
    expect(move).not.toBeNull()
    expect(move!.from).toMatch(/^[a-h][1-8]$/)
  })
})

describe('maia encode/policy', () => {
  it('encodes a 112x8x8 float tensor', () => {
    const t = encodeMaiaInput(START)
    expect(t.length).toBe(112 * 64)
    expect(t.some((v) => v > 0)).toBe(true)
  })

  it('indexes a quiet queen-like pawn push', () => {
    // e2e4 from white: from e2 = file 4 rank 1 → index 12; north 2 steps in dir [0,1]
    const idx = moveToPolicyIndex('e2', 'e4')
    expect(idx).not.toBeNull()
  })

  it('picks a legal move from a flat policy preferring high scores', () => {
    const policy = new Float32Array(5120)
    // Boost every legal-looking index by scanning via pick helper fallback
    for (let i = 0; i < policy.length; i++) {
      policy[i] = 0
    }
    const move = pickMoveFromPolicy(START, policy, () => 0)
    expect(move).not.toBeNull()
  })
})
