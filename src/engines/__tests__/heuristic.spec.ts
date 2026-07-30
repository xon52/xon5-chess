import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_HEURISTIC_CONFIG_ID,
  getHeuristicConfig,
} from '@/engines/heuristic/configs'
import { pickHeuristicMove } from '@/engines/heuristic/picker'
import { createHeuristicPlayEngine } from '@/engines/heuristic/client'

const FREE_QUEEN = '4k3/8/8/8/8/8/8/3QK3 w - - 0 1'
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('heuristic engine', () => {
  it('exposes beginner and novice configs', () => {
    expect(DEFAULT_HEURISTIC_CONFIG_ID).toBe('beginner')
    expect(getHeuristicConfig('novice').depth).toBe(2)
  })

  it('playSearch returns a move', async () => {
    const eng = createHeuristicPlayEngine()
    const m = await eng.playSearch({ fen: START, configId: 'beginner' })
    expect(m).not.toBeNull()
  })

  it('returns a move for beginner and novice depths', () => {
    expect(pickHeuristicMove(START, 1, () => 0)).not.toBeNull()
    expect(pickHeuristicMove(START, 2, () => 0)).not.toBeNull()
    expect(pickHeuristicMove(FREE_QUEEN, 1, () => 0)).not.toBeNull()
  })
})
