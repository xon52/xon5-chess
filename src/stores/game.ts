import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { Chess, type Color, type Square } from 'chess.js'

import {
  fenSideToMove,
  getEngine,
  getFlairMatchLog,
  printFlairMatchStats,
  recentMovesFromChess,
  recordFlairMove,
  resetFlairMatchLog,
  resolveDifficultyId,
  scoreToWhiteBlackPct,
  type FlairLogQuality,
} from '@/engine'
import {
  buildLegalDests,
  canUndo as canUndoPlies,
  getLastMove,
  isPromotionMove as chessIsPromotionMove,
} from '@/game/board'
import { capturesBySide, type CapturedPiece } from '@/game/captures'
import {
  DEFAULT_DIFFICULTY_ID,
  hasStoredPrefs,
  loadPrefs,
  saveActiveColor,
  saveBoardTheme,
  saveDifficultyId,
  savePanelOpen,
  savePanelPinned,
  saveShowMoveQualities,
  seedDefaultPrefs,
  type ActiveColor,
  type BoardTheme,
} from '@/game/prefs'
import { deriveStatus, type GameStatus } from '@/game/status'
import {
  randomThinkTargetMs,
  remainingThinkPadMs,
  sleepMs,
} from '@/game/thinkDelay'

export type { GameStatus } from '@/game/status'
export type { ActiveColor, BoardTheme } from '@/game/prefs'
export type { CapturedPiece } from '@/game/captures'
export type { FlairLogQuality }

