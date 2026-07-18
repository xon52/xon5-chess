import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_POSITION } from 'chess.js'

import { setEngineClient, type EngineClient } from '@/engine/stockfishClient'
import type { UciMove, UciScore } from '@/engine/uci'
import { useGameStore } from '../game'

const installEngineMock = (partial: Partial<EngineClient> = {}) => {
  const mock: EngineClient = {
    playSearch: vi.fn(async () => null),
    evalSearch: vi.fn(async () => null),
    notifyNewGame: vi.fn(),
    stop: vi.fn(),
    stopAndDrain: vi.fn(async () => {}),
    ...partial,
  }
  if (!partial.stopAndDrain) {
    mock.stopAndDrain = vi.fn(async () => {
      mock.stop()
    })
  }
  setEngineClient(mock)
  return mock
}

describe('useGameStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installEngineMock()
  })

  afterEach(() => {
    setEngineClient({
      playSearch: async () => null,
      evalSearch: async () => null,
      notifyNewGame: () => {},
      stop: () => {},
      stopAndDrain: async () => {},
    })
  })

  const startAsWhite = (store = useGameStore()) => {
    store.newGame({ color: 'w', elo: 1200 })
    return store
  }

  /** Human ply then engine (opponent) ply for tests that need both sides. */
  const playHumanThenEngine = (
    store: ReturnType<typeof useGameStore>,
    human: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' },
    engine: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' },
  ) => {
    expect(store.tryMove(human).ok).toBe(true)
    expect(store.applyEngineMove(engine).ok).toBe(true)
  }

  it('starts gated: no color, locked board, tryMove rejected', () => {
    const store = useGameStore()

    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.humanColor).toBeNull()
    expect(store.isHumanTurn).toBe(false)
    expect(store.orientation).toBe('white')
    expect(store.legalDests.size).toBe(0)
    expect(store.tryMove({ from: 'e2', to: 'e4' })).toEqual({ ok: false })
  })

  it('reset returns to the start gate', () => {
    const store = startAsWhite()
    store.tryMove({ from: 'e2', to: 'e4' })
    store.reset()

    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.humanColor).toBeNull()
    expect(store.isHumanTurn).toBe(false)
    expect(store.history).toEqual([])
  })

  it('newGame as White unlocks the human turn', () => {
    const store = useGameStore()
    store.newGame({ color: 'w', elo: 1200 })

    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.humanColor).toBe('w')
    expect(store.elo).toBe(1200)
    expect(store.isHumanTurn).toBe(true)
    expect(store.orientation).toBe('white')
    expect(store.history).toEqual([])
    expect(store.legalDests.get('e2')).toEqual(expect.arrayContaining(['e3', 'e4']))
  })

  it('newGame stores snapped Elo for play strength', () => {
    const store = useGameStore()
    store.newGame({ color: 'w', elo: 1510 })
    expect(store.elo).toBe(1500)

    store.reset()
    expect(store.humanColor).toBeNull()
    expect(store.elo).toBe(1500)
  })

  it('newGame as Black locks the board on White to move', () => {
    const store = useGameStore()
    store.newGame({ color: 'b', elo: 1200 })

    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.turn).toBe('w')
    expect(store.humanColor).toBe('b')
    expect(store.isHumanTurn).toBe(false)
    expect(store.orientation).toBe('black')
    expect(store.legalDests.size).toBe(0)
    expect(store.tryMove({ from: 'e2', to: 'e4' })).toEqual({ ok: false })
  })

  it('rejects Black tryMove after a White human ply', () => {
    const store = startAsWhite()

    expect(store.tryMove({ from: 'e2', to: 'e4' })).toEqual({ ok: true, san: 'e4' })
    expect(store.isHumanTurn).toBe(false)
    expect(store.tryMove({ from: 'e7', to: 'e5' })).toEqual({ ok: false })
    expect(store.history).toEqual(['e4'])
  })

  it('updates lastMove and clears legalDests after checkmate', () => {
    const store = startAsWhite()

    playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })
    expect(store.lastMove).toEqual(['e7', 'e5'])

    playHumanThenEngine(store, { from: 'f1', to: 'c4' }, { from: 'b8', to: 'c6' })
    playHumanThenEngine(store, { from: 'd1', to: 'h5' }, { from: 'g8', to: 'f6' })
    expect(store.tryMove({ from: 'h5', to: 'f7' })).toEqual({ ok: true, san: 'Qxf7#' })

    expect(store.status).toEqual({ kind: 'checkmate', winner: 'w' })
    expect(store.lastMove).toEqual(['h5', 'f7'])
    expect(store.legalDests.size).toBe(0)
  })

  it('rejects illegal moves without changing the position', () => {
    const store = startAsWhite()
    const startFen = store.fen

    const result = store.tryMove({ from: 'e2', to: 'e5' })

    expect(result).toEqual({ ok: false })
    expect(store.fen).toBe(startFen)
    expect(store.history).toEqual([])
    expect(store.status).toEqual({ kind: 'playing' })
  })

  it('appends SAN for legal human and engine moves', () => {
    const store = startAsWhite()

    expect(store.tryMove({ from: 'e2', to: 'e4' })).toEqual({ ok: true, san: 'e4' })
    expect(store.applyEngineMove({ from: 'e7', to: 'e5' })).toEqual({ ok: true, san: 'e5' })

    expect(store.history).toEqual(['e4', 'e5'])
    expect(store.turn).toBe('w')
    expect(store.isHumanTurn).toBe(true)
  })

  it('detects checkmate (Scholar’s mate)', () => {
    const store = startAsWhite()

    playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })
    playHumanThenEngine(store, { from: 'f1', to: 'c4' }, { from: 'b8', to: 'c6' })
    playHumanThenEngine(store, { from: 'd1', to: 'h5' }, { from: 'g8', to: 'f6' })
    const mate = store.tryMove({ from: 'h5', to: 'f7' })

    expect(mate).toEqual({ ok: true, san: 'Qxf7#' })
    expect(store.status).toEqual({ kind: 'checkmate', winner: 'w' })
    expect(store.turn).toBe('b')
  })

  it('detects fifty-move draw and refuses further moves', () => {
    const store = startAsWhite()
    // Halfmove clock at 100 claims the draw while legal moves still exist.
    expect(
      store.loadFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 1'),
    ).toBe(true)
    expect(store.status).toEqual({ kind: 'draw', reason: 'fifty-move' })

    const fen = store.fen
    expect(store.tryMove({ from: 'e2', to: 'e4' })).toEqual({ ok: false })
    expect(store.fen).toBe(fen)
    expect(store.status).toEqual({ kind: 'draw', reason: 'fifty-move' })
  })

  it('detects threefold repetition and refuses further moves', () => {
    const store = startAsWhite()
    // Two full knight out-and-back cycles return to the start position a third time.
    const sequence: Array<{ from: string; to: string }> = [
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
    ]

    for (let i = 0; i < sequence.length; i += 2) {
      playHumanThenEngine(store, sequence[i]!, sequence[i + 1]!)
    }

    expect(store.status).toEqual({ kind: 'draw', reason: 'threefold' })

    const fen = store.fen
    expect(store.tryMove({ from: 'g1', to: 'f3' })).toEqual({ ok: false })
    expect(store.fen).toBe(fen)
    expect(store.status).toEqual({ kind: 'draw', reason: 'threefold' })
  })

  it('applies promotion to SAN', () => {
    const store = startAsWhite()
    expect(store.loadFen('8/P7/8/8/8/8/8/4K2k w - - 0 1')).toBe(true)

    const result = store.tryMove({ from: 'a7', to: 'a8', promotion: 'n' })

    expect(result).toEqual({ ok: true, san: 'a8=N' })
    expect(store.history).toEqual(['a8=N'])
    expect(store.fen.startsWith('N7/')).toBe(true)
  })

  it('undo restores prior FEN and pops SAN; undo at start is a no-op', () => {
    const store = startAsWhite()
    const startFen = store.fen

    expect(store.undoPly()).toBe(false)
    expect(store.fen).toBe(startFen)

    playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })
    const afterTwo = store.fen

    expect(store.undoPly()).toBe(true)
    expect(store.history).toEqual(['e4'])
    expect(store.turn).toBe('b')

    expect(store.undoPlies(1)).toBe(1)
    expect(store.fen).toBe(startFen)
    expect(store.history).toEqual([])

    playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })
    expect(store.fen).toBe(afterTwo)
    store.reset()
    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.humanColor).toBeNull()
    expect(store.history).toEqual([])
    expect(store.status).toEqual({ kind: 'playing' })
  })

  it('newGame with color replaces an in-progress game', () => {
    const store = startAsWhite()
    store.tryMove({ from: 'd2', to: 'd4' })
    store.newGame({ color: 'w', elo: 1500 })
    expect(store.fen).toBe(DEFAULT_POSITION)
    expect(store.turn).toBe('w')
    expect(store.history).toEqual([])
    expect(store.humanColor).toBe('w')
    expect(store.elo).toBe(1500)
    expect(store.isHumanTurn).toBe(true)
  })

  it('drives a multi-ply game consistently without a board', () => {
    const store = startAsWhite()
    const moves: Array<{ from: string; to: string }> = [
      { from: 'e2', to: 'e4' },
      { from: 'c7', to: 'c5' },
      { from: 'g1', to: 'f3' },
      { from: 'd7', to: 'd6' },
      { from: 'd2', to: 'd4' },
      { from: 'c5', to: 'd4' },
      { from: 'f3', to: 'd4' },
      { from: 'g8', to: 'f6' },
    ]

    for (let i = 0; i < moves.length; i += 2) {
      playHumanThenEngine(store, moves[i]!, moves[i + 1]!)
    }

    expect(store.history).toHaveLength(8)
    expect(store.history).toEqual(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6'])
    expect(store.turn).toBe('w')
    expect(store.status).toEqual({ kind: 'playing' })
    expect(store.fen).toContain(' w ')

    expect(store.undoPlies(2)).toBe(2)
    expect(store.history).toEqual(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4'])
    expect(store.turn).toBe('w')
    expect(store.status).toEqual({ kind: 'playing' })
  })

  describe('undoUntilHumanTurn / canUndo', () => {
    it('disables undo at White start and does not mutate on failed undo', () => {
      const store = startAsWhite()
      const fen = store.fen

      expect(store.canUndo).toBe(false)
      expect(store.undoUntilHumanTurn()).toBe(false)
      expect(store.fen).toBe(fen)
      expect(store.history).toEqual([])
      expect(store.turn).toBe('w')
    })

    it('full exchange as White undoes to start with human to move', () => {
      const store = startAsWhite()
      playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })

      expect(store.canUndo).toBe(true)
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(store.history).toEqual([])
      expect(store.turn).toBe('w')
      expect(store.isHumanTurn).toBe(true)
    })

    it('human move without engine reply undoes one ply', () => {
      const store = startAsWhite()
      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.turn).toBe('b')
      expect(store.isHumanTurn).toBe(false)

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.history).toEqual([])
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(store.isHumanTurn).toBe(true)
    })

    it('engine-delivered mate undoes to human turn and clears terminal', () => {
      const store = startAsWhite()
      // Fool's mate: White f3, Black e5, White g4, Black Qh4#.
      playHumanThenEngine(store, { from: 'f2', to: 'f3' }, { from: 'e7', to: 'e5' })
      playHumanThenEngine(store, { from: 'g2', to: 'g4' }, { from: 'd8', to: 'h4' })

      expect(store.status).toEqual({ kind: 'checkmate', winner: 'b' })
      expect(store.isHumanTurn).toBe(false)
      expect(store.canUndo).toBe(true)

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.status).toEqual({ kind: 'playing' })
      expect(store.isHumanTurn).toBe(true)
      expect(store.turn).toBe('w')
      expect(store.history).toEqual(['f3', 'e5'])
    })

    it('human-delivered mate undoes to human turn and clears terminal', () => {
      const store = startAsWhite()
      // Scholar's mate pattern truncated to Qxf7#.
      playHumanThenEngine(store, { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' })
      playHumanThenEngine(store, { from: 'f1', to: 'c4' }, { from: 'b8', to: 'c6' })
      playHumanThenEngine(store, { from: 'd1', to: 'h5' }, { from: 'g8', to: 'f6' })
      expect(store.tryMove({ from: 'h5', to: 'f7' }).ok).toBe(true)

      expect(store.status).toEqual({ kind: 'checkmate', winner: 'w' })
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.status).toEqual({ kind: 'playing' })
      expect(store.isHumanTurn).toBe(true)
      expect(store.turn).toBe('w')
      expect(store.history).toEqual(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'])
    })

    it('stalemate undoes to human turn and clears draw', () => {
      const store = startAsWhite()
      // One move from stalemate: Queen to f7 leaves Black king with no legal moves.
      expect(store.loadFen('7k/8/5QK1/8/8/8/8/8 w - - 0 1')).toBe(true)
      expect(store.tryMove({ from: 'f6', to: 'f7' }).ok).toBe(true)
      expect(store.status).toEqual({ kind: 'draw', reason: 'stalemate' })

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.status).toEqual({ kind: 'playing' })
      expect(store.isHumanTurn).toBe(true)
      expect(store.turn).toBe('w')
      expect(store.history).toEqual([])
    })

    it('Black opening engine ply alone: canUndo false and no mutation', () => {
      const store = useGameStore()
      store.newGame({ color: 'b', elo: 1200 })
      expect(store.applyEngineMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      const fen = store.fen

      expect(store.history).toEqual(['e4'])
      expect(store.canUndo).toBe(false)
      expect(store.undoUntilHumanTurn()).toBe(false)
      expect(store.fen).toBe(fen)
      expect(store.history).toEqual(['e4'])
      expect(store.turn).toBe('b')
    })

    it('Black after human move undoes until Black to move', () => {
      const store = useGameStore()
      store.newGame({ color: 'b', elo: 1200 })
      expect(store.applyEngineMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.tryMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      expect(store.applyEngineMove({ from: 'g1', to: 'f3' }).ok).toBe(true)

      expect(store.canUndo).toBe(true)
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.turn).toBe('b')
      expect(store.isHumanTurn).toBe(true)
      expect(store.history).toEqual(['e4'])
    })

    it('Black-delivered mate undoes to Black turn and clears terminal', () => {
      const store = useGameStore()
      store.newGame({ color: 'b', elo: 1200 })
      // Fool's mate with human as Black.
      expect(store.applyEngineMove({ from: 'f2', to: 'f3' }).ok).toBe(true)
      expect(store.tryMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      expect(store.applyEngineMove({ from: 'g2', to: 'g4' }).ok).toBe(true)
      expect(store.tryMove({ from: 'd8', to: 'h4' }).ok).toBe(true)

      expect(store.status).toEqual({ kind: 'checkmate', winner: 'b' })
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.status).toEqual({ kind: 'playing' })
      expect(store.isHumanTurn).toBe(true)
      expect(store.turn).toBe('b')
      expect(store.history).toEqual(['f3', 'e5', 'g4'])
    })
  })

  describe('M7 engine play search', () => {
    it('tryMove triggers playSearch with current FEN and store Elo', async () => {
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      const mock = installEngineMock({ playSearch })
      const store = startAsWhite()
      store.elo = 1500

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)

      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalledWith({
        fen: expect.stringContaining('4P3'),
        elo: 1500,
      })
      expect(store.history).toEqual(['e4', 'e5'])
      expect(store.engineThinking).toBe(false)
      expect(mock.notifyNewGame).toHaveBeenCalled()
    })

    it('Black newGame triggers one opening search then human turn', async () => {
      const playSearch = vi.fn(async () => ({ from: 'e2', to: 'e4' }) satisfies UciMove)
      installEngineMock({ playSearch })
      const store = useGameStore()

      store.newGame({ color: 'b', elo: 1200 })
      expect(store.isHumanTurn).toBe(false)

      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalledTimes(1)
      expect(store.history).toEqual(['e4'])
      expect(store.engineThinking).toBe(false)
    })

    it('newGame waits for drain before notifyNewGame and Black opening search', async () => {
      let resolveDrain!: () => void
      const stopAndDrain = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDrain = resolve
          }),
      )
      const notifyNewGame = vi.fn()
      const playSearch = vi.fn(async () => ({ from: 'e2', to: 'e4' }) satisfies UciMove)
      installEngineMock({ playSearch, stopAndDrain, notifyNewGame })
      const store = useGameStore()

      store.newGame({ color: 'b', elo: 1200 })
      expect(stopAndDrain).toHaveBeenCalled()
      expect(notifyNewGame).not.toHaveBeenCalled()
      expect(playSearch).not.toHaveBeenCalled()

      resolveDrain()
      await vi.waitFor(() => expect(notifyNewGame).toHaveBeenCalled())
      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalledTimes(1)
      // notify before play kickoff
      expect(notifyNewGame.mock.invocationCallOrder[0]!).toBeLessThan(
        playSearch.mock.invocationCallOrder[0]!,
      )
    })

    it('requestEngineMove is a no-op on the human’s turn', async () => {
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      installEngineMock({ playSearch })
      const store = startAsWhite()

      store.requestEngineMove()
      await Promise.resolve()

      expect(playSearch).not.toHaveBeenCalled()
      expect(store.engineThinking).toBe(false)
      expect(store.history).toEqual([])
    })

    it('reset ignores a late playSearch result', async () => {
      let resolveSearch!: (move: UciMove | null) => void
      const playSearch = vi.fn(
        () =>
          new Promise<UciMove | null>((resolve) => {
            resolveSearch = resolve
          }),
      )
      const stop = vi.fn()
      installEngineMock({ playSearch, stop })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)

      store.reset()
      expect(stop).toHaveBeenCalled()
      expect(store.engineThinking).toBe(false)
      expect(store.humanColor).toBeNull()

      resolveSearch({ from: 'e7', to: 'e5' })
      await Promise.resolve()
      await Promise.resolve()

      expect(store.history).toEqual([])
      expect(store.fen).toBe(DEFAULT_POSITION)
    })

    it('undo while play search is in flight ignores the late bestmove', async () => {
      let resolveSearch!: (move: UciMove | null) => void
      const playSearch = vi.fn(
        () =>
          new Promise<UciMove | null>((resolve) => {
            resolveSearch = resolve
          }),
      )
      const stop = vi.fn()
      const stopAndDrain = vi.fn(async () => {
        stop()
      })
      installEngineMock({ playSearch, stop, stopAndDrain })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)
      expect(store.history).toEqual(['e4'])

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(stopAndDrain).toHaveBeenCalled()
      expect(stop).toHaveBeenCalled()
      expect(store.engineThinking).toBe(false)
      expect(store.history).toEqual([])
      expect(store.isHumanTurn).toBe(true)

      const fenAfterUndo = store.fen
      resolveSearch({ from: 'e7', to: 'e5' })
      await Promise.resolve()
      await Promise.resolve()

      expect(store.fen).toBe(fenAfterUndo)
      expect(store.history).toEqual([])
    })

    it('mid-think undo then human play resumes engine reply', async () => {
      let resolveFirst!: (move: UciMove | null) => void
      const playSearch = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<UciMove | null>((resolve) => {
              resolveFirst = resolve
            }),
        )
        .mockResolvedValueOnce({ from: 'd7', to: 'd5' } satisfies UciMove)
      const stopAndDrain = vi.fn(async () => {})
      installEngineMock({ playSearch, stopAndDrain })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(stopAndDrain).toHaveBeenCalled()
      expect(store.isHumanTurn).toBe(true)
      expect(store.history).toEqual([])

      resolveFirst({ from: 'e7', to: 'e5' })
      await Promise.resolve()

      expect(store.tryMove({ from: 'd2', to: 'd4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalledTimes(2)
      expect(store.history).toEqual(['d4', 'd5'])
      expect(store.engineThinking).toBe(false)
    })

    it('Black mid-think undo cancels reply search and resumes after next move', async () => {
      let resolveReply!: (move: UciMove | null) => void
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e2', to: 'e4' } satisfies UciMove)
        .mockImplementationOnce(
          () =>
            new Promise<UciMove | null>((resolve) => {
              resolveReply = resolve
            }),
        )
        .mockResolvedValueOnce({ from: 'd2', to: 'd4' } satisfies UciMove)
      const stopAndDrain = vi.fn(async () => {})
      installEngineMock({ playSearch, stopAndDrain })
      const store = useGameStore()

      store.newGame({ color: 'b', elo: 1200 })
      await vi.waitFor(() => expect(store.history).toEqual(['e4']))
      expect(store.isHumanTurn).toBe(true)

      expect(store.tryMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)
      expect(store.history).toEqual(['e4', 'e5'])

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(stopAndDrain).toHaveBeenCalled()
      expect(store.history).toEqual(['e4'])
      expect(store.isHumanTurn).toBe(true)
      expect(store.engineThinking).toBe(false)

      resolveReply({ from: 'g1', to: 'f3' })
      await Promise.resolve()
      expect(store.history).toEqual(['e4'])

      expect(store.tryMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalledTimes(3)
      expect(store.history).toEqual(['e4', 'e5', 'd4'])
      expect(store.engineThinking).toBe(false)
    })

    it('post-exchange undo then human play resumes engine reply', async () => {
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockResolvedValueOnce({ from: 'd7', to: 'd5' } satisfies UciMove)
      installEngineMock({ playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.history.length).toBe(2))

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.history).toEqual([])
      expect(store.isHumanTurn).toBe(true)

      expect(store.tryMove({ from: 'd2', to: 'd4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(store.history).toEqual(['d4', 'd5'])
      expect(playSearch).toHaveBeenCalledTimes(2)
    })

    it('does not start playSearch after human delivers checkmate', async () => {
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      installEngineMock({ playSearch })
      const store = startAsWhite()

      // Mate in one: Qf7-f8#.
      expect(store.loadFen('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1')).toBe(true)
      expect(store.tryMove({ from: 'f7', to: 'f8' }).ok).toBe(true)
      expect(store.status).toEqual({ kind: 'checkmate', winner: 'w' })

      await Promise.resolve()
      await Promise.resolve()

      expect(playSearch).not.toHaveBeenCalled()
      expect(store.engineThinking).toBe(false)
    })

    it('null bestmove leaves engine turn with thinking cleared (Undo/Resign escape)', async () => {
      const playSearch = vi.fn(async () => null)
      installEngineMock({ playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.engineThinking).toBe(false))

      expect(playSearch).toHaveBeenCalled()
      expect(store.isHumanTurn).toBe(false)
      expect(store.canUndo).toBe(true)
      expect(store.history).toEqual(['e4'])
    })

    it('illegal bestmove is ignored and leaves engine turn', async () => {
      const playSearch = vi.fn(async () => ({ from: 'a1', to: 'a2' }) satisfies UciMove)
      installEngineMock({ playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.engineThinking).toBe(false))

      expect(store.history).toEqual(['e4'])
      expect(store.isHumanTurn).toBe(false)
      expect(store.canUndo).toBe(true)
    })

    it('applies an engine promotion reply', async () => {
      const playSearch = vi.fn(
        async () => ({ from: 'e2', to: 'e1', promotion: 'q' }) satisfies UciMove,
      )
      installEngineMock({ playSearch })
      const store = startAsWhite()

      // Black to move with a pawn on e2 (7th rank from Black’s side).
      expect(store.loadFen('k7/8/8/8/8/8/4p3/K7 b - - 0 1')).toBe(true)
      expect(store.isHumanTurn).toBe(false)
      store.requestEngineMove()

      await vi.waitFor(() => expect(store.isHumanTurn).toBe(true))

      expect(playSearch).toHaveBeenCalled()
      expect(store.history.some((san) => san.includes('e1=Q'))).toBe(true)
      expect(store.engineThinking).toBe(false)
    })
  })

  describe('M8 eval search + win%', () => {
    it('updates whiteWinPct after a full exchange eval completes', async () => {
      const evalSearch = vi.fn(async () => ({ kind: 'cp', value: 400 }) satisfies UciScore)
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(91))

      expect(evalSearch).toHaveBeenCalledWith({
        fen: expect.stringContaining('4P3'),
      })
      expect(store.blackWinPct).toBe(9)
      expect(store.evalSeries).toEqual([{ ply: 2, white: 91 }])
    })

    it('evalSeries clears on reset and only includes plies within history', async () => {
      const evalSearch = vi
        .fn()
        .mockResolvedValueOnce({ kind: 'cp', value: 400 } satisfies UciScore)
        .mockResolvedValueOnce({ kind: 'cp', value: 0 } satisfies UciScore)
        .mockResolvedValue({ kind: 'cp', value: 200 } satisfies UciScore)
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockResolvedValueOnce({ from: 'b8', to: 'c6' } satisfies UciMove)
        .mockResolvedValue({ from: 'g8', to: 'f6' } satisfies UciMove)
      installEngineMock({ evalSearch, playSearch, stopAndDrain: vi.fn(async () => {}) })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.evalSeries).toEqual([{ ply: 2, white: 91 }]))

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      await vi.waitFor(() =>
        expect(store.evalSeries).toEqual([
          { ply: 2, white: 91 },
          { ply: 4, white: 50 },
        ]),
      )

      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(store.evalSeries).toEqual([{ ply: 2, white: 91 }])

      store.reset()
      expect(store.evalSeries).toEqual([])
      expect(store.whiteWinPct).toBeNull()
    })

    it('holds whiteWinPct while engineThinking', async () => {
      let resolvePlay!: (move: UciMove | null) => void
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockImplementation(
          () =>
            new Promise<UciMove | null>((resolve) => {
              resolvePlay = resolve
            }),
        )
      const evalSearch = vi.fn(async () => ({ kind: 'cp', value: 400 }) satisfies UciScore)
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(91))

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)
      expect(store.whiteWinPct).toBe(91)

      resolvePlay({ from: 'b8', to: 'c6' })
    })

    it('restores prior whiteWinPct on undo then re-requests eval', async () => {
      const evalSearch = vi
        .fn()
        .mockResolvedValueOnce({ kind: 'cp', value: 400 } satisfies UciScore)
        .mockResolvedValueOnce({ kind: 'cp', value: 0 } satisfies UciScore)
        .mockResolvedValue({ kind: 'cp', value: 200 } satisfies UciScore)
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockResolvedValueOnce({ from: 'b8', to: 'c6' } satisfies UciMove)
        .mockResolvedValue({ from: 'g8', to: 'f6' } satisfies UciMove)
      const stopAndDrain = vi.fn(async () => {})
      installEngineMock({ evalSearch, playSearch, stopAndDrain })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(91))
      expect(store.history.length).toBe(2)

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.history.length).toBe(4))
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(50))

      evalSearch.mockClear()
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(stopAndDrain).toHaveBeenCalled()
      expect(store.history.length).toBe(2)
      expect(store.whiteWinPct).toBe(91)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalled())
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(76))
    })

    it('mid-think undo restores prior win% and re-requests eval after drain', async () => {
      let resolvePlay!: (move: UciMove | null) => void
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockImplementation(
          () =>
            new Promise<UciMove | null>((resolve) => {
              resolvePlay = resolve
            }),
        )
      const evalSearch = vi
        .fn()
        .mockResolvedValueOnce({ kind: 'cp', value: 400 } satisfies UciScore)
        .mockResolvedValue({ kind: 'cp', value: 200 } satisfies UciScore)
      let resolveDrain!: () => void
      const stopAndDrain = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDrain = resolve
          }),
      )
      installEngineMock({ evalSearch, playSearch, stopAndDrain })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(91))

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      expect(store.engineThinking).toBe(true)
      expect(store.history).toEqual(['e4', 'e5', 'Nf3'])

      evalSearch.mockClear()
      expect(store.undoUntilHumanTurn()).toBe(true)
      expect(stopAndDrain).toHaveBeenCalled()
      expect(store.history.length).toBe(2)
      expect(store.whiteWinPct).toBe(91)
      expect(store.isHumanTurn).toBe(true)
      expect(evalSearch).not.toHaveBeenCalled()

      resolveDrain()
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalled())
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(76))

      resolvePlay({ from: 'b8', to: 'c6' })
    })

    it('ignores stale eval results after a newer position change', async () => {
      const evalResolvers: Array<(score: UciScore | null) => void> = []
      const evalSearch = vi.fn(
        () =>
          new Promise<UciScore | null>((resolve) => {
            evalResolvers.push(resolve)
          }),
      )
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalledTimes(1))

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalledTimes(2))

      evalResolvers[1]!({ kind: 'cp', value: 0 })
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(50))

      evalResolvers[0]!({ kind: 'cp', value: 400 })
      await Promise.resolve()
      expect(store.whiteWinPct).toBe(50)
    })

    it('applies latest eval when position changes while an eval is busy', async () => {
      const evalResolvers: Array<(score: UciScore | null) => void> = []
      const evalSearch = vi.fn(
        () =>
          new Promise<UciScore | null>((resolve) => {
            evalResolvers.push(resolve)
          }),
      )
      const playSearch = vi
        .fn()
        .mockResolvedValueOnce({ from: 'e7', to: 'e5' } satisfies UciMove)
        .mockResolvedValueOnce({ from: 'b8', to: 'c6' } satisfies UciMove)
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalledTimes(1))

      expect(store.tryMove({ from: 'g1', to: 'f3' }).ok).toBe(true)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalledTimes(2))

      // First (stale) and second (current) still pending — complete current first.
      evalResolvers[1]!({ kind: 'cp', value: 0 })
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(50))
      expect(store.history.length).toBe(4)

      evalResolvers[0]!({ kind: 'cp', value: 400 })
      await Promise.resolve()
      expect(store.whiteWinPct).toBe(50)
    })

    it('requests eval after human-delivered checkmate with enough history', async () => {
      const evalSearch = vi.fn(async () => ({ kind: 'mate', value: -1 }) satisfies UciScore)
      let playCalls = 0
      const playSearch = vi.fn(async () => {
        playCalls++
        if (playCalls === 1) {
          return { from: 'e7', to: 'e5' }
        }
        if (playCalls === 2) {
          return { from: 'd8', to: 'h4' }
        }
        return null
      })
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'f2', to: 'f3' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.engineThinking).toBe(false))
      evalSearch.mockClear()

      expect(store.tryMove({ from: 'g2', to: 'g4' }).ok).toBe(true)
      await vi.waitFor(() => expect(store.status).toEqual({ kind: 'checkmate', winner: 'b' }))
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalled())
      await vi.waitFor(() => expect(store.whiteWinPct).toBe(0))
    })

    it('reset clears whiteWinPct and ignores late eval', async () => {
      let resolveEval!: (score: UciScore | null) => void
      const evalSearch = vi.fn(
        () =>
          new Promise<UciScore | null>((resolve) => {
            resolveEval = resolve
          }),
      )
      const playSearch = vi.fn(async () => ({ from: 'e7', to: 'e5' }) satisfies UciMove)
      installEngineMock({ evalSearch, playSearch })
      const store = startAsWhite()

      expect(store.tryMove({ from: 'e2', to: 'e4' }).ok).toBe(true)
      await vi.waitFor(() => expect(evalSearch).toHaveBeenCalled())

      store.reset()
      expect(store.whiteWinPct).toBeNull()

      resolveEval({ kind: 'cp', value: 400 })
      await Promise.resolve()
      expect(store.whiteWinPct).toBeNull()
    })
  })
})
