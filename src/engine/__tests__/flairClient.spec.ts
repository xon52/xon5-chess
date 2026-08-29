import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createChessEngine } from '@/engine/createChessEngine'
import { resetFlairMatchLog } from '@/engine/flair/log'
import type { StockfishBackend } from '@/engine/stockfish/backend'
import type { MultipvScoredLine, UciMove } from '@/engine/uci'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const stubBackend = (partial: Partial<StockfishBackend> = {}): StockfishBackend => ({
  multipvSearch: partial.multipvSearch ?? vi.fn(async () => []),
  evalSearch: partial.evalSearch ?? vi.fn(async () => null),
  notifyNewGame: partial.notifyNewGame ?? vi.fn(),
  stop: partial.stop ?? vi.fn(),
  stopAndDrain: partial.stopAndDrain ?? vi.fn(async () => {}),
})

describe('chess engine play', () => {
  beforeEach(() => {
    resetFlairMatchLog()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    resetFlairMatchLog()
  })

  it('shallow candidates then deep scores with searchmoves', async () => {
    const lines: MultipvScoredLine[] = [
      { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
      { move: { from: 'a2', to: 'a3' }, score: { kind: 'cp', value: -100 } },
    ]
    const multipvSearch = vi.fn(async () => lines)
    const backend = stubBackend({ multipvSearch })
    const eng = createChessEngine(backend)

    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const move = await eng.playSearch({ fen: START_FEN, difficultyId: 'beginner' })
    rng.mockRestore()

    expect(multipvSearch).toHaveBeenCalledTimes(2)
    expect(multipvSearch.mock.calls[0]![0]).toEqual({
      fen: START_FEN,
      depth: 1,
      multipv: 6,
    })
    expect(multipvSearch.mock.calls[1]![0]).toMatchObject({
      fen: START_FEN,
      depth: 8,
      multipv: expect.any(Number),
      searchmoves: expect.arrayContaining(['e2e4', 'a2a3']),
    })
    expect(move).toEqual({ from: 'a2', to: 'a3' } satisfies UciMove)
  })

  it('uses opening book when safe replies exist (skips Flair sample)', async () => {
    const multipvSearch = vi
      .fn()
      // book: unrestricted best
      .mockResolvedValueOnce([
        { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
      ])
      // book: scored candidates
      .mockResolvedValueOnce([
        { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
        { move: { from: 'd2', to: 'd4' }, score: { kind: 'cp', value: 20 } },
      ])

    const backend = stubBackend({ multipvSearch })
    const eng = createChessEngine(backend)
    const rng = vi.spyOn(Math, 'random').mockReturnValue(0)
    const move = await eng.playSearch({
      fen: START_FEN,
      difficultyId: 'novice',
    })
    rng.mockRestore()

    // Only the two book safety searches — no Flair shallow/deep.
    expect(multipvSearch).toHaveBeenCalledTimes(2)
    expect(move).toEqual({ from: 'e2', to: 'e4' })
  })

  it('delegates lifecycle to stockfish backend', () => {
    const backend = stubBackend()
    const eng = createChessEngine(backend)
    eng.notifyNewGame()
    eng.stop()
    void eng.stopAndDrain()
    expect(backend.notifyNewGame).toHaveBeenCalled()
    expect(backend.stop).toHaveBeenCalled()
    expect(backend.stopAndDrain).toHaveBeenCalled()
  })
})