export type TryMoveInput = {
  from: Square | string
  to: Square | string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export type TryMoveResult = { ok: true; san: string } | { ok: false }

export type HintMove = {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
  piece: string
}

export const useGameStore = defineStore('game', () => {
  const prefs = loadPrefs()
  const chess = new Chess()

  const fen = ref(chess.fen())
  const turn = ref<Color>(chess.turn())
  const history = ref<string[]>([])
  const moveQualities = ref<FlairLogQuality[]>([])
  const status = ref<GameStatus>({ kind: 'playing' })
  const humanColor = ref<'w' | 'b' | null>(null)
  const activeColor = ref<ActiveColor>(prefs.activeColor)
  const difficultyId = ref<string>(prefs.difficultyId)
  const boardTheme = ref<BoardTheme>(prefs.boardTheme)
  const panelPinned = ref(prefs.panelPinned)
  const panelOpen = ref(prefs.panelOpen)
  const showMoveQualities = ref(prefs.showMoveQualities)
  const engineThinking = ref(false)
  const hintThinking = ref(false)
  const hintMove = ref<HintMove | null>(null)
  const whiteWinPct = ref<number | null>(null)
  const evalPctByHistoryLength = ref(new Map<number, number>())
  let playSearchGeneration = 0
  let evalSearchGeneration = 0
  let hintSearchGeneration = 0

  const blackWinPct = computed(() =>
    whiteWinPct.value === null ? null : 100 - whiteWinPct.value,
  )

  const evalSeries = computed(() => {
    const maxPly = history.value.length
    const points: { ply: number; white: number }[] = []
    for (const [ply, white] of evalPctByHistoryLength.value) {
      if (ply >= 2 && ply <= maxPly) {
        points.push({ ply, white })
      }
    }
    return points.sort((a, b) => a.ply - b.ply)
  })

  const capturedPieces = computed(() => {
    void fen.value
    return capturesBySide(chess)
  })

  /** Pieces the human lost (left) and opponent lost (right). */
  const captureTrays = computed((): { left: CapturedPiece[]; right: CapturedPiece[] } => {
    const caps = capturedPieces.value
    const human = humanColor.value ?? activeColor.value
    const opp: Color = human === 'w' ? 'b' : 'w'
    return { left: caps[human], right: caps[opp] }
  })

  const clearHint = () => {
    hintSearchGeneration++
    hintMove.value = null
    hintThinking.value = false
  }

  const bumpEvalSearchGeneration = () => {
    evalSearchGeneration++
  }

  const recordEvalPct = (white: number) => {
    whiteWinPct.value = white
    const next = new Map(evalPctByHistoryLength.value)
    next.set(history.value.length, white)
    evalPctByHistoryLength.value = next
  }

  const restoreEvalPct = () => {
    const n = history.value.length
    if (n < 2) {
      whiteWinPct.value = null
      return
    }
    whiteWinPct.value = evalPctByHistoryLength.value.get(n) ?? null
  }

  const clearEvalHistory = () => {
    evalPctByHistoryLength.value = new Map()
    whiteWinPct.value = null
  }

  const trimMoveQualities = () => {
    if (moveQualities.value.length > history.value.length) {
      moveQualities.value = moveQualities.value.slice(0, history.value.length)
    }
  }

  const setMoveQualityAt = (index: number, quality: FlairLogQuality) => {
    const next = moveQualities.value.slice()
    while (next.length < index) {
      next.push('unclassified')
    }
    if (next.length === index) {
      next.push(quality)
    } else {
      next[index] = quality
    }
    moveQualities.value = next
  }

  const pushMoveQuality = (quality: FlairLogQuality) => {
    moveQualities.value = [...moveQualities.value, quality]
  }

  const syncFromChess = () => {
    fen.value = chess.fen()
    turn.value = chess.turn()
    history.value = chess.history()
    status.value = deriveStatus(chess)
    trimMoveQualities()
  }

  const invalidatePlaySearch = (): Promise<void> => {
    playSearchGeneration++
    engineThinking.value = false
    return getEngine().stopAndDrain()
  }

  const canRequestEvalSearch = (): boolean =>
    humanColor.value !== null && history.value.length >= 2 && !engineThinking.value

  const requestEvalSearch = () => {
    if (!canRequestEvalSearch()) {
      return
    }

    const generation = evalSearchGeneration
    const positionFen = fen.value
    const sideToMove = fenSideToMove(positionFen)

    void getEngine()
      .evalSearch({ fen: positionFen })
      .then((score) => {
        if (generation !== evalSearchGeneration) {
          return
        }
        if (!score) {
          return
        }
        const { white } = scoreToWhiteBlackPct(score, sideToMove)
        recordEvalPct(white)
      })
      .catch((err) => {
        console.error('[game] eval search failed', err)
      })
  }

  const isHumanTurn = computed(
    () =>
      humanColor.value !== null &&
      status.value.kind === 'playing' &&
      turn.value === humanColor.value,
  )

  const orientation = computed(() => (activeColor.value === 'b' ? 'black' : 'white'))

  const legalDests = computed(() => {
    void fen.value
    void humanColor.value
    if (!isHumanTurn.value) {
      return new Map<Square, Square[]>()
    }
    return buildLegalDests(chess)
  })

  const lastMove = computed((): [Square, Square] | undefined => {
    void fen.value
    return getLastMove(chess)
  })

  const requestEngineMove = () => {
    if (
      humanColor.value === null ||
      isHumanTurn.value ||
      status.value.kind !== 'playing' ||
      engineThinking.value
    ) {
      return
    }

    const generation = ++playSearchGeneration
    bumpEvalSearchGeneration()
    clearHint()
    engineThinking.value = true
    const positionFen = fen.value
    const engine = getEngine()
    const difficulty = difficultyId.value
    const recentMoves = recentMovesFromChess(chess)
    const startedAt = performance.now()
    const thinkTarget =
      import.meta.env.MODE === 'test' ? 0 : randomThinkTargetMs()

    void engine
      .playSearch({ fen: positionFen, difficultyId: difficulty, recentMoves })
      .then(async (move) => {
        if (generation !== playSearchGeneration) {
          return
        }
        const pad = remainingThinkPadMs(performance.now() - startedAt, thinkTarget)
        if (pad > 0) {
          await sleepMs(pad)
        }
        if (generation !== playSearchGeneration) {
          return
        }
        if (
          !move ||
          humanColor.value === null ||
          isHumanTurn.value ||
          status.value.kind !== 'playing'
        ) {
          if (move === null) {
            console.warn('[game] play search returned no move')
          }
          return
        }
        const result = applyEngineMove(move)
        if (!result.ok) {
          console.warn('[game] illegal engine bestmove ignored', move)
        } else {
          const log = getFlairMatchLog()
          const last = log[log.length - 1]
          pushMoveQuality(
            last?.side === 'computer' ? last.quality : 'unclassified',
          )
          bumpEvalSearchGeneration()
          if (status.value.kind !== 'playing') {
            printFlairMatchStats()
          }
        }
      })
      .catch((err) => {
        console.error('[game] play search failed', err)
      })
      .finally(() => {
        if (generation === playSearchGeneration) {
          engineThinking.value = false
          requestEvalSearch()
        }
      })
  }

  const applyLegalMove = (input: TryMoveInput): TryMoveResult => {
    if (status.value.kind !== 'playing') {
      return { ok: false }
    }

    try {
      const move = chess.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion,
      })
      clearHint()
      syncFromChess()
      return { ok: true, san: move.san }
    } catch {
      return { ok: false }
    }
  }

  const tryMove = (input: TryMoveInput): TryMoveResult => {
    if (!isHumanTurn.value) {
      return { ok: false }
    }

    const fenBefore = fen.value
    const result = applyLegalMove(input)
    if (!result.ok) {
      return result
    }

    const qualityIndex = history.value.length - 1
    setMoveQualityAt(qualityIndex, 'unclassified')
    bumpEvalSearchGeneration()

    const afterHuman = () => {
      if (status.value.kind !== 'playing') {
        printFlairMatchStats()
        if (history.value.length >= 2) {
          requestEvalSearch()
        }
        return
      }
      if (!isHumanTurn.value) {
        requestEngineMove()
      }
    }

    const move = {
      from: String(input.from).toLowerCase(),
      to: String(input.to).toLowerCase(),
      promotion: input.promotion,
    }
    void getEngine()
      .analyzeMove(fenBefore, move)
      .then((analysis) => {
        recordFlairMove({ side: 'human', ...analysis })
        if (history.value.length > qualityIndex) {
          setMoveQualityAt(qualityIndex, analysis.quality)
        }
      })
      .catch((err) => {
        console.error('[flair] human analyze failed', err)
      })
      .finally(afterHuman)

    return result
  }

  const isPromotionMove = (from: string, to: string): boolean => {
    void fen.value
    return chessIsPromotionMove(chess, from, to)
  }

  const applyEngineMove = (input: TryMoveInput): TryMoveResult => {
    if (humanColor.value === null || isHumanTurn.value) {
      return { ok: false }
    }
    return applyLegalMove(input)
  }

  const undoPly = (): boolean => {
    const undone = chess.undo()
    if (!undone) {
      return false
    }
    syncFromChess()
    return true
  }

  const undoPlies = (n: number): number => {
    let undone = 0
    for (let i = 0; i < n; i++) {
      if (!undoPly()) {
        break
      }
      undone++
    }
    return undone
  }

  const canUndo = computed(() => canUndoPlies(humanColor.value, history.value.length))

  const undoUntilHumanTurn = (): boolean => {
    const color = humanColor.value
    if (color === null || !canUndo.value) {
      return false
    }

    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()
    resetFlairMatchLog()
    clearHint()

    do {
      if (!undoPly()) {
        break
      }
    } while (history.value.length > 0 && turn.value !== color)

    moveQualities.value = moveQualities.value.slice(0, history.value.length)

    if (turn.value === color) {
      restoreEvalPct()
      void drain.then(() => {
        if (turn.value === color && canRequestEvalSearch()) {
          requestEvalSearch()
        }
      })
    }

    return turn.value === color
  }

  /**
   * Switch Flair difficulty. Updates prefs immediately; may resume play
   * on the engine's turn after draining the current search.
   */
  const setDifficultyId = (next: string) => {
    const id = resolveDifficultyId(next)
    if (id === difficultyId.value) {
      return
    }

    playSearchGeneration++
    bumpEvalSearchGeneration()
    engineThinking.value = false
    difficultyId.value = id
    saveDifficultyId(id)

    void getEngine()
      .stopAndDrain()
      .then(() => {
        getEngine().notifyNewGame()

        if (
          humanColor.value !== null &&
          status.value.kind === 'playing' &&
          !isHumanTurn.value
        ) {
          requestEngineMove()
        }
      })
  }

  const setBoardTheme = (theme: BoardTheme) => {
    boardTheme.value = theme
    saveBoardTheme(theme)
  }

  const setPanelPinned = (pinned: boolean) => {
    panelPinned.value = pinned
    savePanelPinned(pinned)
    if (pinned) {
      panelOpen.value = true
      savePanelOpen(true)
    }
  }

  const setPanelOpen = (open: boolean) => {
    panelOpen.value = open
    savePanelOpen(open)
  }

  const setShowMoveQualities = (show: boolean) => {
    showMoveQualities.value = show
    saveShowMoveQualities(show)
  }

  const flipBoard = () => {
    if (humanColor.value !== null && status.value.kind !== 'playing') {
      return
    }

    const next: ActiveColor = activeColor.value === 'w' ? 'b' : 'w'
    activeColor.value = next
    saveActiveColor(next)

    if (humanColor.value !== null) {
      humanColor.value = next
      if (status.value.kind === 'playing') {
        void invalidatePlaySearch().then(() => {
          if (
            humanColor.value === next &&
            status.value.kind === 'playing' &&
            !isHumanTurn.value
          ) {
            requestEngineMove()
          }
        })
      }
    }
  }

  const reset = () => {
    void invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    resetFlairMatchLog()
    clearHint()
    chess.reset()
    humanColor.value = null
    moveQualities.value = []
    syncFromChess()
  }

  const newGame = () => {
    const drain = invalidatePlaySearch()
    bumpEvalSearchGeneration()
    clearEvalHistory()
    resetFlairMatchLog()
    clearHint()
    chess.reset()
    humanColor.value = activeColor.value
    moveQualities.value = []
    syncFromChess()
    void drain.then(() => {
      getEngine().notifyNewGame()
      if (!isHumanTurn.value && status.value.kind === 'playing') {
        requestEngineMove()
      }
    })
  }

  /**
   * Ensure a game is in progress on Play mount: seed defaults if needed,
   * then start with last (or default) settings when idle.
   */
  const ensurePlaySession = (): boolean => {
    let seeded = false
    if (!hasStoredPrefs()) {
      activeColor.value = 'w'
      difficultyId.value = DEFAULT_DIFFICULTY_ID
      seedDefaultPrefs()
      seeded = true
    }
    if (humanColor.value === null) {
      newGame()
      return true
    }
    return seeded
  }

  /** @deprecated Prefer ensurePlaySession — kept for existing tests. */
  const startFirstVisitIfNeeded = (): boolean => {
    if (hasStoredPrefs()) {
      return false
    }
    activeColor.value = 'w'
    difficultyId.value = DEFAULT_DIFFICULTY_ID
    seedDefaultPrefs()
    if (humanColor.value === null) {
      newGame()
      return true
    }
    return false
  }

  const requestHint = () => {
    if (
      humanColor.value === null ||
      status.value.kind !== 'playing' ||
      !isHumanTurn.value ||
      engineThinking.value ||
      hintThinking.value
    ) {
      return
    }

    const generation = ++hintSearchGeneration
    hintThinking.value = true
    const positionFen = fen.value

    void getEngine()
      .hintSearch({ fen: positionFen })
      .then((move) => {
        if (generation !== hintSearchGeneration) {
          return
        }
        if (!move) {
          hintMove.value = null
          return
        }
        const piece = chess.get(move.from as Square)
        hintMove.value = {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          piece: piece?.type ?? 'p',
        }
      })
      .catch((err) => {
        console.error('[game] hint search failed', err)
      })
      .finally(() => {
        if (generation === hintSearchGeneration) {
          hintThinking.value = false
        }
      })
  }

  const loadFen = (fenString: string): boolean => {
    try {
      chess.load(fenString)
      syncFromChess()
      return true
    } catch {
      return false
    }
  }

  return {
    fen,
    turn,
    history,
    moveQualities,
    status,
    humanColor,
    activeColor,
    difficultyId,
    boardTheme,
    panelPinned,
    panelOpen,
    showMoveQualities,
    engineThinking,
    hintThinking,
    hintMove,
    whiteWinPct,
    blackWinPct,
    evalSeries,
    captureTrays,
    isHumanTurn,
    orientation,
    legalDests,
    lastMove,
    canUndo,
    tryMove,
    isPromotionMove,
    applyEngineMove,
    undoPly,
    undoPlies,
    undoUntilHumanTurn,
    setDifficultyId,
    setBoardTheme,
    setPanelPinned,
    setPanelOpen,
    setShowMoveQualities,
    flipBoard,
    reset,
    newGame,
    ensurePlaySession,
    startFirstVisitIfNeeded,
    requestHint,
    clearHint,
    loadFen,
    requestEngineMove,
    requestEvalSearch,
  }
})
