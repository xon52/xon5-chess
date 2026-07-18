import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Chess, DEFAULT_POSITION } from 'chess.js'

import ChessBoard from '@/components/ChessBoard.vue'
import { setEngineClient, type EngineClient } from '@/engine/stockfishClient'
import type { UciMove } from '@/engine/uci'
import { useGameStore } from '@/stores/game'
import PlayView from '@/views/PlayView.vue'

/** Mock engine: first legal move in the given FEN (deterministic stub for UI tests). */
const legalReply = (fen: string): UciMove | null => {
  const chess = new Chess(fen)
  const moves = chess.moves({ verbose: true })
  const pick = moves[0]
  if (!pick) {
    return null
  }
  const promotion =
    pick.promotion === 'q' ||
    pick.promotion === 'r' ||
    pick.promotion === 'b' ||
    pick.promotion === 'n'
      ? pick.promotion
      : undefined
  return { from: pick.from, to: pick.to, promotion }
}

const installPlayEngineMock = () => {
  const mock: EngineClient = {
    playSearch: vi.fn(async ({ fen }) => legalReply(fen)),
    evalSearch: vi.fn(async () => null),
    notifyNewGame: vi.fn(),
    stop: vi.fn(),
    stopAndDrain: vi.fn(async () => {}),
  }
  mock.stopAndDrain = vi.fn(async () => {
    mock.stop()
  })
  setEngineClient(mock)
  return mock
}

