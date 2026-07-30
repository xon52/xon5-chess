import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFlairPlayEngine } from '@/engines/flair/client'
import { resetFlairMatchLog } from '@/engines/flair/log'
import { getStockfishInternal, setStockfishInternal } from '@/engines/stockfish/client'
import type { MultipvScoredLine, UciMove } from '@/engines/shared/uci'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('flair play engine', () => {
  beforeEach(() => {
    resetFlairMatchLog()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    setStockfishInternal({
      playSearchRaw: vi.fn(async () => null),
      flairSearchRaw: vi.fn(async () => []),
      evalSearch: vi.fn(async () => null),
      notifyNewGame: vi.fn(),
      stop: vi.fn(),
      stopAndDrain: vi.fn(async () => {}),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setStockfishInternal(null)
    resetFlairMatchLog()
  })

  it('shallow candidates then deep scores with searchmoves', async () => {
    const lines: MultipvScoredLine[] = [
      { move: { from: 'e2', to: 'e4' }, score: { kind: 'cp', value: 40 } },
      { move: { from: 'a2', to: 'a3' }, score: { kind: 'cp', value: -100 } },
    ]
    const flairSearchRaw = vi.fn(async () => lines)
    setStockfishInternal({
      playSearchRaw: vi.fn(async () => null),
      flairSearchRaw,
      evalSearch: vi.fn(async () => null),
      notifyNewGame: vi.fn(),
      stop: vi.fn(),
      stopAndDrain: vi.fn(async () => {}),
    })

    const rng = vi.spyOn(Math, 'random').mockReturnValue(0.8)
    const eng = createFlairPlayEngine()
    const move = await eng.playSearch({ fen: START_FEN, configId: 'beginner' })
    rng.mockRestore()

    expect(flairSearchRaw).toHaveBeenCalledTimes(2)
    expect(flairSearchRaw.mock.calls[0]![0]).toEqual({
      fen: START_FEN,
      depth: 1,
      multipv: 6,
    })
    expect(flairSearchRaw.mock.calls[1]![0]).toMatchObject({
      fen: START_FEN,
      depth: 8,
      multipv: expect.any(Number),
      searchmoves: expect.arrayContaining(['e2e4', 'a2a3']),
    })
    expect(move).toEqual({ from: 'a2', to: 'a3' } satisfies UciMove)
  })

  it('delegates lifecycle to stockfish internal', () => {
    const internal = getStockfishInternal()
    const eng = createFlairPlayEngine()
    eng.notifyNewGame()
    eng.stop()
    void eng.stopAndDrain()
    expect(internal.notifyNewGame).toHaveBeenCalled()
    expect(internal.stop).toHaveBeenCalled()
    expect(internal.stopAndDrain).toHaveBeenCalled()
  })
})