const engineClient = (partial: Partial<EngineClient> = {}): EngineClient => {
  const mock: EngineClient = {
    playSearch: vi.fn(async ({ fen }) => legalReply(fen)),
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
  return mock
}

describe('PlayView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    installPlayEngineMock()
  })

  afterEach(() => {
    setEngineClient(null)
  })

  const mountPlay = () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(PlayView, {
      global: {
        plugins: [pinia],
      },
    })
    return { wrapper, store: useGameStore() }
  }

  const emitBoardMove = async (
    wrapper: ReturnType<typeof mount>,
    from: string,
    to: string,
  ) => {
    await wrapper.getComponent(ChessBoard).vm.$emit('move', { from, to })
    await nextTick()
    await flushPromises()
  }

  const openChooserAndStart = async (
    wrapper: ReturnType<typeof mount>,
    color: 'w' | 'b' = 'w',
  ) => {
    const newGameBtn = wrapper.findAll('button').find((b) => b.text() === 'New Game')
    expect(newGameBtn).toBeDefined()
    await newGameBtn!.trigger('click')
    await nextTick()

    const radio = wrapper.find(`input[name="human-color"][value="${color}"]`)
    await radio.setValue(color)
    await nextTick()

    const start = wrapper.findAll('button').find((b) => b.text() === 'Start')
    await start!.trigger('click')
    await nextTick()
    await flushPromises()
  }

  describe('start gate', () => {
    it('cleared state hides eval and moves; shows Ready and New Game only', () => {
      const { wrapper, store } = mountPlay()

      expect(store.humanColor).toBeNull()
      expect(wrapper.text()).toContain('Ready to play')
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).not.toContain('Resign')
      expect(wrapper.text()).not.toContain('Undo')
      expect(wrapper.find('.play__eval').exists()).toBe(false)
      expect(wrapper.find('.play__history').exists()).toBe(false)
      expect(wrapper.find('.play__elo-display').exists()).toBe(false)
    })

    it('locks the board before New Game; moves do not change the store', async () => {
      const { wrapper, store } = mountPlay()

      expect(store.isHumanTurn).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      await emitBoardMove(wrapper, 'e2', 'e4')

      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(store.history).toEqual([])
    })

    it('opens chooser in place of New Game; Cancel leaves store unchanged', async () => {
      const { wrapper, store } = mountPlay()

      const newGameBtn = wrapper.findAll('button').find((b) => b.text() === 'New Game')
      await newGameBtn!.trigger('click')
      await nextTick()

      expect(wrapper.text()).toContain('Play as')
      expect(wrapper.text()).not.toContain('New Game')

      const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
      await cancel!.trigger('click')
      await nextTick()

      expect(store.humanColor).toBeNull()
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(wrapper.text()).toContain('New Game')
    })

    it('Start commits color and Elo via newGame', async () => {
      const { wrapper, store } = mountPlay()
      const spy = vi.spyOn(store, 'newGame')

      const newGameBtn = wrapper.findAll('button').find((b) => b.text() === 'New Game')
      await newGameBtn!.trigger('click')
      await nextTick()

      await wrapper.find('input[name="human-color"][value="w"]').setValue('w')
      const eloInput = wrapper.find('.play__elo-slider')
      await eloInput.setValue('1500')
      await nextTick()

      const start = wrapper.findAll('button').find((b) => b.text() === 'Start')
      await start!.trigger('click')
      await nextTick()

      expect(spy).toHaveBeenCalledWith({ color: 'w', elo: 1500 })
      expect(store.humanColor).toBe('w')
      expect(store.elo).toBe(1500)
      expect(store.isHumanTurn).toBe(true)
    })

    it('Elo is chooser-only in the UI; store holds the started value for play', async () => {
      const { wrapper, store } = mountPlay()

      expect(wrapper.find('.play__elo-slider').exists()).toBe(false)
      expect(wrapper.find('.play__elo-display').exists()).toBe(false)
      expect(store.elo).toBe(1200)

      const newGameBtn = wrapper.findAll('button').find((b) => b.text() === 'New Game')
      await newGameBtn!.trigger('click')
      await nextTick()

      const chooserSlider = wrapper.find('.play__elo-slider')
      expect(chooserSlider.exists()).toBe(true)
      expect(chooserSlider.element).toHaveProperty('value', '1200')

      await chooserSlider.setValue('1500')
      await nextTick()
      await wrapper.findAll('button').find((b) => b.text() === 'Start')!.trigger('click')
      await nextTick()

      expect(store.elo).toBe(1500)
      expect(wrapper.find('.play__elo-slider').exists()).toBe(false)
      const display = wrapper.find('.play__elo-display')
      expect(display.exists()).toBe(true)
      expect(display.text()).toContain('Elo')
      expect(display.text()).toContain('1500')

      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()
      expect(wrapper.find('.play__elo-display').exists()).toBe(true)
      expect(wrapper.find('.play__elo-display').text()).toContain('1500')
    })
  })

  describe('play and board lock', () => {
    it('applies a White human move then engine reply unlocks for White again', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      expect(wrapper.text()).toContain('White to move')
      expect(wrapper.text()).toContain('Resign')
      expect(wrapper.text()).toContain('Undo')
      expect(wrapper.text()).not.toContain('New Game')
      expect(store.isHumanTurn).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('orientation')).toBe('white')

      await emitBoardMove(wrapper, 'e2', 'e4')

      expect(store.history[0]).toBe('e4')
      expect(store.history.length).toBe(2)
      expect(store.turn).toBe('w')
      expect(store.isHumanTurn).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
      expect(wrapper.find('.play__history').exists()).toBe(true)
      expect(wrapper.find('.play__history-title').exists()).toBe(true)
      expect(wrapper.find('.play__eval-chart').exists()).toBe(true)
      expect(wrapper.find('.play__eval').exists()).toBe(false)

      // Opponent pieces remain unmovable — human is White.
      const afterEngine = store.fen
      await emitBoardMove(wrapper, 'e7', 'e5')
      expect(store.fen).toBe(afterEngine)
    })

    it('updates eval display when store whiteWinPct is set', async () => {
      const evalSearch = vi.fn(async () => ({ kind: 'cp' as const, value: 400 }))
      setEngineClient(
        engineClient({
          playSearch: vi.fn(async ({ fen }) => legalReply(fen)),
          evalSearch,
        }),
      )

      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')

      await vi.waitFor(() => expect(store.whiteWinPct).toBe(91))
      await nextTick()

      expect(wrapper.text()).toContain('91 / 9')
    })

    it('ignores illegal board moves without changing FEN or history', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      const startFen = store.fen

      await emitBoardMove(wrapper, 'e2', 'e5')

      expect(store.fen).toBe(startFen)
      expect(store.history).toEqual([])
      expect(store.turn).toBe('w')
      expect(wrapper.text()).toContain('White to move')
    })

    it('Black New Game engine moves first then unlocks for Black', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'b')

      expect(store.humanColor).toBe('b')
      expect(store.history.length).toBe(1)
      expect(store.isHumanTurn).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('orientation')).toBe('black')
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
      expect(wrapper.text()).toContain('Black to move')
    })

    it('keeps the board locked until the engine bestmove is applied', async () => {
      let resolveSearch!: (move: UciMove | null) => void
      setEngineClient(
        engineClient({
          playSearch: vi.fn(
            () =>
              new Promise<UciMove | null>((resolve) => {
                resolveSearch = resolve
              }),
          ),
        }),
      )

      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')

      expect(store.history).toEqual(['e4'])
      expect(store.engineThinking).toBe(true)
      expect(store.isHumanTurn).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      resolveSearch({ from: 'e7', to: 'e5' })
      await flushPromises()
      await nextTick()

      expect(store.history).toEqual(['e4', 'e5'])
      expect(store.isHumanTurn).toBe(true)
      expect(store.engineThinking).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
    })

    it('locks the board while engineThinking is true', async () => {
      let resolveSearch!: (move: UciMove | null) => void
      setEngineClient(
        engineClient({
          playSearch: vi.fn(
            () =>
              new Promise<UciMove | null>((resolve) => {
                resolveSearch = resolve
              }),
          ),
        }),
      )

      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')

      expect(store.engineThinking).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      // Engine still thinking — board must stay locked via engineThinking
      // (SPEC §3), not only via !isHumanTurn.
      expect(store.isHumanTurn).toBe(false)
      expect(store.engineThinking).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      resolveSearch({ from: 'e7', to: 'e5' })
      await flushPromises()
      await nextTick()

      expect(store.engineThinking).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
    })
  })

  describe('promotion', () => {
    it('opens promotion picker instead of auto-queening', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      expect(store.loadFen('8/P7/8/8/8/8/8/4K2k w - - 0 1')).toBe(true)
      await nextTick()
      const fenBefore = store.fen

      await emitBoardMove(wrapper, 'a7', 'a8')

      expect(store.fen).toBe(fenBefore)
      expect(store.history).toEqual([])
      expect(wrapper.find('.play__modal').exists()).toBe(true)
      expect(wrapper.text()).toContain('Promote to')
      expect(wrapper.find('[aria-label="Promote to Queen"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Promote to Rook"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Promote to Bishop"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="Promote to Knight"]').exists()).toBe(true)
      expect(wrapper.find('piece.queen.white').exists()).toBe(true)
      expect(wrapper.text()).not.toContain('Resign')
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)
    })

    it.each([
      { label: 'Queen', san: 'a8=Q+', fenPiece: 'Q' },
      { label: 'Rook', san: 'a8=R', fenPiece: 'R' },
      { label: 'Bishop', san: 'a8=B+', fenPiece: 'B' },
      { label: 'Knight', san: 'a8=N', fenPiece: 'N' },
    ])('promotes white pawn to $label', async ({ label, san, fenPiece }) => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      expect(store.loadFen('8/P7/8/8/8/8/8/4K2k w - - 0 1')).toBe(true)
      await nextTick()

      await emitBoardMove(wrapper, 'a7', 'a8')
      await wrapper.find(`[aria-label="Promote to ${label}"]`).trigger('click')
      await nextTick()
      await flushPromises()

      expect(store.history[0]).toBe(san)
      expect(store.fen.startsWith(`${fenPiece}7/`)).toBe(true)
      expect(wrapper.find('.play__modal').exists()).toBe(false)
      expect(wrapper.find(`.play__history-sans li[aria-label="${san}"]`).exists()).toBe(true)
    })

    it('promotes as Black via the same picker', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'b')
      // After stub White reply; load a Black-to-move promotion position.
      expect(store.loadFen('4K2k/8/8/8/8/8/p7/8 b - - 0 1')).toBe(true)
      await nextTick()

      await emitBoardMove(wrapper, 'a2', 'a1')
      expect(wrapper.find('.play__modal').exists()).toBe(true)
      expect(wrapper.find('piece.knight.black').exists()).toBe(true)

      await wrapper.find('[aria-label="Promote to Knight"]').trigger('click')
      await nextTick()
      await flushPromises()

      expect(store.history).toEqual(['a1=N'])
      expect(store.fen).toMatch(/(^|\/)n7/)
      expect(wrapper.find('.play__modal').exists()).toBe(false)
    })

    it('Cancel closes promotion picker without changing the store', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      expect(store.loadFen('8/P7/8/8/8/8/8/4K2k w - - 0 1')).toBe(true)
      await nextTick()
      const fenBefore = store.fen

      await emitBoardMove(wrapper, 'a7', 'a8')
      await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
      await nextTick()

      expect(store.fen).toBe(fenBefore)
      expect(store.history).toEqual([])
      expect(wrapper.find('.play__modal').exists()).toBe(false)
      expect(wrapper.text()).toContain('Resign')
      expect(wrapper.text()).toContain('Undo')
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
    })
  })

  describe('resign', () => {
    it('resign confirm uses a blocking modal and Confirm clears the session', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      expect(store.loadFen('8/P7/8/8/8/8/8/4K2k w - - 0 1')).toBe(true)
      await nextTick()

      await emitBoardMove(wrapper, 'a7', 'a8')
      expect(wrapper.find('.play__modal').exists()).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
      await nextTick()
      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()

      expect(wrapper.find('.play__modal').exists()).toBe(true)
      expect(wrapper.find('.play__modal-backdrop').exists()).toBe(true)
      expect(wrapper.text()).toContain('Resign and end this game?')
      expect(wrapper.text()).not.toContain('Undo')

      await wrapper.findAll('button').find((b) => b.text() === 'Confirm')!.trigger('click')
      await nextTick()

      expect(store.humanColor).toBeNull()
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(wrapper.find('.play__modal').exists()).toBe(false)
    })

    it('Resign confirm locks the board so history cannot change under the dialog', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)

      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()

      expect(wrapper.find('.play__modal').exists()).toBe(true)
      expect(wrapper.text()).toContain('Resign and end this game?')
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      await emitBoardMove(wrapper, 'e2', 'e4')
      expect(store.history).toEqual([])
      expect(store.fen).toBe(DEFAULT_POSITION)
    })

    it('Resign confirm Cancel leaves the game; Confirm resets to cleared state', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')
      expect(store.history.length).toBe(2)

      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()
      expect(wrapper.text()).toContain('Resign and end this game?')

      await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
      await nextTick()
      expect(store.history.length).toBe(2)
      expect(store.humanColor).toBe('w')
      expect(wrapper.text()).toContain('Resign')

      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()
      await wrapper.findAll('button').find((b) => b.text() === 'Confirm')!.trigger('click')
      await nextTick()

      expect(store.humanColor).toBeNull()
      expect(store.history).toEqual([])
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(wrapper.text()).toContain('Ready to play')
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).not.toContain('Resign')
    })
  })

  describe('finished game actions', () => {
    it('replaces Resign with New Game when finished; Undo then Resign clears', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      expect(store.loadFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toBe(true)
      await nextTick()

      expect(store.status).toEqual({ kind: 'draw', reason: 'stalemate' })
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).toContain('Undo')
      expect(wrapper.text()).not.toContain('Resign')
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'New Game')!.trigger('click')
      await nextTick()
      expect(wrapper.text()).toContain('Play as')
      expect(wrapper.text()).toContain('Start')

      await wrapper.findAll('button').find((b) => b.text() === 'Cancel')!.trigger('click')
      await nextTick()

      expect(store.status).toEqual({ kind: 'draw', reason: 'stalemate' })
      expect(store.humanColor).toBe('w')
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).not.toContain('Resign')

      // Real mate with history: Undo restores play, then Resign clears the session.
      setEngineClient(engineClient({ playSearch: vi.fn(async () => null) }))
      expect(store.loadFen(DEFAULT_POSITION)).toBe(true)
      await nextTick()
      expect(store.tryMove({ from: 'f2', to: 'f3' }).ok).toBe(true)
      await flushPromises()
      expect(store.applyEngineMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      expect(store.tryMove({ from: 'g2', to: 'g4' }).ok).toBe(true)
      await flushPromises()
      expect(store.applyEngineMove({ from: 'd8', to: 'h4' }).ok).toBe(true)
      await nextTick()

      expect(store.status).toEqual({ kind: 'checkmate', winner: 'b' })
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).not.toContain('Resign')

      await wrapper.findAll('button').find((b) => b.text() === 'Undo')!.trigger('click')
      await nextTick()

      expect(store.status).toEqual({ kind: 'playing' })
      expect(wrapper.text()).toContain('Resign')
      expect(wrapper.text()).not.toContain('New Game')

      await wrapper.findAll('button').find((b) => b.text() === 'Resign')!.trigger('click')
      await nextTick()
      await wrapper.findAll('button').find((b) => b.text() === 'Confirm')!.trigger('click')
      await nextTick()

      expect(store.humanColor).toBeNull()
      expect(store.fen).toBe(DEFAULT_POSITION)
      expect(wrapper.text()).toContain('Ready to play')
      expect(wrapper.text()).toContain('New Game')
      expect(wrapper.text()).not.toContain('Resign')
    })

    it('keeps New Game / Undo (not Resign) for other terminal statuses', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      const expectFinishedActions = () => {
        expect(wrapper.text()).toContain('New Game')
        expect(wrapper.text()).toContain('Undo')
        expect(wrapper.text()).not.toContain('Resign')
      }

      expect(store.loadFen('8/8/8/8/8/8/4k3/4K3 w - - 0 1')).toBe(true)
      await nextTick()
      expect(store.status).toEqual({ kind: 'draw', reason: 'insufficient' })
      expectFinishedActions()

      expect(
        store.loadFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 100 1'),
      ).toBe(true)
      await nextTick()
      expect(store.status).toEqual({ kind: 'draw', reason: 'fifty-move' })
      expectFinishedActions()
    })
  })

  describe('undo', () => {
    it('Undo restores the human turn after a full exchange', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      const undoBtn = wrapper.findAll('button').find((b) => b.text() === 'Undo')
      expect(undoBtn!.attributes('disabled')).toBeDefined()
      expect(store.canUndo).toBe(false)

      await emitBoardMove(wrapper, 'e2', 'e4')
      expect(store.history.length).toBe(2)
      expect(store.isHumanTurn).toBe(true)
      expect(store.canUndo).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'Undo')!.trigger('click')
      await nextTick()

      expect(store.history).toEqual([])
      expect(store.isHumanTurn).toBe(true)
      expect(store.fen).toBe(DEFAULT_POSITION)
    })

    it('Undo is disabled for Black before the human’s first move', async () => {
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'b')

      expect(store.history.length).toBe(1)
      expect(store.isHumanTurn).toBe(true)
      expect(store.canUndo).toBe(false)

      const undoBtn = wrapper.findAll('button').find((b) => b.text() === 'Undo')
      expect(undoBtn!.attributes('disabled')).toBeDefined()
    })

    it('Undo after engine mate restores human turn and unlocks the board', async () => {
      setEngineClient(engineClient({ playSearch: vi.fn(async () => null) }))
      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')

      // Fool's mate via deterministic store plies (engine mock returns null).
      expect(store.tryMove({ from: 'f2', to: 'f3' }).ok).toBe(true)
      await flushPromises()
      expect(store.applyEngineMove({ from: 'e7', to: 'e5' }).ok).toBe(true)
      expect(store.tryMove({ from: 'g2', to: 'g4' }).ok).toBe(true)
      await flushPromises()
      expect(store.applyEngineMove({ from: 'd8', to: 'h4' }).ok).toBe(true)
      await nextTick()

      expect(store.status).toEqual({ kind: 'checkmate', winner: 'b' })
      expect(store.isHumanTurn).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'Undo')!.trigger('click')
      await nextTick()

      expect(store.status).toEqual({ kind: 'playing' })
      expect(store.isHumanTurn).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
    })

    it('Undo while engineThinking unlocks the board and cancels play search', async () => {
      let resolveSearch!: (move: UciMove | null) => void
      const stopAndDrain = vi.fn(async () => {})
      setEngineClient(
        engineClient({
          playSearch: vi.fn(
            () =>
              new Promise<UciMove | null>((resolve) => {
                resolveSearch = resolve
              }),
          ),
          stopAndDrain,
        }),
      )

      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')

      expect(store.engineThinking).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'Undo')!.trigger('click')
      await nextTick()
      await flushPromises()

      expect(stopAndDrain).toHaveBeenCalled()
      expect(store.history).toEqual([])
      expect(store.isHumanTurn).toBe(true)
      expect(store.engineThinking).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)

      resolveSearch({ from: 'e7', to: 'e5' })
      await flushPromises()
      expect(store.history).toEqual([])
    })

    it('Undo mid-think then new move unlocks again after engine reply', async () => {
      let resolveFirst!: (move: UciMove | null) => void
      const playSearch = vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<UciMove | null>((resolve) => {
              resolveFirst = resolve
            }),
        )
        .mockImplementation(async ({ fen }: { fen: string }) => legalReply(fen))
      setEngineClient(engineClient({ playSearch }))

      const { wrapper, store } = mountPlay()
      await openChooserAndStart(wrapper, 'w')
      await emitBoardMove(wrapper, 'e2', 'e4')
      expect(store.engineThinking).toBe(true)

      await wrapper.findAll('button').find((b) => b.text() === 'Undo')!.trigger('click')
      await nextTick()
      await flushPromises()
      expect(store.isHumanTurn).toBe(true)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)

      resolveFirst({ from: 'e7', to: 'e5' })
      await flushPromises()

      await emitBoardMove(wrapper, 'd2', 'd4')
      await flushPromises()
      await nextTick()

      expect(store.history.length).toBe(2)
      expect(store.isHumanTurn).toBe(true)
      expect(store.engineThinking).toBe(false)
      expect(wrapper.getComponent(ChessBoard).props('viewOnly')).toBe(false)
    })
  })
})
